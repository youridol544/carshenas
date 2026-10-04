-- migrate:up
-- Origin by make for the foreign makes whose cars are only imported (CS-100, ADR-0039; owner feedback of 2026-10-04: «ماشین خارجی»
-- must reach every Toyota, not only the tracked Corolla). Only the models that have no origin yet get one, so a model
-- the superadmin or the first seed already set is never changed; a make with assembled cars (Kia, Hyundai, Renault, Nissan,
-- Mazda, Chinese brands) is left for the superadmin. Each row is recorded as a seed in model_spec_change.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

WITH makes (slug) AS (
  VALUES ('toyota'), ('honda'), ('volkswagen'), ('skoda'), ('opel'), ('ford'), ('jeep'), ('chrysler'), ('dodge'),
         ('chevrolet'), ('buick'), ('subaru'), ('seat'), ('smart'), ('hummer'), ('pontiac'), ('daihatsu')
), added AS (
  INSERT INTO model_spec (model_id, trim_id, car_origin, source)
  SELECT m.id, NULL, 'imported', 'seed'
  FROM makes JOIN make k ON k.slug = makes.slug JOIN model m ON m.make_id = k.id
  WHERE NOT EXISTS (SELECT FROM model_spec s WHERE s.model_id = m.id AND s.trim_id IS NULL)
  RETURNING model_id, car_origin
)
INSERT INTO model_spec_change (model_id, trim_id, action, to_origin)
SELECT model_id, NULL, 'seeded', car_origin FROM added;

-- migrate:down
-- WARNING: this removes the seeded rows and their change records (an append-only table; a purge setting is needed).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL carshenas.purge = 'on';

DELETE FROM model_spec_change c USING model_spec s
WHERE c.model_id = s.model_id AND c.trim_id IS NOT DISTINCT FROM s.trim_id AND s.source = 'seed'
  AND s.engine_volume_cc IS NULL AND s.car_origin = 'imported' AND c.action = 'seeded'
  AND s.model_id IN (SELECT m.id FROM model m JOIN make k ON k.id = m.make_id
                     WHERE k.slug IN ('toyota','honda','volkswagen','skoda','opel','ford','jeep','chrysler','dodge','chevrolet','buick','subaru','seat','smart','hummer','pontiac','daihatsu'))
  AND s.model_id NOT IN (SELECT model_id FROM model_spec_change WHERE action IN ('added','changed','removed'));
DELETE FROM model_spec s WHERE s.source = 'seed' AND s.engine_volume_cc IS NULL AND s.car_origin = 'imported'
  AND s.trim_id IS NULL
  AND s.model_id IN (SELECT m.id FROM model m JOIN make k ON k.id = m.make_id
                     WHERE k.slug IN ('toyota','honda','volkswagen','skoda','opel','ford','jeep','chrysler','dodge','chevrolet','buick','subaru','seat','smart','hummer','pontiac','daihatsu'))
  AND NOT EXISTS (SELECT FROM model_spec_change c WHERE c.model_id = s.model_id AND c.action IN ('added','changed','removed'));
