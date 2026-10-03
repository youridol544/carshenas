// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createMigratedDatabase } from '@/server/db/schema-test-database';

// Engine volume and origin (CS-99, ADR-0039): what the schema enforces about a model's and a trim's spec, who may
// change it, that every change is recorded, and which value a listing inherits (its own title's volume, else its trim's,
// else its model's), proved by what PostgreSQL rejects and returns. Each test runs in a transaction that is rolled back.

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDatabase();
}, 60_000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec('BEGIN');
});
afterEach(async () => {
  await db.exec('ROLLBACK');
});

const HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';

async function returningId(statement: string, params: unknown[] = []): Promise<number> {
  const { rows } = await db.query<{ id: number | bigint }>(statement, params);
  const [row] = rows;
  if (!row) throw new Error(`no row returned: ${statement}`);
  return Number(row.id);
}

async function failure(statement: string, params: unknown[] = []): Promise<unknown> {
  await db.exec('SAVEPOINT expected_failure');
  try {
    await db.query(statement, params);
  } catch (error) {
    await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
    return error;
  }
  await db.exec('RELEASE SAVEPOINT expected_failure');
  throw new Error(`expected this statement to fail: ${statement}`);
}

async function fixtures() {
  const admin = await returningId(
    `INSERT INTO account (username, password_hash, role) VALUES ('admin_1', $1, 'superadmin') RETURNING id`,
    [HASH],
  );
  const buyer = await returningId(
    `INSERT INTO account (username, password_hash, role) VALUES ('ali_1403', $1, 'buyer') RETURNING id`,
    [HASH],
  );
  const makeId = await returningId(
    `INSERT INTO make (slug, name_en) VALUES ('toyota', 'Toyota') RETURNING id`,
  );
  const modelId = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, 'corolla', 'Corolla') RETURNING id`,
    [makeId],
  );
  const trimId = await returningId(
    `INSERT INTO trim (model_id, slug, name_en) VALUES ($1, '1800-hybrid', 'Hybrid 1800') RETURNING id`,
    [modelId],
  );
  const otherModelId = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, 'camry', 'Camry') RETURNING id`,
    [makeId],
  );
  const otherTrimId = await returningId(
    `INSERT INTO trim (model_id, slug, name_en) VALUES ($1, 'le', 'LE') RETURNING id`,
    [otherModelId],
  );
  return { admin, buyer, makeId, modelId, trimId, otherModelId, otherTrimId };
}

async function setSpec(
  modelId: number,
  trimId: number | null,
  volume: number | null,
  origin: string | null,
  by: number,
): Promise<string | undefined> {
  const { rows } = await db.query<{ outcome: string }>(
    `SELECT set_model_spec($1, $2, $3, $4, $5) AS outcome`,
    [modelId, trimId, volume, origin, by],
  );
  return rows[0]?.outcome;
}

let listingNumber = 0;
async function listing(ids: { makeId: number; modelId: number; trimId?: number }, ownVolume: number | null) {
  listingNumber += 1;
  return returningId(
    `INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, make_id, model_id, trim_id,
                          catalogue_match, price_type, asking_price_toman, engine_volume_cc)
     VALUES ('divar', $1, $2, 'active', now(), now(), $3, $4, $5, $6, 'asking', 1000000000, $7) RETURNING id`,
    [
      `spec${String(listingNumber)}`,
      `https://divar.ir/v/spec${String(listingNumber)}`,
      ids.makeId,
      ids.modelId,
      ids.trimId ?? null,
      ids.trimId === undefined ? 'model' : 'trim',
      ownVolume,
    ],
  );
}

async function inherited(listingId: number) {
  const { rows } = await db.query<{ engine_volume_cc: number | null; car_origin: string | null }>(
    `SELECT engine_volume_cc, car_origin FROM listing_filter_row WHERE listing_id = $1`,
    [listingId],
  );
  return rows[0];
}

