// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createMigratedDatabase } from '@/server/db/schema-test-database';

// The country of a make and of a model (CS-103, ADR-0041): what the schema enforces about a row, who may change it, that
// every change is recorded, which country a listing is given (its model's row over its make's) and which listings a
// change marks for the next search refresh, proved by what PostgreSQL rejects and returns. Each test runs in a transaction
// that is rolled back.

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
  const peugeot = await returningId(
    `INSERT INTO make (slug, name_en) VALUES ('peugeot', 'Peugeot') RETURNING id`,
  );
  const toyota = await returningId(
    `INSERT INTO make (slug, name_en) VALUES ('toyota', 'Toyota') RETURNING id`,
  );
  const pars = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, 'pars', 'Pars') RETURNING id`,
    [peugeot],
  );
  const p206 = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, '206', '206') RETURNING id`,
    [peugeot],
  );
  const corolla = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, 'corolla', 'Corolla') RETURNING id`,
    [toyota],
  );
  return { admin, buyer, peugeot, toyota, pars, p206, corolla };
}

async function setCountry(
  makeId: number,
  modelId: number | null,
  country: string | null,
  by: number,
): Promise<string | undefined> {
  const { rows } = await db.query<{ outcome: string }>(`SELECT set_country_spec($1, $2, $3, $4) AS outcome`, [
    makeId,
    modelId,
    country,
    by,
  ]);
  return rows[0]?.outcome;
}

let listingNumber = 0;
async function listing(makeId: number, modelId: number): Promise<number> {
  listingNumber += 1;
  return returningId(
    `INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, make_id, model_id,
                          catalogue_match, price_type, asking_price_toman)
     VALUES ('divar', $1, $2, 'active', now(), now(), $3, $4, 'model', 'asking', 1000000000) RETURNING id`,
    [
      `country${String(listingNumber)}`,
      `https://divar.ir/v/country${String(listingNumber)}`,
      makeId,
      modelId,
    ],
  );
}

async function specOf(listingId: number) {
  const { rows } = await db.query<{ country: string | null; country_source: string | null }>(
    `SELECT country, country_source FROM listing_spec WHERE listing_id = $1`,
    [listingId],
  );
  return rows[0];
}

