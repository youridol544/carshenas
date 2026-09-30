-- migrate:up
-- The superadmin section counts each tracked model's listings through the catalogue (CS-41): a tracked model's key
-- (freshness_measurement.source_model_key) names its catalogue model in catalogue_source_key, the listings matched to
-- that model or a trim under it carry its model_id, and the screen names the model in Persian. Reads only.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT SELECT ON catalogue_source_key, model TO carshenas_admin;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE SELECT ON catalogue_source_key, model FROM carshenas_admin;
