-- migrate:up
-- The owner's first ten tracked models (CS-53 criterion 3): the ten Divar models with the most Tehran listings in the
-- first measurement (2026-09-29, CS-33; `apps/worker/src/sources/divar/tracked-models.ts` held them as a configured
-- list until now), found through the catalogue's own source keys. A fresh database with no catalogue yet gets none,
-- and the superadmin tracks from the section.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

WITH ten (source_model_key) AS (
  VALUES ('Peugeot 206'), ('Peugeot 207i'), ('Peugeot Pars'), ('Dena plus'), ('Samand Soren'), ('Peugeot 405'),
         ('Quick manual'), ('Pride 131'), ('Toyota Corolla'), ('Samand LX')
), chosen AS (
  INSERT INTO tracked_model (model_id, trim_id, origin, priority)
  SELECT DISTINCT k.model_id, NULL::bigint, 'seed', 'normal'
  FROM catalogue_source_key k
  JOIN ten ON ten.source_model_key = k.source_model_key
  WHERE k.source_id = 'divar' AND k.level = 'model' AND k.model_id IS NOT NULL
  ON CONFLICT ON CONSTRAINT tracked_model_once_per_scope_unique DO NOTHING
  RETURNING model_id
)
INSERT INTO tracked_model_change (model_id, trim_id, action, to_value)
SELECT model_id, NULL, 'seeded', 'normal' FROM chosen;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- The seed rows only; the audit trail is append-only and stays (the tables are dropped with the previous migration).
DELETE FROM tracked_model WHERE origin = 'seed';
