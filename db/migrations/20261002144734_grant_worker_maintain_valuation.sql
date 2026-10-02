-- migrate:up
-- The daily valuation (CS-51) analyses the tables it has just written, so the planner knows their size before the
-- rating reads them. Without statistics it chose sequential scans inside valuation_rate_listing() for each of about
-- 5,000 listings: on 2026-10-02, when the run first met 5,000 listings with details, one batch took 86 s and the run
-- failed on the worker's 30-second statement limit; the same batch takes 0.17 s once the rows are analysed.
-- ANALYZE needs MAINTAIN (PostgreSQL 17 and later), as CS-59 grants it for its search tables.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT MAINTAIN ON valuation_coefficient, valuation_segment, valuation_comparable, listing_valuation
  TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE MAINTAIN ON valuation_coefficient, valuation_segment, valuation_comparable, listing_valuation
  FROM carshenas_worker;
