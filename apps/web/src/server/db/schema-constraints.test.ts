// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createMigratedDatabase } from '@/server/db/schema-test-database';

// The rules the schema itself enforces, proved by what PostgreSQL rejects: each bad row must fail with the expected
// SQLSTATE and constraint name, because code maps exactly that pair to a result (database-errors.ts). Every test
// runs inside a transaction that is rolled back, on a database migrated from db/migrations.

let db: PGlite;
let seeded: { policyCheckId: number; crawlRunId: number; listingId: number; snapshotId: number };

beforeAll(async () => {
  db = await createMigratedDatabase();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec('BEGIN');
  seeded = await seed();
});

afterEach(async () => {
  await db.exec('ROLLBACK');
});

async function returningId(statement: string, params: unknown[] = []): Promise<number> {
  const { rows } = await db.query<{ id: number | bigint }>(statement, params);
  const [row] = rows;
  if (!row) throw new Error(`no row returned: ${statement}`);
  return Number(row.id);
}

async function seed() {
  await db.exec(`
    INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, crawl_state, min_request_interval_ms)
    VALUES ('bama', 'external', 'crawl', 'باما', 'https://bama.ir', 'public', 'enabled', 3000),
           ('karnameh', 'external', 'crawl', 'کارنامه', 'https://karnameh.com', 'public', 'paused', 3000),
           ('partner_api', 'external', 'official_api', 'شریک', 'https://partner.example', 'requester_only', 'paused', NULL),
           ('price_table', 'benchmark', 'crawl', 'جدول قیمت', 'https://prices.example', 'public', 'paused', 5000);
  `);
  const policyCheckId = await returningId(`
    INSERT INTO source_policy_check (source_id, checked_at, checked_by, terms_summary, verdict, photos_allowed)
    VALUES ('bama', now(), 'owner', 'Listing pages allowed by robots.txt; terms read.', 'allowed', true)
    RETURNING id`);
  const crawlRunId = await returningId(
    `INSERT INTO crawl_run (source_id, policy_check_id) VALUES ('bama', $1) RETURNING id`,
    [policyCheckId],
  );
  const listingId = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
    VALUES ('bama', 'ad-1001', 'https://bama.ir/car/ad-1001', 'active', now(), now())
    RETURNING id`);
  const snapshotId = await returningId(
    `INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload)
     VALUES ($1, now(), 'https://bama.ir/car/ad-1001', 1, '{"title": "پژو ۲۰۶ تیپ ۲"}') RETURNING id`,
    [listingId],
  );
  await db.query(
    `INSERT INTO fetch_log (source_id, crawl_run_id, url, http_status, outcome, listing_id, snapshot_id)
     VALUES ('bama', $1, 'https://bama.ir/car/ad-1001', 200, 'ok', $2, $3)`,
    [crawlRunId, listingId, snapshotId],
  );
  return { policyCheckId, crawlRunId, listingId, snapshotId };
}

/** Runs a statement that must fail, inside a savepoint so the test's transaction survives, and returns the error. */
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

async function count(statement: string, params: unknown[] = []): Promise<number> {
  const { rows } = await db.query<{ count: number | bigint }>(statement, params);
  return Number(rows[0]?.count);
}

test('a crawled source waits at least three seconds between requests (ADR-0008 point 5)', async () => {
  expect(await failure(`UPDATE source SET min_request_interval_ms = 1000 WHERE id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'source_crawl_interval_floor',
  });
  // A missing interval is not a way around the floor (a CHECK passes when its expression is NULL).
  expect(await failure(`UPDATE source SET min_request_interval_ms = NULL WHERE id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'source_crawl_interval_floor',
  });
});

test('a source read through an official partner API can never be switched to crawling', async () => {
  expect(await failure(`UPDATE source SET crawl_state = 'enabled' WHERE id = 'partner_api'`)).toMatchObject({
    code: '23514',
    constraint: 'source_only_crawled_sources_run',
  });
});

test('a source stopped on a block records when and why (ADR-0008 point 6)', async () => {
  expect(await failure(`UPDATE source SET crawl_state = 'stopped_on_block' WHERE id = 'bama'`)).toMatchObject(
    {
      code: '23514',
      constraint: 'source_stop_recorded',
    },
  );
  await db.query(
    `UPDATE source SET crawl_state = 'stopped_on_block', stopped_at = now(), stop_reason = 'rate_limited' WHERE id = 'bama'`,
  );
  expect(await failure(`UPDATE source SET crawl_state = 'enabled' WHERE id = 'bama'`)).toMatchObject({
    constraint: 'source_stop_recorded',
  });
});

test('source codes and origins follow their rules', async () => {
  expect(
    await failure(`INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, min_request_interval_ms)
                   VALUES ('Bama2', 'external', 'crawl', 'باما', 'https://bama.ir', 'public', 3000)`),
  ).toMatchObject({ code: '23514', constraint: 'source_id_format' });
  expect(
    await failure(`INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, min_request_interval_ms)
                   VALUES ('carshenas', 'native', 'crawl', 'کارشناس', 'https://carshenas.ir', 'public', 3000)`),
  ).toMatchObject({ code: '23514', constraint: 'source_native_iff_native_access' });
});

test('a policy check states its conditions and never allows photos from a source that forbids crawling', async () => {
  const insert = `INSERT INTO source_policy_check (source_id, checked_at, checked_by, terms_summary, verdict, photos_allowed)
                  VALUES ('bama', now(), 'owner', 'Read.', $1, $2)`;
  expect(await failure(insert, ['allowed_with_conditions', false])).toMatchObject({
    code: '23514',
    constraint: 'source_policy_check_conditions_stated',
  });
  expect(await failure(insert, ['not_allowed', true])).toMatchObject({
    code: '23514',
    constraint: 'source_policy_check_not_allowed_no_photos',
  });
  expect(
    await failure(
      `INSERT INTO source_policy_check (source_id, checked_at, checked_by, terms_summary, verdict, conditions, photos_allowed)
       VALUES ('bama', now(), 'owner', 'Read.', 'allowed_with_conditions', '   ', false)`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'source_policy_check_conditions_not_blank' });
});

test('policy checks, fetches and snapshots are append-only outside a purge', async () => {
  expect(
    await failure(`UPDATE source_policy_check SET verdict = 'not_allowed' WHERE id = $1`, [
      seeded.policyCheckId,
    ]),
  ).toMatchObject({ code: '23000', constraint: 'source_policy_check_append_only' });
  expect(await failure(`DELETE FROM fetch_log WHERE crawl_run_id = $1`, [seeded.crawlRunId])).toMatchObject({
    code: '23000',
    constraint: 'fetch_log_append_only',
  });
  expect(
    await failure(`UPDATE snapshot SET payload = '{"title": "x"}' WHERE id = $1`, [seeded.snapshotId]),
  ).toMatchObject({ code: '23000', constraint: 'snapshot_append_only' });
  // A listing's fetches and snapshots make deleting it fail too, until a purge says otherwise.
  const error = await failure(`DELETE FROM listing WHERE id = $1`, [seeded.listingId]);
  expect(error).toMatchObject({ code: '23000' });
  expect(['fetch_log_append_only', 'snapshot_append_only']).toContain(
    (error as { constraint?: string }).constraint,
  );
});

test('a purge for a removal request deletes a listing with its snapshots and fetches (ADR-0008 point 8)', async () => {
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.query(`DELETE FROM listing WHERE id = $1`, [seeded.listingId]);
  expect(await count(`SELECT count(*) FROM snapshot WHERE listing_id = $1`, [seeded.listingId])).toBe(0);
  expect(await count(`SELECT count(*) FROM fetch_log WHERE listing_id = $1`, [seeded.listingId])).toBe(0);
});

test('one listing per source key, so the crawler upserts on it', async () => {
  const insert = `INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
                  VALUES ('bama', 'ad-1001', 'https://bama.ir/car/ad-1001', 'active', now(), now())`;
  expect(await failure(insert)).toMatchObject({ code: '23505', constraint: 'listing_source_key_unique' });
  const { rows } = await db.query<{ id: number | bigint }>(
    `${insert} ON CONFLICT ON CONSTRAINT listing_source_key_unique DO UPDATE SET last_seen_at = now() RETURNING id`,
  );
  expect(Number(rows[0]?.id)).toBe(seeded.listingId);
});

test('a re-crawl can upsert a known listing straight to sold: the lifecycle judges the update, not the proposed insert', async () => {
  const { rows } = await db.query<{ status: string }>(
    `INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, delisted_at, last_seen_at)
     VALUES ('bama', 'ad-1001', 'https://bama.ir/car/ad-1001', 'sold', now(), now(), now())
     ON CONFLICT ON CONSTRAINT listing_source_key_unique
     DO UPDATE SET status = excluded.status, delisted_at = excluded.delisted_at
     RETURNING status`,
  );
  expect(rows[0]?.status).toBe('sold');
});

test('a listing is external until native listings arrive, and cannot claim another origin than its source', async () => {
  expect(
    await failure(
      `INSERT INTO listing (origin, source_id, status, listed_at) VALUES ('native', 'bama', 'active', now())`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'listing_only_external_for_now' });
  expect(
    await failure(`INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
                   VALUES ('bama', 'ad-2', NULL, 'active', now(), now())`),
  ).toMatchObject({ code: '23514', constraint: 'listing_external_identity' });
  expect(
    await failure(`INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
                   VALUES ('price_table', 'row-1', 'https://prices.example/1', 'active', now(), now())`),
  ).toMatchObject({ code: '23503', constraint: 'listing_source_fk' });
  expect(
    await failure(`UPDATE listing SET origin = 'native' WHERE id = $1`, [seeded.listingId]),
  ).toMatchObject({
    code: '23514',
    constraint: 'listing_status_guard',
  });
});

test('market dates agree with the status', async () => {
  expect(await failure(`UPDATE listing SET status = 'sold' WHERE id = $1`, [seeded.listingId])).toMatchObject(
    {
      code: '23514',
      constraint: 'listing_off_market_has_date',
    },
  );
  expect(
    await failure(
      `UPDATE listing SET status = 'sold', delisted_at = listed_at - interval '1 day' WHERE id = $1`,
      [seeded.listingId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'listing_market_dates_ordered' });
  expect(
    await failure(`INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
                   VALUES ('bama', 'ad-5', 'https://bama.ir/car/ad-5', 'active', NULL, now())`),
  ).toMatchObject({ code: '23502', column: 'listed_at' });
  expect(
    await failure(`INSERT INTO listing (source_id, source_listing_key, url, status, listed_at)
                   VALUES ('bama', 'ad-5', 'https://bama.ir/car/ad-5', 'active', now())`),
  ).toMatchObject({ code: '23514', constraint: 'listing_external_was_seen' });
});

test('listing status changes follow listing_status_transition', async () => {
  await db.query(`UPDATE listing SET status = 'sold', delisted_at = now() WHERE id = $1`, [seeded.listingId]);
  expect(
    await failure(`UPDATE listing SET status = 'removed' WHERE id = $1`, [seeded.listingId]),
  ).toMatchObject({
    code: '23514',
    constraint: 'listing_status_guard',
  });
  expect(
    await failure(`INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, delisted_at, last_seen_at)
                   VALUES ('bama', 'ad-3', 'https://bama.ir/car/ad-3', 'sold', now(), now(), now())`),
  ).toMatchObject({ code: '23514', constraint: 'listing_status_guard' });
  // A temporary table named like the rules cannot widen them: the guard reads public.listing_status_transition.
  await db.exec(`CREATE TEMP TABLE listing_status_transition (origin text, from_status text, to_status text);
                 INSERT INTO pg_temp.listing_status_transition VALUES ('external', 'sold', 'removed');`);
  expect(
    await failure(`UPDATE listing SET status = 'removed' WHERE id = $1`, [seeded.listingId]),
  ).toMatchObject({ code: '23514', constraint: 'listing_status_guard' });
  // Relisted under the same key.
  await db.query(`UPDATE listing SET status = 'active', delisted_at = NULL WHERE id = $1`, [
    seeded.listingId,
  ]);
});

test('one running crawl per source, citing a policy check of that source', async () => {
  expect(
    await failure(`INSERT INTO crawl_run (source_id, policy_check_id) VALUES ('bama', $1)`, [
      seeded.policyCheckId,
    ]),
  ).toMatchObject({ code: '23505', constraint: 'crawl_run_running_per_source_unique' });
  expect(
    await failure(`INSERT INTO crawl_run (source_id, policy_check_id) VALUES ('price_table', $1)`, [
      seeded.policyCheckId,
    ]),
  ).toMatchObject({ code: '23503', constraint: 'crawl_run_policy_check_fk' });
  expect(
    await failure(`UPDATE crawl_run SET status = 'succeeded' WHERE id = $1`, [seeded.crawlRunId]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_finished_when_not_running' });
});

test('a fetch points only at a snapshot of its own listing, and only when it got content', async () => {
  const otherListingId = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
    VALUES ('bama', 'ad-4', 'https://bama.ir/car/ad-4', 'active', now(), now()) RETURNING id`);
  const insert = `INSERT INTO fetch_log (source_id, crawl_run_id, url, http_status, outcome, listing_id, snapshot_id)
                  VALUES ('bama', $1, 'https://bama.ir/car/ad-4', $2, $3, $4, $5)`;
  expect(
    await failure(insert, [seeded.crawlRunId, 200, 'ok', otherListingId, seeded.snapshotId]),
  ).toMatchObject({
    code: '23503',
    constraint: 'fetch_log_snapshot_fk',
  });
  expect(
    await failure(insert, [seeded.crawlRunId, 429, 'rate_limited', seeded.listingId, seeded.snapshotId]),
  ).toMatchObject({
    code: '23514',
    constraint: 'fetch_log_snapshot_only_with_content',
  });
  const karnamehListingId = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
    VALUES ('karnameh', 'k-1', 'https://karnameh.com/car/k-1', 'active', now(), now()) RETURNING id`);
  expect(await failure(insert, [seeded.crawlRunId, 200, 'ok', karnamehListingId, null])).toMatchObject({
    code: '23503',
    constraint: 'fetch_log_listing_fk',
  });
});

test('a snapshot is stored once per distinct content, whatever the key order of its JSON', async () => {
  expect(
    await failure(
      `INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload)
       VALUES ($1, now(), 'https://bama.ir/car/ad-1001', 1, '{ "title" :  "پژو ۲۰۶ تیپ ۲" }')`,
      [seeded.listingId],
    ),
  ).toMatchObject({ code: '23505', constraint: 'snapshot_content_unique' });
  expect(
    await failure(
      `INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload)
       VALUES ($1, now(), 'https://bama.ir/car/ad-1001', 1, '["not", "an", "object"]')`,
      [seeded.listingId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'snapshot_payload_is_object' });
  expect(
    await failure(
      `INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload, content_sha256)
       VALUES ($1, now(), 'https://bama.ir/car/ad-1001', 1, '{"a": 1}', '\\x00')`,
      [seeded.listingId],
    ),
  ).toMatchObject({ code: '428C9' });
});

test('the web role reads sources and listings and nothing else; the read-only role reads everything', async () => {
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await count(`SELECT count(*) FROM listing`)).toBe(1);
  expect(await count(`SELECT count(*) FROM source`)).toBe(4);
  expect(await failure(`SELECT id FROM snapshot`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT id FROM fetch_log`)).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE listing SET last_seen_at = now()`)).toMatchObject({ code: '42501' });
  await db.exec('SET LOCAL ROLE carshenas_readonly');
  expect(await count(`SELECT count(*) FROM snapshot`)).toBe(1);
  expect(await failure(`DELETE FROM listing`)).toMatchObject({ code: '42501' });
});

test('a stop time or reason never lingers on a source that is not stopped', async () => {
  expect(await failure(`UPDATE source SET stopped_at = now() WHERE id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'source_stop_recorded',
  });
  expect(await failure(`UPDATE source SET stop_reason = 'blocked' WHERE id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'source_stop_recorded',
  });
});

test('the lifecycle table accepts only statuses a listing can have', async () => {
  expect(
    await failure(
      `INSERT INTO listing_status_transition (origin, from_status, to_status) VALUES ('external', 'activ', 'sold')`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'listing_status_transition_statuses_valid' });
});

test('an expired or gone listing seen again must be reactivated in the same write', async () => {
  await db.query(
    `UPDATE listing SET status = 'gone', delisted_at = last_seen_at + interval '1 hour' WHERE id = $1`,
    [seeded.listingId],
  );
  expect(
    await failure(`UPDATE listing SET last_seen_at = delisted_at + interval '1 day' WHERE id = $1`, [
      seeded.listingId,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'listing_gone_not_seen_since' });
  // What the crawler's upsert does on the conflict path: back to active, delisted_at cleared, sighting recorded.
  const { rows } = await db.query<{ status: string }>(
    `INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
     VALUES ('bama', 'ad-1001', 'https://bama.ir/car/ad-1001', 'active', now(), now() + interval '2 days')
     ON CONFLICT ON CONSTRAINT listing_source_key_unique DO UPDATE SET
       status = CASE WHEN listing.status IN ('expired', 'gone') THEN 'active' ELSE listing.status END,
       delisted_at = CASE WHEN listing.status IN ('expired', 'gone') THEN NULL ELSE listing.delisted_at END,
       last_seen_at = greatest(listing.last_seen_at, excluded.last_seen_at)
     RETURNING status`,
  );
  expect(rows[0]?.status).toBe('active');
});

test('TRUNCATE cannot empty an append-only table outside a purge', async () => {
  expect(await failure(`TRUNCATE fetch_log`)).toMatchObject({
    code: '23000',
    constraint: 'fetch_log_append_only',
  });
  expect(await failure(`TRUNCATE listing CASCADE`)).toMatchObject({ code: '23000' });
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.exec(`TRUNCATE fetch_log`);
  expect(await count(`SELECT count(*) FROM fetch_log`)).toBe(0);
});

test('a lane accounts for its request in flight and explains its cool-down (ADR-0018)', async () => {
  await db.exec(`INSERT INTO crawl_lane (source_id) VALUES ('bama')`);
  expect(
    await failure(`UPDATE crawl_lane SET lease_holder = 'worker-1' WHERE source_id = 'bama'`),
  ).toMatchObject({ code: '23514', constraint: 'crawl_lane_lease_complete' });
  expect(
    await failure(
      `UPDATE crawl_lane SET lease_holder = ' ', lease_until = now() + interval '1 minute' WHERE source_id = 'bama'`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_lane_lease_holder_not_blank' });
  expect(
    await failure(
      `UPDATE crawl_lane SET cooldown_until = now() + interval '1 minute' WHERE source_id = 'bama'`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_lane_cooldown_explained' });
  expect(
    await failure(
      `UPDATE crawl_lane SET cooldown_until = now(), cooldown_reason = 'blocked' WHERE source_id = 'bama'`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_lane_cooldown_reason_valid' });
  expect(await failure(`UPDATE crawl_lane SET failure_streak = -1 WHERE source_id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'crawl_lane_failure_streak_nonnegative',
  });
  expect(await failure(`UPDATE crawl_lane SET cooldowns = -1 WHERE source_id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'crawl_lane_cooldowns_nonnegative',
  });
  expect(await failure(`INSERT INTO crawl_lane (source_id) VALUES ('divar')`)).toMatchObject({
    code: '23503',
    constraint: 'crawl_lane_source_fk',
  });
});

test('stop_source() stops an enabled source once, with when and why, and leaves other states alone', async () => {
  const stop = async (source: string, reason: string) => {
    const { rows } = await db.query<{ stopped: boolean }>(
      `SELECT stop_source($1, $2, timestamptz '2026-09-29 08:00:00+00') AS stopped`,
      [source, reason],
    );
    return rows[0]?.stopped;
  };
  expect(await failure(`SELECT stop_source('bama', 'tired', now())`)).toMatchObject({
    code: '23514',
    constraint: 'source_stop_reason_valid',
  });
  expect(await stop('bama', 'rate_limited')).toBe(true);
  expect(await stop('bama', 'blocked')).toBe(false);
  expect(await stop('karnameh', 'blocked')).toBe(false);
  const { rows } = await db.query<{ id: string; crawl_state: string; stop_reason: string | null }>(
    `SELECT id, crawl_state, stop_reason FROM source WHERE id IN ('bama', 'karnameh') ORDER BY id`,
  );
  expect(rows).toEqual([
    { id: 'bama', crawl_state: 'stopped_on_block', stop_reason: 'rate_limited' },
    { id: 'karnameh', crawl_state: 'paused', stop_reason: null },
  ]);
});

test('the worker role writes what it crawls, never changes an observation or a source, and runs its queue', async () => {
  await db.exec('SET LOCAL ROLE carshenas_worker');
  expect(await count(`SELECT count(*) FROM source`)).toBe(4);
  expect(await count(`SELECT count(*) FROM source_current_policy`)).toBe(1);
  // Identity columns need no grant on their sequence.
  await db.query(
    `INSERT INTO fetch_log (source_id, crawl_run_id, url, http_status, outcome)
     VALUES ('bama', $1, 'https://bama.ir/car/ad-1002', 404, 'not_found')`,
    [seeded.crawlRunId],
  );
  expect(await failure(`UPDATE fetch_log SET http_status = 200`)).toMatchObject({ code: '42501' });
  expect(await failure(`DELETE FROM snapshot`)).toMatchObject({ code: '42501' });
  expect(await failure(`DELETE FROM listing`)).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE source SET crawl_state = 'enabled' WHERE id = 'karnameh'`)).toMatchObject({
    code: '42501',
  });
  await db.query(`INSERT INTO crawl_lane (source_id) VALUES ('bama')`);
  await db.query(
    `UPDATE crawl_lane SET next_request_at = now() + interval '3 seconds' WHERE source_id = 'bama'`,
  );
  expect(await count(`SELECT count(*) FROM pgboss.job`)).toBe(0);
  const { rows } = await db.query<{ stopped: boolean }>(
    `SELECT stop_source('bama', 'blocked', now()) AS stopped`,
  );
  expect(rows[0]?.stopped).toBe(true);
  // That it cannot create temporary tables is a database privilege, tested on the real server
  // (apps/worker/src/db.db.test.ts), as for the web role.
});

test('only the worker may stop a source or pace a lane; the read-only role sees lanes and the queue', async () => {
  await db.exec(`INSERT INTO crawl_lane (source_id) VALUES ('bama')`);
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await failure(`SELECT stop_source('bama', 'blocked', now())`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT source_id FROM crawl_lane`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT id FROM pgboss.job`)).toMatchObject({ code: '42501' });
  await db.exec('SET LOCAL ROLE carshenas_readonly');
  expect(await count(`SELECT count(*) FROM crawl_lane`)).toBe(1);
  expect(await count(`SELECT count(*) FROM pgboss.queue`)).toBe(0);
});
