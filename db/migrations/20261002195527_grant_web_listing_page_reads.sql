-- migrate:up
-- The listing page (CS-64) shows what the valuation says about one listing: its rating and market value
-- (listing_valuation), the comparables behind it (listing_valuation_comparable), the fitted coefficients that explain the
-- adjustments (valuation_coefficient), its price history (listing_price_event) and its photos' own addresses
-- (listing_photo, ADR-0025). The data-status migration kept these closed until a page showed them (20260930201621); this
-- is that page. Nothing here is personal: prices, coefficients and the source's own https photo addresses. The seller's
-- text stays behind listing_fact_evidence (the next migration), never a grant on extraction. Read only.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT SELECT ON listing_valuation, listing_valuation_comparable, valuation_coefficient, listing_price_event,
  listing_photo TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE SELECT ON listing_valuation, listing_valuation_comparable, valuation_coefficient, listing_price_event,
  listing_photo FROM carshenas_web;
