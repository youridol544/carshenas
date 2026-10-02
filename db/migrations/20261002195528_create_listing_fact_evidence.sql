-- migrate:up
-- The condition chips of a listing page (CS-64) quote the short phrase of the seller's text that supports each fact
-- (ADR-0017 point 4 of the page rules: facts, our analysis and short quoted evidence, never the seller's description). The
-- text lives in extraction_field, which the web role cannot read; this view is the narrow window: one row per accepted
-- fact of the listing's current extraction (the same choice listing_filter_row makes: the latest usable extraction of the
-- listing's latest read snapshot), with its value code and its evidence phrase. The phrase is shown only when it is short
-- (at most 200 characters; the longest accepted one on 2026-10-02 had 110) and does not look like a way to reach the
-- seller. The phrase is normalised first (Persian and Arabic-Indic digits to Latin, then every run of anything that is
-- not a digit or a letter between two digits deleted: spaces, dashes, dots, slashes, commas, brackets, bullets,
-- underscores, thousands marks, bidi marks, joiners, tatweel), and the digits that remain are tested as a mobile number
-- (0098, 98, +98 or 0, optional, then 9 and nine more digits) and as a landline (0 or 98, an area code 1 to 8, then eight
-- or nine digits). The text itself is tested for @, a link or an address ending .ir, .com, .net, .org or .me, and for the
-- names of messengers. A price phrase passes: «پیش پرداخت: 966,000,000» is nine digits. A number of ten digits or more
-- that begins with 9 (a price of nine billion tomans) is dropped too: failing closed is the rule. Otherwise the evidence
-- is null and the fact is still listed, without a quote. security_barrier keeps a caller's own predicate from being
-- evaluated before these filters.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE VIEW listing_fact_evidence WITH (security_barrier = true) AS
SELECT
  e.listing_id,
  ef.field,
  ef.value,
  CASE
    WHEN char_length(ef.evidence) <= 200
      AND y.digits !~ '(0098|[+]?98|0)?9[0-9]{9}'
      AND y.digits !~ '(0|98)[1-8][0-9]{8,9}'
      AND x.text !~* '(@|[.](ir|com|net|org|me)\y|https?:|www[.]|t[.]me|wa[.]me)'
      AND x.text !~ '(تلگرام|واتساپ|واتس.?اپ|ایتا|روبیکا|سروش|بله|اینستاگرام|telegram|whatsapp|instagram)'
      THEN ef.evidence
  END AS evidence
FROM extraction e
JOIN listing l ON l.id = e.listing_id
JOIN extraction_field ef
  ON ef.extraction_id = e.id AND ef.status = 'accepted' AND ef.value <> 'not_stated'
CROSS JOIN LATERAL (
  SELECT translate(ef.evidence, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789') AS text
) x
CROSS JOIN LATERAL (
  SELECT regexp_replace(x.text, '(?<=[0-9])[^0-9A-Za-zء-ؿف-يپچژکگی]+(?=[0-9])', '', 'g') AS digits
) y
WHERE e.status = 'usable'
  AND NOT EXISTS (SELECT FROM extraction later WHERE later.snapshot_id = e.snapshot_id AND later.id > e.id)
  AND e.snapshot_id = coalesce(
    (SELECT fl.snapshot_id FROM fetch_log fl
     WHERE fl.listing_id = e.listing_id AND fl.source_id = l.source_id AND fl.snapshot_id IS NOT NULL
     ORDER BY fl.requested_at DESC, fl.id DESC LIMIT 1),
    (SELECT s.id FROM snapshot s WHERE s.listing_id = e.listing_id ORDER BY s.first_fetched_at DESC, s.id DESC LIMIT 1));

COMMENT ON VIEW listing_fact_evidence IS 'The accepted facts the text of a listing states (CS-52) with the short phrase that supports each (CS-64): the listing page''s only window onto extraction text. Evidence is null when it is longer than 200 characters or looks like a way to reach the seller (a phone number, a handle, a link or a messenger).';
COMMENT ON COLUMN listing_fact_evidence.value IS 'The fact''s value code (partial, down_payment, free_zone, 5_or_more...), never not_stated.';
COMMENT ON COLUMN listing_fact_evidence.evidence IS 'The phrase of the listing the model copied, at most 200 characters; null when it was longer or looks like a way to reach the seller.';

GRANT SELECT ON listing_fact_evidence TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP VIEW listing_fact_evidence;
