-- migrate:up
-- CS-101 (ADR-0040): a mileage typed in thousands. CS-86 left a mileage under 1,000 km on a car of three or more model
-- years unread; the figure is now read one of three ways, and the way is stored beside it. `mileage_km` stays the one
-- value valuation, search and every page read: it is the figure as written, or the assumed one when it was typed in
-- thousands, so no reader changes. The four columns say how it got there:
--   mileage_written_km  the figure the seller wrote, kept only for such a mileage (under 1,000);
--   mileage_reading     really_low (the listing's text says so), thousands_text (the text says thousands),
--                       thousands_price (no wording, the asking price fits the car at 1,000 times the figure: decided
--                       by the valuation run), unread (neither: mileage_km is null, as under CS-86); null for every
--                       other mileage;
--   mileage_wording     the words of the listing's text the reading rests on, for the two text readings;
--   mileage_price_ratio the asking price over the market value of the car at 1,000 times the figure, as the last
--                       valuation run measured it; the evidence of thousands_price and of an unread figure it tested.
-- The CHECKs are added NOT VALID, so the table is not scanned under a lock; the next migration validates them.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing
  ADD COLUMN mileage_written_km integer,
  ADD COLUMN mileage_reading text,
  ADD COLUMN mileage_wording text,
  ADD COLUMN mileage_price_ratio double precision,
  ADD CONSTRAINT listing_mileage_reading_valid
    CHECK (mileage_reading IN ('really_low', 'thousands_text', 'thousands_price', 'unread')) NOT VALID,
  ADD CONSTRAINT listing_mileage_written_range CHECK (mileage_written_km BETWEEN 0 AND 999) NOT VALID,
  ADD CONSTRAINT listing_mileage_reading_complete
    CHECK ((mileage_reading IS NULL) = (mileage_written_km IS NULL)) NOT VALID,
  ADD CONSTRAINT listing_mileage_reading_value CHECK (
    mileage_reading IS NULL
    OR coalesce(
      CASE mileage_reading
        WHEN 'really_low' THEN mileage_km = mileage_written_km
        WHEN 'unread' THEN mileage_km IS NULL
        ELSE mileage_km = mileage_written_km * 1000
      END,
      false)
  ) NOT VALID,
  ADD CONSTRAINT listing_mileage_wording_by_text CHECK (
    (mileage_wording IS NOT NULL) = coalesce(mileage_reading IN ('really_low', 'thousands_text'), false)
  ) NOT VALID,
  ADD CONSTRAINT listing_mileage_wording_text CHECK (btrim(mileage_wording) <> '' AND length(mileage_wording) <= 120)
    NOT VALID,
  ADD CONSTRAINT listing_mileage_price_ratio_tested CHECK (
    (mileage_price_ratio IS NULL OR mileage_reading IN ('unread', 'thousands_price'))
    AND (mileage_reading IS DISTINCT FROM 'thousands_price' OR mileage_price_ratio IS NOT NULL)
    AND (mileage_price_ratio IS NULL OR mileage_price_ratio BETWEEN 0 AND 9999)
  ) NOT VALID;

COMMENT ON COLUMN listing.mileage_written_km IS
  'The kilometres the seller wrote when the figure was under 1,000 on a car three or more model years old (CS-86 floor) and so was read some other way than as written; null for every other mileage. 0 to 999.';
COMMENT ON COLUMN listing.mileage_reading IS
  'How a mileage under the floor was read (CS-101, ADR-0040): really_low (the text says the figure is real: mileage_km is the written figure), thousands_text (the text says thousands: mileage_km is 1,000 times the written figure), thousands_price (no wording, but the asking price fits the car at 1,000 times the figure: the same, decided by a valuation run), unread (neither: mileage_km is null). Null for any other mileage.';
COMMENT ON COLUMN listing.mileage_wording IS
  'The words of the listing text a text reading rests on (for example صفر خشک or 60 هزار), as the parser matched them; null for the other readings.';
COMMENT ON COLUMN listing.mileage_price_ratio IS
  'Asking price divided by the market value of the car at 1,000 times the written figure, from the last valuation run that tested the figure: at most the threshold makes thousands_price; null when it was not tested.';

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A mileage assumed in thousands goes back to unknown, which is what CS-86 made of it; a really low one keeps its figure.
UPDATE listing SET mileage_km = NULL WHERE mileage_reading IN ('thousands_text', 'thousands_price');

ALTER TABLE listing
  DROP CONSTRAINT listing_mileage_price_ratio_tested,
  DROP CONSTRAINT listing_mileage_wording_text,
  DROP CONSTRAINT listing_mileage_wording_by_text,
  DROP CONSTRAINT listing_mileage_reading_value,
  DROP CONSTRAINT listing_mileage_reading_complete,
  DROP CONSTRAINT listing_mileage_written_range,
  DROP CONSTRAINT listing_mileage_reading_valid,
  DROP COLUMN mileage_price_ratio,
  DROP COLUMN mileage_wording,
  DROP COLUMN mileage_reading,
  DROP COLUMN mileage_written_km;
