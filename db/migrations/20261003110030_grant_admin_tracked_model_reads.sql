-- migrate:up
-- What the tracked-models screen reads beyond what the section already could (CS-53, ADR-0023): the sweeps' volumes per
-- model key (the date of the last sweep), and the daily valuation (its date, and how many of a model's listings it
-- valued and rated). Reads only; the section writes nothing but through functions.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT SELECT ON model_volume, valuation_run, listing_valuation TO carshenas_admin;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE SELECT ON model_volume, valuation_run, listing_valuation FROM carshenas_admin;
