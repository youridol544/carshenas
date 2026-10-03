import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, inject, test } from 'vitest';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';

// A file joining a request while the superadmin declines it (CS-71, review): the join trigger takes the request row
// FOR SHARE, so with two real sessions the join waits for the decision's transaction and, once it commits, is refused
// as a join to a declined request, never slipping in between the decision and its commit.

const owner = ownerDatabase();

beforeAll(async () => {
  await assertScratchDatabase(owner);
});
afterAll(async () => {
  await owner.destroy();
});

async function session(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: inject('databaseMigrateUrl') });
  await client.connect();
  return client;
}

test('a join that arrives while a decision holds the request waits for it and is refused if it declined', async () => {
  const token = randomBytes(4).toString('hex');
  const { id: makeId } = await owner
    .insertInto('make')
    .values({ slug: `r${token}`, name_en: 'Race' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const { id: modelId } = await owner
    .insertInto('model')
    .values({ make_id: makeId, slug: `r${token}`, name_en: 'Race model' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const admin = await createAccount(owner, 'superadmin');
  const buyer = await createAccount(owner);
  const { id: fileId } = await owner
    .insertInto('search_file')
    .values({ account_id: buyer.id, name: 'پرونده', search: { v: 1, filters: {}, q: token } })
    .returning('id')
    .executeTakeFirstOrThrow();
  const { id: requestId } = await owner
    .insertInto('crawl_request')
    .values({ model_id: modelId })
    .returning('id')
    .executeTakeFirstOrThrow();

  const deciding = await session();
  const joining = await session();
  try {
    await deciding.query('BEGIN');
    await deciding.query(`SELECT decide_crawl_request($1, 'pending', 'declined', 'ظرفیت', $2)`, [
      requestId,
      admin.id,
    ]);
    // The join starts while the decision's transaction is open: it must not finish yet.
    let settled = false;
    const join = joining
      .query(`INSERT INTO crawl_request_file (crawl_request_id, search_file_id) VALUES ($1, $2)`, [
        requestId,
        fileId,
      ])
      .then(
        () => 'joined',
        (error: unknown) => (error instanceof pg.DatabaseError ? (error.constraint ?? 'error') : 'error'),
      )
      .finally(() => {
        settled = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(settled).toBe(false);
    await deciding.query('COMMIT');
    expect(await join).toBe('crawl_request_file_not_declined');
    const links = await owner
      .selectFrom('crawl_request_file')
      .select('search_file_id')
      .where('crawl_request_id', '=', requestId)
      .execute();
    expect(links).toEqual([]);
  } finally {
    await deciding.end();
    await joining.end();
  }
});