test('the superadmin sets, changes and removes a country through the function, which records who, when and the earlier country', async () => {
  const { admin, peugeot, p206 } = await fixtures();
  expect(await setCountry(peugeot, null, 'fr', admin)).toBe('changed');
  expect(await setCountry(peugeot, null, 'fr', admin)).toBe('unchanged');
  expect(await setCountry(peugeot, null, 'ir', admin)).toBe('changed');
  expect(await setCountry(peugeot, p206, 'de', admin)).toBe('changed');
  expect(await setCountry(peugeot, null, null, admin)).toBe('changed');
  expect(await setCountry(peugeot, null, null, admin)).toBe('unchanged');
  expect(await setCountry(999_999, null, 'jp', admin)).toBe('missing');
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT model_id::int AS model, action, from_country, to_country, by_account_id::int AS by
     FROM country_spec_change WHERE make_id = $1 ORDER BY id`,
    [peugeot],
  );
  expect(rows).toEqual([
    { model: null, action: 'added', from_country: null, to_country: 'fr', by: admin },
    { model: null, action: 'changed', from_country: 'fr', to_country: 'ir', by: admin },
    { model: p206, action: 'added', from_country: null, to_country: 'de', by: admin },
    { model: null, action: 'removed', from_country: 'ir', to_country: null, by: admin },
  ]);
  const { rows: left } = await db.query<{ model: number | null; source: string }>(
    `SELECT model_id::int AS model, source FROM country_spec WHERE make_id = $1`,
    [peugeot],
  );
  expect(left).toEqual([{ model: p206, source: 'superadmin' }]);
});

test('a country is one of the closed list, a model belongs to its make, a scope has one row, and only a superadmin changes it', async () => {
  const { admin, buyer, peugeot, toyota, corolla } = await fixtures();
  expect(await failure(`SELECT set_country_spec($1, NULL, 'xx', $2)`, [peugeot, admin])).toMatchObject({
    code: '23514',
    constraint: 'country_spec_country_valid',
  });
  expect(await failure(`SELECT set_country_spec($1, NULL, 'JP', $2)`, [peugeot, admin])).toMatchObject({
    code: '23514',
    constraint: 'country_spec_country_valid',
  });
  // Another make's model is missing, never silently attached.
  expect(await setCountry(peugeot, corolla, 'jp', admin)).toBe('missing');
  expect(await failure(`SELECT set_country_spec($1, NULL, 'fr', $2)`, [peugeot, buyer])).toMatchObject({
    code: '23514',
    constraint: 'country_spec_by_superadmin',
  });
  await setCountry(toyota, null, 'jp', admin);
  expect(
    await failure(`INSERT INTO country_spec (make_id, country, source) VALUES ($1, 'kr', 'seed')`, [toyota]),
  ).toMatchObject({ code: '23505', constraint: 'country_spec_once_per_scope_unique' });
  // A row whose model is another make's breaks the composite key.
  expect(
    await failure(
      `INSERT INTO country_spec (make_id, model_id, country, source) VALUES ($1, $2, 'kr', 'seed')`,
      [peugeot, corolla],
    ),
  ).toMatchObject({ code: '23503', constraint: 'country_spec_model_fk' });
  expect(
    await failure(`UPDATE country_spec SET set_by_account_id = NULL WHERE make_id = $1`, [toyota]),
  ).toMatchObject({
    code: '23514',
    constraint: 'country_spec_source_matches_setter',
  });
});

test('the change record cannot be rewritten, and the roles see what they should', async () => {
  const { admin, peugeot } = await fixtures();
  await setCountry(peugeot, null, 'fr', admin);
  expect(await failure(`DELETE FROM country_spec_change`)).toBeDefined();
  expect(await failure(`UPDATE country_spec_change SET to_country = 'jp'`)).toBeDefined();
  await db.exec('SET LOCAL ROLE carshenas_web');
  await db.query(`SELECT make_id, model_id, country FROM country_spec`);
  expect(await failure(`SELECT set_by_account_id FROM country_spec`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT * FROM country_spec_change`)).toMatchObject({ code: '42501' });
  expect(await failure(`DELETE FROM country_spec`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT set_country_spec($1, NULL, NULL, $2)`, [peugeot, admin])).toMatchObject({
    code: '42501',
  });
  await db.query(`SELECT country FROM listing_spec LIMIT 1`);
  await db.exec('RESET ROLE');
  await db.exec('SET LOCAL ROLE carshenas_admin');
  await db.query(`SELECT * FROM country_spec`);
  expect(await failure(`UPDATE country_spec SET country = 'jp'`)).toMatchObject({ code: '42501' });
  expect(await setCountry(peugeot, null, null, admin)).toBe('changed');
  await db.exec('RESET ROLE');
});

test("a listing is given its model's country, else its make's, whoever assembled the car", async () => {
  const { admin, peugeot, toyota, pars, p206, corolla } = await fixtures();
  const parsListing = await listing(peugeot, pars);
  const p206Listing = await listing(peugeot, p206);
  const corollaListing = await listing(toyota, corolla);
  expect(await specOf(parsListing)).toEqual({ country: null, country_source: null });
  await setCountry(peugeot, null, 'fr', admin);
  await setCountry(toyota, null, 'jp', admin);
  expect(await specOf(parsListing)).toEqual({ country: 'fr', country_source: 'make' });
  expect(await specOf(corollaListing)).toEqual({ country: 'jp', country_source: 'make' });
  // A model's own row corrects its make's, for that model alone.
  await setCountry(peugeot, p206, 'ir', admin);
  expect(await specOf(p206Listing)).toEqual({ country: 'ir', country_source: 'model' });
  expect(await specOf(parsListing)).toEqual({ country: 'fr', country_source: 'make' });
  // Removing the model's row falls back to the make's.
  await setCountry(peugeot, p206, null, admin);
  expect(await specOf(p206Listing)).toEqual({ country: 'fr', country_source: 'make' });
  // And search reads it from the same view.
  const { rows } = await db.query<{ country: string | null }>(
    `SELECT country FROM listing_filter_row WHERE listing_id = $1`,
    [corollaListing],
  );
  expect(rows[0]?.country).toBe('jp');
});

test('a change marks the listings it covers for the next search refresh, once each, and no others', async () => {
  const { admin, peugeot, toyota, pars, p206, corolla } = await fixtures();
  const parsListing = await listing(peugeot, pars);
  const p206Listing = await listing(peugeot, p206);
  const corollaListing = await listing(toyota, corolla);
  const marked = async () => {
    const { rows } = await db.query<{ id: number }>(
      `SELECT listing_id::int AS id FROM search_document_stale ORDER BY 1`,
    );
    return rows.map((row) => row.id);
  };
  await db.exec('DELETE FROM search_document_stale');
  // A make's row covers every listing of the make.
  await setCountry(peugeot, null, 'fr', admin);
  expect(await marked()).toEqual([parsListing, p206Listing].sort((a, b) => a - b));
  // A model's row, that model's listings only.
  await db.exec('DELETE FROM search_document_stale');
  await setCountry(peugeot, p206, 'ir', admin);
  expect(await marked()).toEqual([p206Listing]);
  expect(await marked()).not.toContain(corollaListing);
  // One statement that changes many rows marks each listing once.
  await db.exec('DELETE FROM search_document_stale');
  await db.query(`UPDATE country_spec SET country = 'it' WHERE make_id = $1`, [peugeot]);
  expect(await marked()).toEqual([parsListing, p206Listing].sort((a, b) => a - b));
});
