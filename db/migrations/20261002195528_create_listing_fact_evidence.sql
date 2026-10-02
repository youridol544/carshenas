-- migrate:up
-- The condition chips of a listing page (CS-64) quote the short phrase of the seller's text that supports each fact
-- (ADR-0017 point 4 of the page rules: facts, our analysis and short quoted evidence, never the seller's description). The
-- text lives in extraction_field, which the web role cannot read; this view is the narrow window: one row per accepted
-- fact of the listing's current extraction (the same choice listing_filter_row makes: the latest usable extraction of the
-- listing's latest read snapshot), with its value code and its evidence phrase. The phrase is shown only when it is short
-- (at most 200 characters; the longest accepted one on 2026-10-02 had 110) and does not look like a way to reach the
-- seller: a mobile number (0, 98, +98 or 0098, then 9 and nine more digits) or a landline (0, an area code and seven or
-- eight digits), in Latin, Persian or Arabic-Indic digits, with spaces, dashes, dots, slashes, commas or zero-width
-- characters between the digits; an address with @ or t.me, a link, or the name of a messenger. Digits alone are not the
-- test: «پیش پرداخت: 966,000,000» is a price phrase and stays. Otherwise the evidence is null and the fact is still listed,
-- without a quote. security_barrier keeps a caller's own predicate from being evaluated before these filters.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE VIEW listing_fact_evidence WITH (security_barrier = true) AS
SELECT
  e.listing_id,
  ef.field,
  ef.value,
  CASE
    WHEN char_length(ef.evidence) <= 200
      AND norm.text !~ '(^|[^0-9])(0098|[+]?98|0)[[:space:]./,-]*9([[:space:]./,-]*[0-9]){9}'
      AND norm.text !~ '(^|[^0-9])0[1-8][0-9]([[:space:]./,-]*[0-9]){7,8}'
      AND norm.text !~* '(@|t[.]me|telegram|whatsapp|wa[.]me|instagram|https?:|www[.])'
      THEN ef.evidence
  END AS evidence
FROM extraction e
JOIN listing l ON l.id = e.listing_id
JOIN extraction_field ef
  ON ef.extraction_id = e.id AND ef.status = 'accepted' AND ef.value <> 'not_stated'
CROSS JOIN LATERAL (
  SELECT replace(replace(translate(ef.evidence, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'), chr(8204), ' '), chr(8203), ' ') AS text
) norm
WHERE e.status = 'usable'
  AND NOT EXISTS (SELECT FROM extraction later WHERE later.snapshot_id = e.snapshot_id AND later.id > e.id)
  AND e.snapshot_id = coalesce(
    (SELECT fl.snapshot_id FROM fetch_log fl
     WHERE fl.listing_id = e.listing_id AND fl.source_id = l.source_id AND fl.snapshot_id IS NOT NULL
     ORDER BY fl.requested_at DESC, fl.id DESC LIMIT 1),
    (SELECT s.id FROM snapshot s WHERE s.listing_id = e.listing_id ORDER BY s.first_fetched_at DESC, s.id DESC LIMIT 1));

COMMENT ON VIEW listing_fact_evidence IS 'The accepted facts the text of a listing states (CS-52) with the short phrase that supports each (CS-64): the listing page''s only window onto extraction text. Evidence is null when it is longer than 200 characters or looks like a phone number, a handle, a link or a messenger.';
COMMENT ON COLUMN listing_fact_evidence.value IS 'The fact''s value code (partial, down_payment, free_zone, 5_or_more...), never not_stated.';
COMMENT ON COLUMN listing_fact_evidence.evidence IS 'The phrase of the listing the model copied, at most 200 characters; null when it was longer or looks like a way to reach the seller.';

GRANT SELECT ON listing_fact_evidence TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP VIEW listing_fact_evidence;
