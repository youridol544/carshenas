import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, expect, inject, test } from 'vitest';
import { constraintViolation, SQLSTATE } from '@carshenas/db/database-errors';
import type { DB } from '@carshenas/db/db-types';

// The driver's errors through Kysely, mapped by SQLSTATE and constraint name. Rows are written as the owner inside
// a transaction that is always rolled back, and only on a scratch database.

const owner = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString: inject('databaseMigrateUrl'), max: 1 }),
  }),
});

class RollBack extends Error {}

/** Runs body in a transaction that is rolled back whatever happens, and returns what body returned. */
async function inRolledBackTransaction<T>(body: (trx: Transaction<DB>) => Promise<T>): Promise<T> {
  let result: T | undefined;
  await owner
    .transaction()
    .execute(async (trx) => {
      result = await body(trx);
      throw new RollBack();
    })
    .catch((error: unknown) => {
      if (!(error instanceof RollBack)) throw error;
    });
  return result as T;
}

async function errorOf(statement: Promise<unknown>): Promise<unknown> {
  return statement.then(
    () => undefined,
    (error: unknown) => error,
  );
}

beforeAll(async () => {
  const { rows } = await sql<{ name: string }>`SELECT current_database() AS name`.execute(owner);
  const name = rows[0]?.name ?? '';
  if (!/_(check|test)$/.test(name))
    throw new Error(`refusing to write test rows into ${name}: run pnpm db:check`);
});

afterAll(async () => {
  await owner.destroy();
});

test('a unique, check or foreign-key violation maps to its SQLSTATE and constraint name', async () => {
  const errors = await inRolledBackTransaction(async (trx) => {
    const source = {
      id: 'bama',
      origin: 'external',
      access_method: 'crawl',
      name_fa: 'باما',
      base_url: 'https://bama.ir',
      listing_visibility: 'public',
      min_request_interval_ms: 3000,
      daily_request_budget: 12000,
    } as const;
    await trx.insertInto('source').values(source).execute();
    await trx.executeQuery(sql`SAVEPOINT duplicate`.compile(trx));
    const unique = await errorOf(trx.insertInto('source').values(source).execute());
    await trx.executeQuery(sql`ROLLBACK TO SAVEPOINT duplicate`.compile(trx));
    const check = await errorOf(
      trx.updateTable('source').set({ min_request_interval_ms: 500 }).where('id', '=', 'bama').execute(),
    );
    return { unique, check };
  });
  expect(constraintViolation(errors.unique)).toEqual({
    code: SQLSTATE.uniqueViolation,
    constraint: 'source_pkey',
    table: 'source',
  });
  expect(constraintViolation(errors.check)).toEqual({
    code: SQLSTATE.checkViolation,
    constraint: 'source_crawl_interval_floor',
    table: 'source',
  });

  const foreignKey = await inRolledBackTransaction((trx) =>
    errorOf(
      trx
        .insertInto('listing')
        .values({
          source_id: 'nowhere',
          source_listing_key: 'ad-1',
          url: 'https://nowhere.example/1',
          status: 'active',
          listed_at: new Date(),
          last_seen_at: new Date(),
        })
        .execute(),
    ),
  );
  expect(constraintViolation(foreignKey)).toEqual({
    code: SQLSTATE.foreignKeyViolation,
    constraint: 'listing_source_fk',
    table: 'listing',
  });
});

test('a delete blocked by ON DELETE RESTRICT maps to 23001 and the foreign key', async () => {
  const restricted = await inRolledBackTransaction(async (trx) => {
    await trx
      .insertInto('source')
      .values({
        id: 'bama',
        origin: 'external',
        access_method: 'crawl',
        name_fa: 'باما',
        base_url: 'https://bama.ir',
        listing_visibility: 'public',
        min_request_interval_ms: 3000,
        daily_request_budget: 12000,
      })
      .execute();
    await trx
      .insertInto('source_policy_check')
      .values({
        source_id: 'bama',
        checked_at: new Date(),
        checked_by: 'test',
        terms_summary: 'Read.',
        verdict: 'allowed',
        photos_allowed: false,
      })
      .execute();
    return errorOf(trx.deleteFrom('source').where('id', '=', 'bama').execute());
  });
  expect(constraintViolation(restricted)).toMatchObject({
    code: SQLSTATE.restrictViolation,
    constraint: 'source_policy_check_source_fk',
  });
});

test('a NOT NULL violation maps by column, because PostgreSQL 18 names no constraint for it', async () => {
  const notNull = await inRolledBackTransaction((trx) =>
    errorOf(
      trx
        .insertInto('source')
        .values({
          id: 'bama',
          origin: 'external',
          access_method: 'crawl',
          name_fa: sql<string>`NULL`,
          base_url: 'https://bama.ir',
          listing_visibility: 'public',
          min_request_interval_ms: 3000,
          daily_request_budget: 12000,
        })
        .execute(),
    ),
  );
  expect(constraintViolation(notNull)).toEqual({
    code: SQLSTATE.notNullViolation,
    column: 'name_fa',
    table: 'source',
  });
});

test('our append-only trigger maps like a constraint, and non-integrity errors map to nothing', async () => {
  const appendOnly = await inRolledBackTransaction(async (trx) => {
    await trx
      .insertInto('source')
      .values({
        id: 'bama',
        origin: 'external',
        access_method: 'crawl',
        name_fa: 'باما',
        base_url: 'https://bama.ir',
        listing_visibility: 'public',
        min_request_interval_ms: 3000,
        daily_request_budget: 12000,
      })
      .execute();
    await trx
      .insertInto('source_policy_check')
      .values({
        source_id: 'bama',
        checked_at: new Date(),
        checked_by: 'test',
        terms_summary: 'Read.',
        verdict: 'allowed',
        photos_allowed: false,
      })
      .execute();
    return errorOf(trx.updateTable('source_policy_check').set({ verdict: 'not_allowed' }).execute());
  });
  expect(constraintViolation(appendOnly)).toEqual({
    code: SQLSTATE.integrityConstraintViolation,
    constraint: 'source_policy_check_append_only',
    table: 'source_policy_check',
  });

  const syntax = await errorOf(sql`SELECT FROM`.execute(owner));
  expect(syntax).toBeInstanceOf(pg.DatabaseError);
  expect(constraintViolation(syntax)).toBeUndefined();
  expect(constraintViolation(new Error('not from the database'))).toBeUndefined();
});

test('bigint values arrive as numbers through the app pool parser, not as strings', async () => {
  // The owner pool here has pg's default parsers; the app's pool (database.ts) is what parses int8 to number.
  const { database } = await import('@/server/db/database');
  const { rows } = await sql<{ big: number }>`SELECT 9007199254740991::bigint AS big`.execute(database());
  expect(rows[0]?.big).toBe(Number.MAX_SAFE_INTEGER);
  const overflow = await errorOf(sql`SELECT 9007199254740993::bigint AS big`.execute(database()));
  expect(overflow).toBeInstanceOf(RangeError);
  await database().destroy();
});