test('the superadmin adds, changes and removes a spec through the function, which records who, when and the earlier values', async () => {
  const { admin, modelId, trimId } = await fixtures();
  expect(await setSpec(modelId, null, 1800, 'imported', admin)).toBe('changed');
  expect(await setSpec(modelId, null, 1800, 'imported', admin)).toBe('unchanged');
  expect(await setSpec(modelId, null, 2000, 'imported', admin)).toBe('changed');
  expect(await setSpec(modelId, trimId, 1200, null, admin)).toBe('changed');
  expect(await setSpec(modelId, null, null, null, admin)).toBe('changed');
  expect(await setSpec(modelId, null, null, null, admin)).toBe('unchanged');
  expect(await setSpec(999_999, null, 1600, null, admin)).toBe('missing');
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT trim_id::int AS trim, action, from_volume_cc, from_origin, to_volume_cc, to_origin, by_account_id::int AS by
     FROM model_spec_change WHERE model_id = $1 ORDER BY id`,
    [modelId],
  );
  expect(rows).toEqual([
    {
      trim: null,
      action: 'added',
      from_volume_cc: null,
      from_origin: null,
      to_volume_cc: 1800,
      to_origin: 'imported',
      by: admin,
    },
    {
      trim: null,
      action: 'changed',
      from_volume_cc: 1800,
      from_origin: 'imported',
      to_volume_cc: 2000,
      to_origin: 'imported',
      by: admin,
    },
    {
      trim: trimId,
      action: 'added',
      from_volume_cc: null,
      from_origin: null,
      to_volume_cc: 1200,
      to_origin: null,
      by: admin,
    },
    {
      trim: null,
      action: 'removed',
      from_volume_cc: 2000,
      from_origin: 'imported',
      to_volume_cc: null,
      to_origin: null,
      by: admin,
    },
  ]);
  const { rows: left } = await db.query<{ trim: number | null; source: string }>(
    `SELECT trim_id::int AS trim, source FROM model_spec WHERE model_id = $1`,
    [modelId],
  );
  expect(left).toEqual([{ trim: trimId, source: 'superadmin' }]);
});

test('a volume is 500 to 9,000 cc and an origin is one of three; a row says something', async () => {
  const { admin, modelId } = await fixtures();
  const refused = async (volume: number | null, origin: string | null, constraint: string) => {
    expect(
      await failure(`SELECT set_model_spec($1, NULL, $2, $3, $4)`, [modelId, volume, origin, admin]),
    ).toMatchObject({
      code: '23514',
      constraint,
    });
  };
  await refused(499, null, 'model_spec_engine_volume_cc_range');
  await refused(9001, null, 'model_spec_engine_volume_cc_range');
  await refused(0, null, 'model_spec_engine_volume_cc_range');
  await refused(1600, 'foreign', 'model_spec_car_origin_valid');
  expect(await setSpec(modelId, null, 500, null, admin)).toBe('changed');
  expect(await setSpec(modelId, null, 9000, 'domestic', admin)).toBe('changed');
  expect(await setSpec(modelId, null, null, 'joint_venture', admin)).toBe('changed');
  expect(
    await failure(`INSERT INTO model_spec (model_id, source) VALUES ($1, 'seed')`, [modelId]),
  ).toMatchObject({ code: '23514', constraint: 'model_spec_says_something' });
  expect(
    await failure(`UPDATE model_spec SET set_by_account_id = NULL WHERE model_id = $1`, [modelId]),
  ).toMatchObject({
    code: '23514',
    constraint: 'model_spec_source_matches_setter',
  });
});

test('a trim must belong to the model, one row per scope, and only a superadmin changes a spec', async () => {
  const { admin, buyer, modelId, otherTrimId } = await fixtures();
  expect(await setSpec(modelId, otherTrimId, 1600, null, admin)).toBe('missing');
  expect(await failure(`SELECT set_model_spec($1, NULL, 1600, NULL, $2)`, [modelId, buyer])).toMatchObject({
    code: '23514',
    constraint: 'model_spec_by_superadmin',
  });
  await setSpec(modelId, null, 1600, null, admin);
  expect(
    await failure(`INSERT INTO model_spec (model_id, engine_volume_cc, source) VALUES ($1, 1700, 'seed')`, [
      modelId,
    ]),
  ).toMatchObject({ code: '23505', constraint: 'model_spec_once_per_scope_unique' });
  expect(
    await failure(
      `INSERT INTO model_spec (model_id, trim_id, engine_volume_cc, source) VALUES ($1, $2, 1700, 'seed')`,
      [modelId, otherTrimId],
    ),
  ).toMatchObject({ code: '23503', constraint: 'model_spec_trim_fk' });
});

test('the change record cannot be rewritten, and the roles see what they should', async () => {
  const { admin, modelId } = await fixtures();
  await setSpec(modelId, null, 1600, 'domestic', admin);
  expect(await failure(`DELETE FROM model_spec_change`)).toBeDefined();
  expect(await failure(`UPDATE model_spec_change SET to_volume_cc = 2000`)).toBeDefined();
  await db.exec('SET LOCAL ROLE carshenas_web');
  await db.query(`SELECT model_id, trim_id, engine_volume_cc, car_origin FROM model_spec`);
  expect(await failure(`SELECT set_by_account_id FROM model_spec`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT * FROM model_spec_change`)).toMatchObject({ code: '42501' });
  expect(await failure(`DELETE FROM model_spec`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT set_model_spec($1, NULL, NULL, NULL, $2)`, [modelId, admin])).toMatchObject({
    code: '42501',
  });
  await db.exec('RESET ROLE');
  await db.exec('SET LOCAL ROLE carshenas_admin');
  await db.query(`SELECT * FROM model_spec`);
  expect(await failure(`UPDATE model_spec SET engine_volume_cc = 2000`)).toMatchObject({ code: '42501' });
  expect(await setSpec(modelId, null, null, null, admin)).toBe('changed');
  await db.exec('RESET ROLE');
});

test("a listing inherits its own volume, else its trim's, else its model's, and the origin from its trim, else its model", async () => {
  const { admin, makeId, modelId, trimId, otherModelId, otherTrimId } = await fixtures();
  const own = await listing({ makeId, modelId, trimId }, 1830);
  const viaTrim = await listing({ makeId, modelId, trimId }, null);
  const viaModel = await listing({ makeId, modelId }, null);
  const nothing = await listing({ makeId, modelId: otherModelId, trimId: otherTrimId }, null);
  // Nothing says anything yet.
  expect(await inherited(viaTrim)).toEqual({ engine_volume_cc: null, car_origin: null });
  expect(await inherited(own)).toEqual({ engine_volume_cc: 1830, car_origin: null });
  await setSpec(modelId, null, 1600, 'imported', admin);
  expect(await inherited(viaModel)).toEqual({ engine_volume_cc: 1600, car_origin: 'imported' });
  // The trim has a volume only: it beats the model's volume and inherits the model's origin.
  await setSpec(modelId, trimId, 1800, null, admin);
  expect(await inherited(viaTrim)).toEqual({ engine_volume_cc: 1800, car_origin: 'imported' });
  // The model's trims now differ from its volume: a listing that names no trim has no known volume, never a guess.
  expect(await inherited(viaModel)).toEqual({ engine_volume_cc: null, car_origin: 'imported' });
  // A trim's own origin beats the model's.
  await setSpec(modelId, trimId, 1800, 'joint_venture', admin);
  expect(await inherited(viaTrim)).toEqual({ engine_volume_cc: 1800, car_origin: 'joint_venture' });
  // The listing's own volume beats both.
  expect(await inherited(own)).toEqual({ engine_volume_cc: 1830, car_origin: 'joint_venture' });
  // Another model is untouched, and a removed trim row falls back to the model.
  expect(await inherited(nothing)).toEqual({ engine_volume_cc: null, car_origin: null });
  await setSpec(modelId, trimId, null, null, admin);
  expect(await inherited(viaTrim)).toEqual({ engine_volume_cc: 1600, car_origin: 'imported' });
});

test("a listing's own volume is 500 to 9,000 cc", async () => {
  const { makeId, modelId } = await fixtures();
  const id = await listing({ makeId, modelId }, null);
  expect(await failure(`UPDATE listing SET engine_volume_cc = 100 WHERE id = $1`, [id])).toMatchObject({
    code: '23514',
    constraint: 'listing_engine_volume_cc_range',
  });
  expect(await failure(`UPDATE listing SET engine_volume_cc = 9001 WHERE id = $1`, [id])).toMatchObject({
    code: '23514',
    constraint: 'listing_engine_volume_cc_range',
  });
});

test('a change of a spec marks the listings it covers for the next search refresh, and no others', async () => {
  const { admin, makeId, modelId, trimId, otherModelId } = await fixtures();
  const inTrim = await listing({ makeId, modelId, trimId }, null);
  const inModel = await listing({ makeId, modelId }, null);
  const elsewhere = await listing({ makeId, modelId: otherModelId }, null);
  const marked = async () => {
    const { rows } = await db.query<{ id: number }>(
      `SELECT DISTINCT listing_id::int AS id FROM search_document_stale ORDER BY 1`,
    );
    return rows.map((row) => row.id);
  };
  await db.exec('DELETE FROM search_document_stale');
  // A trim's row can change whether the model's volume still stands, so every listing of the model is marked, once each.
  await setSpec(modelId, trimId, 1800, null, admin);
  expect(await marked()).toEqual([inTrim, inModel].sort((a, b) => a - b));
  const { rows: counted } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM search_document_stale`,
  );
  expect(counted[0]?.n).toBe(2);
  expect(await marked()).not.toContain(elsewhere);
  // A model's volume and a trim that agrees with it: the listing that names no trim keeps the model's volume.
  await setSpec(modelId, null, 1600, null, admin);
  await setSpec(modelId, trimId, 1600, null, admin);
  expect(await inherited(inModel)).toEqual({ engine_volume_cc: 1600, car_origin: null });
  // One statement that changes many rows marks each listing once.
  await db.exec('DELETE FROM search_document_stale');
  await db.query('UPDATE model_spec SET engine_volume_cc = 1700 WHERE model_id = $1', [modelId]);
  const { rows: burst } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM search_document_stale`,
  );
  expect(burst[0]?.n).toBe(2);
});
