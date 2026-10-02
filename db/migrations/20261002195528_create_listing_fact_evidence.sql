-- migrate:up
-- The condition chips of a listing page (CS-64) quote the short phrase of the seller's text that supports each fact
-- (ADR-0017 point 10: facts, our analysis and short quoted evidence, never the seller's description). The text lives in
-- extraction_field, which the web role cannot read; this view is the narrow window: one row per accepted fact of the
-- listing's current extraction (the same choice listing_filter_row makes: the latest usable extraction of the listing's
-- latest read snapshot), with its value code and its evidence phrase. The phrase is shown only when it is short (at most
-- 200 characters; the longest accepted one on 2026-10-02 had 110) and holds no run of seven digits, which could be a
-- phone number: otherwise the evidence is null and the fact is still listed, without a quote. Value codes and a short
-- quoted phrase are all the view exposes, so a page cannot reach the rest of a listing's text through it.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE VIEW listing_fact_evidence AS
SELECT
  e.listing_id,
  ef.field,
  ef.value,
  CASE
    WHEN char_length(ef.evidence) <= 200 AND ef.evidence !~ '[0-9۰-۹٠-٩]{7,}' THEN ef.evidence
  END AS evidence
FROM extraction e
JOIN listing l ON l.id = e.listing_id
JOIN extraction_field ef
  ON ef.extraction_id = e.id AND ef.status = 'accepted' AND ef.value <> 'not_stated'
WHERE e.status = 'usable'
  AND NOT EXISTS (SELECT FROM extraction later WHERE later.snapshot_id = e.snapshot_id AND later.id > e.id)
  AND e.snapshot_id = coalesce(
    (SELECT fl.snapshot_id FROM fetch_log fl
     WHERE fl.listing_id = e.listing_id AND fl.source_id = l.source_id AND fl.snapshot_id IS NOT NULL
     ORDER BY fl.requested_at DESC, fl.id DESC LIMIT 1),
    (SELECT s.id FROM snapshot s WHERE s.listing_id = e.listing_id ORDER BY s.first_fetched_at DESC, s.id DESC LIMIT 1));

COMMENT ON VIEW listing_fact_evidence IS 'The accepted facts the text of a listing states (CS-52) with the short phrase that supports each (CS-64): the listing page''s only window onto extraction text. Evidence is null when it is longer than 200 characters or holds seven digits in a row.';
COMMENT ON COLUMN listing_fact_evidence.value IS 'The fact''s value code (partial, down_payment, free_zone, 5_or_more...), never not_stated.';
COMMENT ON COLUMN listing_fact_evidence.evidence IS 'The phrase of the listing the model copied, at most 200 characters; null when it was longer or looked like it held a phone number.';

GRANT SELECT ON listing_fact_evidence TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP VIEW listing_fact_evidence;
