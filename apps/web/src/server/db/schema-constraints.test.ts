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
    INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, crawl_state, min_request_interval_ms,
                        daily_request_budget)
    VALUES ('bama', 'external', 'crawl', 'باما', 'https://bama.ir', 'public', 'enabled', 3000, 12000),
           ('karnameh', 'external', 'crawl', 'کارنامه', 'https://karnameh.com', 'public', 'paused', 3000, 12000),
           ('partner_api', 'external', 'official_api', 'شریک', 'https://partner.example', 'requester_only', 'paused', NULL, NULL),
           ('price_table', 'benchmark', 'crawl', 'جدول قیمت', 'https://prices.example', 'public', 'paused', 5000, 100);
  `);
  const policyCheckId = await returningId(`
    INSERT INTO source_policy_check (source_id, checked_at, checked_by, terms_summary, verdict, photos_allowed)
    VALUES ('bama', now(), 'owner', 'Listing pages allowed by robots.txt; terms read.', 'allowed', true)
    RETURNING id`);
  const crawlRunId = await returningId(
    `INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ('bama', $1, 'detail') RETURNING id`,
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
    await failure(`INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, min_request_interval_ms, daily_request_budget)
                   VALUES ('Bama2', 'external', 'crawl', 'باما', 'https://bama.ir', 'public', 3000, 12000)`),
  ).toMatchObject({ code: '23514', constraint: 'source_id_format' });
  expect(
    await failure(`INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, min_request_interval_ms, daily_request_budget)
                   VALUES ('carshenas', 'native', 'crawl', 'کارشناس', 'https://carshenas.ir', 'public', 3000, 12000)`),
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
    await failure(`INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ('bama', $1, 'detail')`, [
      seeded.policyCheckId,
    ]),
  ).toMatchObject({ code: '23505', constraint: 'crawl_run_running_per_source_unique' });
  expect(
    await failure(
      `INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ('price_table', $1, 'detail')`,
      [seeded.policyCheckId],
    ),
  ).toMatchObject({ code: '23503', constraint: 'crawl_run_policy_check_fk' });
  expect(
    await failure(`UPDATE crawl_run SET status = 'succeeded' WHERE id = $1`, [seeded.crawlRunId]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_finished_when_not_running' });
});

test('a fetch points only at a snapshot of its own listing, and only when it got content', async () => {
  const otherListingId = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
    VALUES ('bama', 'ad-4', 'https://bama.ir/car/ad-4', 'active', now(), now()) RETURNING id`);
  const insert = `INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome, listing_id, snapshot_id)
                  VALUES ('bama', $1, 'https://bama.ir/car/ad-4', clock_timestamp(), $2, $3, $4, $5)`;
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
  // The four seeded here and Divar, which its migration adds.
  expect(await count(`SELECT count(*) FROM source`)).toBe(5);
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
  // Price events may cite a fetch (CS-35), so emptying fetch_log names them too.
  expect(await failure(`TRUNCATE fetch_log CASCADE`)).toMatchObject({
    code: '23000',
    constraint: 'fetch_log_append_only',
  });
  expect(await failure(`TRUNCATE listing CASCADE`)).toMatchObject({ code: '23000' });
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.exec(`TRUNCATE fetch_log CASCADE`);
  expect(await count(`SELECT count(*) FROM fetch_log`)).toBe(0);
});

test('a lane accounts for its request in flight and explains its cool-down (ADR-0018)', async () => {
  await db.exec(`INSERT INTO crawl_lane (source_id) VALUES ('bama')`);
  expect(
    await failure(`UPDATE crawl_lane SET lease_holder = 'worker-1' WHERE source_id = 'bama'`),
  ).toMatchObject({ code: '23514', constraint: 'crawl_lane_lease_complete' });
  expect(
    await failure(
      `UPDATE crawl_lane SET last_request_at = now(), lease_holder = ' ', lease_until = now() + interval '1 minute'
       WHERE source_id = 'bama'`,
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
  expect(await failure(`INSERT INTO crawl_lane (source_id) VALUES ('nowhere')`)).toMatchObject({
    code: '23503',
    constraint: 'crawl_lane_source_fk',
  });
  // A lease belongs to a request that started, and cannot be taken for hours by mistake.
  expect(
    await failure(
      `UPDATE crawl_lane SET lease_holder = 'worker-1', lease_until = now() + interval '1 minute' WHERE source_id = 'bama'`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_lane_lease_bounded' });
  expect(
    await failure(
      `UPDATE crawl_lane SET last_request_at = now(), lease_holder = 'worker-1', lease_until = now() + interval '2 hours'
       WHERE source_id = 'bama'`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_lane_lease_bounded' });
  // A new lane may send at once: its next request time is when it was created, a real instant.
  const { rows } = await db.query<{ ready: boolean }>(
    `SELECT next_request_at <= now() AND isfinite(next_request_at) AS ready FROM crawl_lane WHERE source_id = 'bama'`,
  );
  expect(rows[0]?.ready).toBe(true);
});

test('stop_source() stops an enabled or paused crawled source once, with when and why, and no other source', async () => {
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
  // Paused while a request was on the wire: its block stops it too (CS-33).
  expect(await stop('karnameh', 'blocked')).toBe(true);
  // A source read through a partner API is never crawled, so never stopped.
  expect(await stop('partner_api', 'blocked')).toBe(false);
  const { rows } = await db.query<{ id: string; crawl_state: string; stop_reason: string | null }>(
    `SELECT id, crawl_state, stop_reason FROM source WHERE id IN ('bama', 'karnameh', 'partner_api') ORDER BY id`,
  );
  expect(rows).toEqual([
    { id: 'bama', crawl_state: 'stopped_on_block', stop_reason: 'rate_limited' },
    { id: 'karnameh', crawl_state: 'stopped_on_block', stop_reason: 'blocked' },
    { id: 'partner_api', crawl_state: 'paused', stop_reason: null },
  ]);
});

test('the worker role writes what it crawls, never changes an observation or a source, and runs its queue', async () => {
  await db.exec('SET LOCAL ROLE carshenas_worker');
  // The four seeded here and Divar, with the policy checks of Bama and Divar.
  expect(await count(`SELECT count(*) FROM source`)).toBe(5);
  expect(await count(`SELECT count(*) FROM source_current_policy`)).toBe(2);
  // Identity columns need no grant on their sequence.
  await db.query(
    `INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome)
     VALUES ('bama', $1, 'https://bama.ir/car/ad-1002', clock_timestamp(), 404, 'not_found')`,
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
  // pg-boss's own bookkeeping: its version row is only stamped, and its migrations never run from the worker.
  await db.query(`UPDATE pgboss.version SET cron_on = now()`);
  expect(await failure(`DELETE FROM pgboss.version`)).toMatchObject({ code: '42501' });
  expect(
    await failure(
      `INSERT INTO pgboss.bam (name, version, status, command, table_name) VALUES ('x', 1, 'pending', 'select 1', 'job')`,
    ),
  ).toMatchObject({ code: '42501' });
  const { rows } = await db.query<{ stopped: boolean }>(
    `SELECT stop_source('bama', 'blocked', now()) AS stopped`,
  );
  expect(rows[0]?.stopped).toBe(true);
  // That it cannot create temporary tables is a database privilege, tested on the real server
  // (apps/worker/src/worker-process.db.test.ts), as for the web role.
});

const AI_ANSWER_INSERT = `
  INSERT INTO ai_answer (cache_key, task, prompt_version, provider, model, answering_model, output, cost_usd_micros)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

/** An ai_answer row as packages/ai writes it, with the given columns replaced: the statement and its values. */
function aiAnswer(overrides: Record<string, unknown> = {}): [string, unknown[]] {
  const row = {
    cache_key: new Uint8Array(32).fill(0xab),
    task: 'listing.facts',
    prompt_version: '0123456789abcdef',
    provider: 'openai',
    model: 'gpt-5.6-luna',
    answering_model: 'gpt-5.6-luna-2026-07-09',
    output: { paint: 'none' },
    cost_usd_micros: 175,
    ...overrides,
  };
  return [
    AI_ANSWER_INSERT,
    [
      row.cache_key,
      row.task,
      row.prompt_version,
      row.provider,
      row.model,
      row.answering_model,
      row.output,
      row.cost_usd_micros,
    ],
  ];
}

test('an AI answer is found by its 32-byte key, names its task, prompt version and route, and holds an object (CS-45)', async () => {
  await db.query(...aiAnswer());
  expect(await failure(...aiAnswer())).toMatchObject({
    code: '23505',
    constraint: 'ai_answer_cache_key_unique',
  });
  const other = (byte: number) => new Uint8Array(32).fill(byte);
  expect(await failure(...aiAnswer({ cache_key: new Uint8Array(31) }))).toMatchObject({
    code: '23514',
    constraint: 'ai_answer_cache_key_is_sha256',
  });
  for (const task of ['Listing.Facts', 'listing facts', 'listing.', '.facts', '', `a${'b'.repeat(100)}`]) {
    expect(await failure(...aiAnswer({ cache_key: other(1), task }))).toMatchObject({
      code: '23514',
      constraint: 'ai_answer_task_format',
    });
  }
  for (const version of ['0123456789ABCDEF', '0123456789abcde', 'v1-0123456789abc']) {
    expect(await failure(...aiAnswer({ cache_key: other(2), prompt_version: version }))).toMatchObject({
      code: '23514',
      constraint: 'ai_answer_prompt_version_format',
    });
  }
  expect(await failure(...aiAnswer({ cache_key: other(3), provider: 'metis' }))).toMatchObject({
    code: '23514',
    constraint: 'ai_answer_provider_valid',
  });
  expect(await failure(...aiAnswer({ cache_key: other(4), model: 'gpt 5' }))).toMatchObject({
    code: '23514',
    constraint: 'ai_answer_model_format',
  });
  expect(await failure(...aiAnswer({ cache_key: other(5), answering_model: '' }))).toMatchObject({
    code: '23514',
    constraint: 'ai_answer_answering_model_format',
  });
  expect(await failure(...aiAnswer({ cache_key: other(6), output: JSON.stringify(['none']) }))).toMatchObject(
    {
      code: '23514',
      constraint: 'ai_answer_output_is_object',
    },
  );
  expect(await failure(...aiAnswer({ cache_key: other(7), cost_usd_micros: -1 }))).toMatchObject({
    code: '23514',
    constraint: 'ai_answer_cost_usd_micros_range',
  });
  // An unpriced answer has no cost, and every route Metis serves is accepted.
  for (const [byte, provider] of [
    [8, 'anthropic'],
    [9, 'google'],
    [10, 'deepseek'],
  ] as const) {
    await db.query(...aiAnswer({ cache_key: other(byte), provider, cost_usd_micros: null }));
  }
});

test('an AI answer is never changed or removed outside a purge, by any role', async () => {
  await db.query(...aiAnswer());
  expect(await failure(`UPDATE ai_answer SET cost_usd_micros = 0`)).toMatchObject({
    code: '23000',
    constraint: 'ai_answer_append_only',
  });
  expect(await failure(`DELETE FROM ai_answer`)).toMatchObject({
    code: '23000',
    constraint: 'ai_answer_append_only',
  });
  // Extractions reference answers since CS-52, so a plain TRUNCATE is refused before the trigger runs; with CASCADE
  // it reaches the trigger, which refuses it as before.
  expect(await failure(`TRUNCATE ai_answer`)).toMatchObject({ code: '0A000' });
  expect(await failure(`TRUNCATE ai_answer CASCADE`)).toMatchObject({
    code: '23000',
    constraint: 'ai_answer_append_only',
  });
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.exec(`DELETE FROM ai_answer`);
  expect(await count(`SELECT count(*) FROM ai_answer`)).toBe(0);
});

test('the worker reads and adds AI answers but never changes one; the web role has none until CS-62', async () => {
  await db.exec('SET LOCAL ROLE carshenas_worker');
  await db.query(...aiAnswer());
  expect(await count(`SELECT count(*) FROM ai_answer`)).toBe(1);
  expect(await failure(`UPDATE ai_answer SET cost_usd_micros = 0`)).toMatchObject({ code: '42501' });
  expect(await failure(`DELETE FROM ai_answer`)).toMatchObject({ code: '42501' });
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await failure(`SELECT id FROM ai_answer`)).toMatchObject({ code: '42501' });
  await db.exec('SET LOCAL ROLE carshenas_readonly');
  expect(await count(`SELECT count(*) FROM ai_answer`)).toBe(1);
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

// Accounts (CS-39, ADR-0020).
const HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';

async function account(username: string, role: 'buyer' | 'superadmin' = 'buyer'): Promise<number> {
  return returningId(`INSERT INTO account (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id`, [
    username,
    HASH,
    role,
  ]);
}

test('a username is stored lowercase, Latin, 3 to 30 characters, starting with a letter, and only once', async () => {
  await account('ali_1403');
  const insert = `INSERT INTO account (username, password_hash) VALUES ($1, $2)`;
  for (const username of ['Ali_1403', 'al', '1ali', 'ali-reza', 'علی', 'a'.repeat(31), ' ali']) {
    expect(await failure(insert, [username, HASH])).toMatchObject({
      code: '23514',
      constraint: 'account_username_format',
    });
  }
  expect(await failure(insert, ['ali_1403', HASH])).toMatchObject({
    code: '23505',
    constraint: 'account_username_unique',
  });
});

test('an account keeps an Argon2id hash, never a password, and a known role', async () => {
  const insert = `INSERT INTO account (username, password_hash, role) VALUES ('reza', $1, $2)`;
  expect(await failure(insert, ['hunter22hunter22', 'buyer'])).toMatchObject({
    code: '23514',
    constraint: 'account_password_hash_argon2id',
  });
  expect(await failure(insert, ['$argon2i$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA', 'buyer'])).toMatchObject({
    constraint: 'account_password_hash_argon2id',
  });
  expect(await failure(insert, [HASH, 'admin'])).toMatchObject({
    code: '23514',
    constraint: 'account_role_valid',
  });
  const { rows } = await db.query<{ role: string }>(
    `INSERT INTO account (username, password_hash) VALUES ('sara', $1) RETURNING role`,
    [HASH],
  );
  expect(rows[0]?.role).toBe('buyer');
});

test('a session keeps a 32-byte token hash once, and ends after it starts and within 30 days', async () => {
  const accountId = await account('ali_1403');
  const insert = `INSERT INTO account_session (account_id, token_sha256, created_at, expires_at)
                  VALUES ($1, $2, now(), now() + $3::interval)`;
  const token = new Uint8Array(32).fill(7);
  await db.query(insert, [accountId, token, '30 days']);
  expect(await failure(insert, [accountId, token, '1 hour'])).toMatchObject({
    code: '23505',
    constraint: 'account_session_token_sha256_unique',
  });
  expect(await failure(insert, [accountId, new Uint8Array(16), '1 hour'])).toMatchObject({
    code: '23514',
    constraint: 'account_session_token_sha256_length',
  });
  for (const lifetime of ['0 seconds', '-1 hour', '721 hours']) {
    expect(await failure(insert, [accountId, new Uint8Array(32).fill(9), lifetime])).toMatchObject({
      code: '23514',
      constraint: 'account_session_lifetime_bounded',
    });
  }
  await db.query(`DELETE FROM account WHERE id = $1`, [accountId]);
  expect(await count(`SELECT count(*) FROM account_session`)).toBe(0);
});

test('a throttle counter is one per scope and keyed hash, with a known scope and no negative count', async () => {
  const insert = `INSERT INTO auth_throttle (scope, subject_hmac, hits) VALUES ($1, $2, $3)`;
  const subject = new Uint8Array(32).fill(1);
  await db.query(insert, ['sign_in_account', subject, 0]);
  await db.query(insert, ['sign_in_address', subject, 0]);
  expect(await failure(insert, ['sign_in_account', subject, 1])).toMatchObject({
    code: '23505',
    constraint: 'auth_throttle_subject_unique',
  });
  expect(await failure(insert, ['sign_in_phone', subject, 0])).toMatchObject({
    code: '23514',
    constraint: 'auth_throttle_scope_valid',
  });
  expect(await failure(insert, ['sign_up_address', new Uint8Array(20), 0])).toMatchObject({
    code: '23514',
    constraint: 'auth_throttle_subject_hmac_length',
  });
  expect(await failure(insert, ['sign_up_address', subject, -1])).toMatchObject({
    code: '23514',
    constraint: 'auth_throttle_hits_nonnegative',
  });
});

test('role changes are recorded once, as real changes by someone, and never edited outside a purge', async () => {
  const accountId = await account('pedram', 'superadmin');
  const insert = `INSERT INTO account_role_change (account_id, from_role, to_role, changed_by) VALUES ($1, $2, $3, $4)`;
  await db.query(insert, [accountId, null, 'superadmin', 'cli:pedram@laptop']);
  expect(await failure(insert, [accountId, 'superadmin', 'superadmin', 'cli:pedram@laptop'])).toMatchObject({
    code: '23514',
    constraint: 'account_role_change_is_change',
  });
  expect(await failure(insert, [accountId, 'buyer', 'owner', 'cli:pedram@laptop'])).toMatchObject({
    code: '23514',
    constraint: 'account_role_change_to_role_valid',
  });
  expect(await failure(insert, [accountId, 'guest', 'buyer', 'cli:pedram@laptop'])).toMatchObject({
    code: '23514',
    constraint: 'account_role_change_from_role_valid',
  });
  expect(await failure(insert, [accountId, 'superadmin', 'buyer', ' '])).toMatchObject({
    code: '23514',
    constraint: 'account_role_change_changed_by_not_blank',
  });
  expect(await failure(`UPDATE account_role_change SET changed_by = 'someone else'`)).toMatchObject({
    code: '23000',
    constraint: 'account_role_change_append_only',
  });
  expect(await failure(`DELETE FROM account WHERE id = $1`, [accountId])).toMatchObject({
    code: '23000',
    constraint: 'account_role_change_append_only',
  });
});

test('the web role signs buyers up and keeps sessions, but can never grant a role or read the role history', async () => {
  const superadminId = await account('pedram', 'superadmin');
  await db.exec('SET LOCAL ROLE carshenas_web');
  const { rows } = await db.query<{ id: number; role: string }>(
    `INSERT INTO account (username, password_hash) VALUES ('ali_1403', $1) RETURNING id, role`,
    [HASH],
  );
  expect(rows[0]?.role).toBe('buyer');
  const buyerId = Number(rows[0]?.id);
  expect(
    await failure(`INSERT INTO account (username, password_hash, role) VALUES ('reza', $1, 'superadmin')`, [
      HASH,
    ]),
  ).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE account SET role = 'superadmin' WHERE id = $1`, [buyerId])).toMatchObject({
    code: '42501',
  });
  expect(
    await failure(`UPDATE account SET username = 'pedram2' WHERE id = $1`, [superadminId]),
  ).toMatchObject({
    code: '42501',
  });
  await db.query(`UPDATE account SET password_hash = $1 WHERE id = $2`, [HASH, buyerId]);
  expect(await failure(`DELETE FROM account WHERE id = $1`, [buyerId])).toMatchObject({ code: '42501' });
  await db.query(
    `INSERT INTO account_session (account_id, token_sha256, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
    [buyerId, new Uint8Array(32).fill(3)],
  );
  await db.query(`DELETE FROM account_session WHERE account_id = $1`, [buyerId]);
  // A session starts by the database's clock, which its lifetime check measures from; the app writes only its end.
  expect(
    await failure(
      `INSERT INTO account_session (account_id, token_sha256, created_at, expires_at)
       VALUES ($1, $2, now() + interval '1 year', now() + interval '1 year 1 hour')`,
      [buyerId, new Uint8Array(32).fill(5)],
    ),
  ).toMatchObject({ code: '42501' });
  await db.query(`INSERT INTO auth_throttle (scope, subject_hmac) VALUES ('sign_up_address', $1)`, [
    new Uint8Array(32).fill(4),
  ]);
  expect(await failure(`SELECT id FROM account_role_change`)).toMatchObject({ code: '42501' });
  expect(
    await failure(
      `INSERT INTO account_role_change (account_id, to_role, changed_by) VALUES ($1, 'superadmin', 'web')`,
      [buyerId],
    ),
  ).toMatchObject({ code: '42501' });
});

test('the read-only role sees accounts but never their password hashes', async () => {
  await account('ali_1403');
  await db.exec('SET LOCAL ROLE carshenas_readonly');
  expect(await count(`SELECT count(*) FROM account`)).toBe(1);
  expect(await count(`SELECT count(username) FROM account`)).toBe(1);
  expect(await failure(`SELECT password_hash FROM account`)).toMatchObject({ code: '42501' });
  expect(await count(`SELECT count(*) FROM account_session`)).toBe(0);
});

test('Divar arrives paused, with the reading of its robots.txt and terms that CS-5 recorded', async () => {
  const { rows } = await db.query(
    `SELECT s.access_method, s.crawl_state, s.min_request_interval_ms, s.daily_request_budget, s.listing_visibility,
            p.verdict, p.photos_allowed, p.robots_txt, p.checked_at = timestamptz '2026-09-27 22:29:00+00' AS read_by_cs5
     FROM source s JOIN source_policy_check p ON p.source_id = s.id
     WHERE s.id = 'divar'`,
  );
  expect(rows).toEqual([
    {
      access_method: 'crawl',
      crawl_state: 'paused',
      min_request_interval_ms: 3000,
      daily_request_budget: 12000,
      listing_visibility: 'public',
      verdict: 'allowed_with_conditions',
      photos_allowed: false,
      robots_txt: 'User-agent: *\nAllow: /',
      read_by_cs5: true,
    },
  ]);
});

test('a crawl run starts only on an enabled crawled source, citing its newest policy check (ADR-0008 point 1)', async () => {
  // One running run per source: the seeded one ends first.
  await db.query(`UPDATE crawl_run SET status = 'succeeded', finished_at = now() WHERE id = $1`, [
    seeded.crawlRunId,
  ]);
  const start = `INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ($1, $2, 'discovery') RETURNING id`;
  const check = `INSERT INTO source_policy_check (source_id, checked_at, checked_by, terms_summary, verdict, photos_allowed)
                 VALUES ($1, $2, 'owner', 'Read.', $3, false) RETURNING id`;
  const karnameh = await returningId(check, ['karnameh', new Date(), 'allowed']);
  expect(await failure(start, ['karnameh', karnameh])).toMatchObject({
    code: '23514',
    constraint: 'crawl_run_source_enabled',
  });
  // A newer reading replaces the one the seed cites.
  const newer = await returningId(check, ['bama', new Date(Date.now() + 60_000), 'allowed']);
  expect(await failure(start, ['bama', seeded.policyCheckId])).toMatchObject({
    code: '23514',
    constraint: 'crawl_run_policy_current',
  });
  const run = await returningId(start, ['bama', newer]);
  await db.query(`UPDATE crawl_run SET status = 'succeeded', finished_at = now() WHERE id = $1`, [run]);
  const forbidding = await returningId(check, ['bama', new Date(Date.now() + 120_000), 'not_allowed']);
  expect(await failure(start, ['bama', forbidding])).toMatchObject({
    code: '23514',
    constraint: 'crawl_run_policy_allows',
  });
  // A reading older than policy_max_age_days (30) must be renewed before a crawl.
  await db.exec(`
    INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, crawl_state, min_request_interval_ms,
                        daily_request_budget)
    VALUES ('khodro45', 'external', 'crawl', 'خودرو۴۵', 'https://khodro45.com', 'public', 'enabled', 3000, 12000)`);
  const stale = await returningId(check, ['khodro45', new Date(Date.now() - 31 * 86_400_000), 'allowed']);
  expect(await failure(start, ['khodro45', stale])).toMatchObject({
    code: '23514',
    constraint: 'crawl_run_policy_fresh',
  });
});

test('a crawl run says what it was for, and its counts are an object', async () => {
  await db.query(`UPDATE crawl_run SET status = 'succeeded', finished_at = now() WHERE id = $1`, [
    seeded.crawlRunId,
  ]);
  expect(
    await failure(
      `INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ('bama', $1, 'backfill')`,
      [seeded.policyCheckId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_kind_valid' });
  // CS-35's three: a sweep page, a check that a listing left the market, a buyer's re-check.
  for (const kind of ['sweep', 'check', 'recheck']) {
    const run = await returningId(
      `INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ('bama', $1, $2) RETURNING id`,
      [seeded.policyCheckId, kind],
    );
    await db.query(`UPDATE crawl_run SET status = 'succeeded', finished_at = now() WHERE id = $1`, [run]);
  }
  expect(
    await failure(`UPDATE crawl_run SET counts = '[1, 2]' WHERE id = $1`, [seeded.crawlRunId]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_counts_is_object' });
});

const LOG_FETCH = `INSERT INTO fetch_log (source_id, crawl_run_id, url, method, requested_at, http_status, outcome)
                   VALUES ('bama', $1, 'https://bama.ir/car', 'http_get', $2, $3, $4)`;

async function state(): Promise<unknown> {
  const { rows } = await db.query(
    `SELECT s.crawl_state, s.stopped_at, s.stop_reason, r.status AS run_status, r.finished_at IS NOT NULL AS run_finished
     FROM source s JOIN crawl_run r ON r.source_id = s.id WHERE r.id = $1`,
    [seeded.crawlRunId],
  );
  return rows[0];
}

test('a blocked fetch stops its source and ends its run in the same transaction; a 429 stops nothing (ADR-0008 point 6, ADR-0018)', async () => {
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:00+00', 429, 'rate_limited']);
  expect(await state()).toEqual({
    crawl_state: 'enabled',
    stopped_at: null,
    stop_reason: null,
    run_status: 'running',
    run_finished: false,
  });
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:05+00', 403, 'blocked']);
  expect(await state()).toEqual({
    crawl_state: 'stopped_on_block',
    stopped_at: new Date('2026-09-29T08:00:05Z'),
    stop_reason: 'blocked',
    run_status: 'stopped_on_block',
    run_finished: true,
  });
  // No run starts on that source until a person resumes it.
  expect(
    await failure(`INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ('bama', $1, 'detail')`, [
      seeded.policyCheckId,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_source_enabled' });
});

test('a challenge page stops its source with that reason', async () => {
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:00+00', 200, 'challenge']);
  expect(await state()).toMatchObject({ crawl_state: 'stopped_on_block', stop_reason: 'challenge' });
});

test('the request that stopped a source ends its run; another request of it is only logged', async () => {
  // The lane stops the source first (stop_source), then the job logs the request that did it: the same instant and
  // the same reason.
  await db.query(`SELECT stop_source('bama', 'rate_limited', timestamptz '2026-09-29 08:00:00+00')`);
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:01:00+00', 429, 'rate_limited']);
  expect(await state()).toMatchObject({ stop_reason: 'rate_limited', run_status: 'running' });
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:00+00', 429, 'rate_limited']);
  expect(await state()).toMatchObject({
    crawl_state: 'stopped_on_block',
    stop_reason: 'rate_limited',
    run_status: 'stopped_on_block',
  });
});

test("a request at the stop's instant with another outcome is not its evidence", async () => {
  await db.query(`SELECT stop_source('bama', 'challenge', timestamptz '2026-09-29 08:00:00+00')`);
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:00+00', 403, 'blocked']);
  expect(await state()).toMatchObject({ stop_reason: 'challenge', run_status: 'running' });
});

test('a request is logged whatever its source and its run became while it was on the wire', async () => {
  // A row cannot unsend a request, only hide one: what may be sent is decided when a run opens and when the lane lets
  // a request start.
  await db.exec(`UPDATE source SET crawl_state = 'paused' WHERE id = 'bama'`);
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:00+00', 200, 'ok']);
  expect(await state()).toMatchObject({ crawl_state: 'paused', run_status: 'running' });
  await db.query(`UPDATE crawl_run SET status = 'failed', finished_at = now() WHERE id = $1`, [
    seeded.crawlRunId,
  ]);
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:06+00', 200, 'ok']);
  expect(
    await count(`SELECT count(*) FROM fetch_log WHERE crawl_run_id = $1 AND url = 'https://bama.ir/car'`, [
      seeded.crawlRunId,
    ]),
  ).toBe(2);
});

test('a block that answers after a person paused its source stops it, so whoever resumes it sees the block first', async () => {
  await db.exec(`UPDATE source SET crawl_state = 'paused' WHERE id = 'bama'`);
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:03+00', 403, 'blocked']);
  expect(await state()).toEqual({
    crawl_state: 'stopped_on_block',
    stopped_at: new Date('2026-09-29T08:00:03Z'),
    stop_reason: 'blocked',
    run_status: 'stopped_on_block',
    run_finished: true,
  });
  // A stopped source keeps its first stop and its evidence, and a source that is not crawled is never stopped.
  const { rows } = await db.query(
    `SELECT stop_source('bama', 'challenge', now()) AS again, stop_source('partner_api', 'blocked', now()) AS partner`,
  );
  expect(rows).toEqual([{ again: false, partner: false }]);
  expect(await state()).toMatchObject({ stop_reason: 'blocked' });
});

test('a request is logged once: its run and the instant it started name it', async () => {
  await db.query(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:00+00', 200, 'ok']);
  expect(await failure(LOG_FETCH, [seeded.crawlRunId, '2026-09-29 08:00:00+00', 200, 'error'])).toMatchObject(
    { code: '23505', constraint: 'fetch_log_request_unique' },
  );
  // The crawler logs an answer again after a failed step; the row its committed transaction wrote stays.
  const again = await db.query(`${LOG_FETCH} ON CONFLICT ON CONSTRAINT fetch_log_request_unique DO NOTHING`, [
    seeded.crawlRunId,
    '2026-09-29 08:00:00+00',
    200,
    'error',
  ]);
  expect(again.affectedRows).toBe(0);
});

test('a crawl run keeps what it cited, and a finished run stays finished', async () => {
  const newer = await returningId(
    `INSERT INTO source_policy_check (source_id, checked_at, checked_by, terms_summary, verdict, photos_allowed)
     VALUES ('bama', now() + interval '1 minute', 'owner', 'Read.', 'allowed', false) RETURNING id`,
  );
  expect(
    await failure(`UPDATE crawl_run SET policy_check_id = $2 WHERE id = $1`, [seeded.crawlRunId, newer]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_identity_fixed' });
  expect(
    await failure(`UPDATE crawl_run SET kind = 'measure' WHERE id = $1`, [seeded.crawlRunId]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_identity_fixed' });
  expect(
    await failure(`UPDATE crawl_run SET started_at = started_at - interval '1 day' WHERE id = $1`, [
      seeded.crawlRunId,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_identity_fixed' });
  await db.query(`UPDATE crawl_run SET status = 'succeeded', finished_at = now() WHERE id = $1`, [
    seeded.crawlRunId,
  ]);
  // Reopened, it would pass for a run whose policy check was checked when it started.
  expect(
    await failure(`UPDATE crawl_run SET status = 'running', finished_at = NULL WHERE id = $1`, [
      seeded.crawlRunId,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_finished_is_final' });
  expect(
    await failure(`UPDATE crawl_run SET status = 'failed' WHERE id = $1`, [seeded.crawlRunId]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_run_finished_is_final' });
  // Its counts may still come: a run that a block ended gains them when its job closes it.
  await db.query(`UPDATE crawl_run SET counts = '{"rows": 24}' WHERE id = $1`, [seeded.crawlRunId]);
});

test('the worker role opens a run, and a blocked fetch it logs stops the source and ends the run', async () => {
  await db.query(`UPDATE crawl_run SET status = 'succeeded', finished_at = now() WHERE id = $1`, [
    seeded.crawlRunId,
  ]);
  await db.exec('SET LOCAL ROLE carshenas_worker');
  const run = await returningId(
    `INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ('bama', $1, 'detail') RETURNING id`,
    [seeded.policyCheckId],
  );
  await db.query(LOG_FETCH, [run, '2026-09-29 08:00:00+00', 403, 'blocked']);
  const { rows } = await db.query(
    `SELECT s.crawl_state, r.status FROM source s JOIN crawl_run r ON r.source_id = s.id WHERE r.id = $1`,
    [run],
  );
  expect(rows).toEqual([{ crawl_state: 'stopped_on_block', status: 'stopped_on_block' }]);
});

test('a fetch says how it reached the source: a GET or a POST to its pages, or a partner API', async () => {
  await db.query(
    `INSERT INTO fetch_log (source_id, crawl_run_id, url, method, requested_at, http_status, outcome)
     VALUES ('bama', $1, 'https://bama.ir/search', 'http_post', clock_timestamp(), 200, 'ok')`,
    [seeded.crawlRunId],
  );
  expect(
    await failure(
      `INSERT INTO fetch_log (source_id, crawl_run_id, url, method, requested_at, http_status, outcome)
       VALUES ('bama', $1, 'https://bama.ir/search', 'http_put', clock_timestamp(), 200, 'ok')`,
      [seeded.crawlRunId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'fetch_log_method_valid' });
});

const PRICE = `INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
               VALUES ($1, $2, $3, $4, $5)`;

function minute(value: number): string {
  return `2026-09-29 08:${String(value).padStart(2, '0')}:00+00`;
}

test('a price history holds each change once, in order, with the previous and the last asking price (ADR-0014)', async () => {
  const listing = seeded.listingId;
  const evidence = seeded.snapshotId;
  await db.query(PRICE, [listing, minute(0), 'asking', 1_250_000_000, evidence]);
  await db.query(PRICE, [listing, minute(10), 'negotiable', null, evidence]);
  await db.query(PRICE, [listing, minute(20), 'asking', 1_000_000_000, evidence]);
  const { rows } = await db.query(
    `SELECT price_type, asking_price_toman, previous_price_type, previous_price_toman, last_asking_price_toman
     FROM listing_price_event WHERE listing_id = $1 ORDER BY observed_at`,
    [listing],
  );
  // 1.25 billion, then negotiable, then 1.0 billion: a drop of 250 million, across the negotiable event.
  expect(rows.map((row) => Object.values(row as Record<string, unknown>).map(String))).toEqual([
    ['asking', '1250000000', 'null', 'null', 'null'],
    ['negotiable', 'null', 'asking', '1250000000', '1250000000'],
    ['asking', '1000000000', 'negotiable', 'null', '1250000000'],
  ]);
  // The same price again is not an event, nor is negotiable twice.
  expect(await failure(PRICE, [listing, minute(30), 'asking', 1_000_000_000, evidence])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_event_is_a_change',
  });
  await db.query(PRICE, [listing, minute(40), 'negotiable', null, evidence]);
  expect(await failure(PRICE, [listing, minute(50), 'negotiable', null, evidence])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_event_is_a_change',
  });
  // A price seen before the latest event would rewrite history, and could announce a drop twice.
  expect(await failure(PRICE, [listing, minute(5), 'asking', 900_000_000, evidence])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_event_in_order',
  });
  // An exact re-insert gets the values the original got, and the unique key lets ON CONFLICT skip it.
  const again = await db.query(
    `${PRICE} ON CONFLICT ON CONSTRAINT listing_price_event_observed_unique DO NOTHING`,
    [listing, minute(40), 'negotiable', null, evidence],
  );
  expect(again.affectedRows).toBe(0);
  // So is a job that runs again after a later event: an event at an existing instant is not late.
  await db.query(PRICE, [listing, minute(55), 'asking', 950_000_000, evidence]);
  const retried = await db.query(
    `${PRICE} ON CONFLICT ON CONSTRAINT listing_price_event_observed_unique DO NOTHING`,
    [listing, minute(20), 'asking', 1_000_000_000, evidence],
  );
  expect(retried.affectedRows).toBe(0);
  expect(await failure(PRICE, [listing, minute(20), 'asking', 1_000_000_000, evidence])).toMatchObject({
    code: '23505',
    constraint: 'listing_price_event_observed_unique',
  });
});

test('a price event carries an amount exactly for an asking price, in range, read from a snapshot of its own listing', async () => {
  const listing = seeded.listingId;
  expect(await failure(PRICE, [listing, minute(0), 'negotiable', 5_000, seeded.snapshotId])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_event_amount_matches_type',
  });
  expect(await failure(PRICE, [listing, minute(0), 'asking', null, seeded.snapshotId])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_event_amount_matches_type',
  });
  expect(await failure(PRICE, [listing, minute(0), 'asking', 0, seeded.snapshotId])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_event_asking_price_toman_range',
  });
  expect(await failure(PRICE, [listing, minute(0), 'bargain', null, seeded.snapshotId])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_event_price_type_valid',
  });
  const other = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
    VALUES ('bama', 'ad-7', 'https://bama.ir/car/ad-7', 'active', now(), now()) RETURNING id`);
  expect(await failure(PRICE, [other, minute(0), 'asking', 5_000, seeded.snapshotId])).toMatchObject({
    code: '23503',
    constraint: 'listing_price_event_snapshot_fk',
  });
  await db.query(PRICE, [listing, minute(0), 'placeholder', null, seeded.snapshotId]);
  expect(await failure(`UPDATE listing_price_event SET observed_at = now()`)).toMatchObject({
    code: '23000',
    constraint: 'listing_price_event_append_only',
  });
});

test('a discovery feed is named within its source, once', async () => {
  const insert = `INSERT INTO crawl_feed (source_id, feed_key) VALUES ('bama', $1)`;
  expect(await failure(insert, ['Tracked Models'])).toMatchObject({
    code: '23514',
    constraint: 'crawl_feed_feed_key_format',
  });
  await db.query(insert, ['tracked_models']);
  expect(await failure(insert, ['tracked_models'])).toMatchObject({
    code: '23505',
    constraint: 'crawl_feed_pkey',
  });
});

test('a sweep counts each slice once, at a named level, never below zero', async () => {
  const insert = `INSERT INTO model_volume (source_id, source_model_key, level, swept_at, active_count, pages_read, complete)
                  VALUES ('bama', $1, $2, '2026-09-29 08:00:00+00', $3, 5, true)`;
  await db.query(insert, ['Peugeot 206', 'model', 120]);
  expect(await failure(insert, ['Peugeot 206', 'model', 121])).toMatchObject({
    code: '23505',
    constraint: 'model_volume_sweep_unique',
  });
  expect(await failure(insert, ['Pride', 'make', 5])).toMatchObject({
    code: '23514',
    constraint: 'model_volume_level_valid',
  });
  expect(await failure(insert, ['Pride', 'brand', -1])).toMatchObject({
    code: '23514',
    constraint: 'model_volume_active_count_nonnegative',
  });
  expect(await failure(insert, ['  ', 'brand', 1])).toMatchObject({
    code: '23514',
    constraint: 'model_volume_source_model_key_not_blank',
  });
  // Counts are observations: their source is deleted only with them, in a purge.
  await db.exec(`
    INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, crawl_state, min_request_interval_ms,
                        daily_request_budget)
    VALUES ('khodro45', 'external', 'crawl', 'خودرو۴۵', 'https://khodro45.com', 'public', 'paused', 3000, 12000);
    INSERT INTO model_volume (source_id, source_model_key, level, swept_at, active_count, pages_read, complete)
    VALUES ('khodro45', 'ROOT', 'all', now(), 10, 1, true);`);
  expect(await failure(`DELETE FROM source WHERE id = 'khodro45'`)).toMatchObject({
    code: '23001',
    constraint: 'model_volume_source_fk',
  });
});

test('the worker records prices, feeds and volumes, and the web role reads none of them yet', async () => {
  await db.exec('SET LOCAL ROLE carshenas_worker');
  await db.query(PRICE, [seeded.listingId, minute(0), 'asking', 1_000_000_000, seeded.snapshotId]);
  expect(await failure(`UPDATE listing_price_event SET asking_price_toman = 1`)).toMatchObject({
    code: '42501',
  });
  await db.query(`INSERT INTO crawl_feed (source_id, feed_key) VALUES ('bama', 'tracked_models')`);
  await db.query(`UPDATE crawl_feed SET round_started_at = now() WHERE source_id = 'bama'`);
  await db.query(
    `INSERT INTO model_volume (source_id, source_model_key, level, swept_at, active_count, pages_read, complete)
     VALUES ('bama', 'ROOT', 'all', now(), 10, 1, true)`,
  );
  expect(await failure(`UPDATE model_volume SET active_count = 11`)).toMatchObject({ code: '42501' });
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await failure(`SELECT 1 FROM listing_price_event`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT 1 FROM crawl_feed`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT 1 FROM model_volume`)).toMatchObject({ code: '42501' });
});

// What a listing says about its car, derived by the parser (CS-34). PostgreSQL checks a row's CHECKs in the
// alphabetical order of their names, so a row that breaks two is refused by the first.
const SET_PRICE = `UPDATE listing SET price_type = $2, asking_price_toman = $3, down_payment_toman = $4 WHERE id = $1`;
const SET_YEAR = `UPDATE listing SET model_year_written = $2, model_year_sh = $3, model_year_ad = $4 WHERE id = $1`;

test("a listing's price has an amount exactly for its type, in whole tomans within the bound (ADR-0014)", async () => {
  const listing = seeded.listingId;
  for (const [type, asking, downPayment] of [
    ['asking', 1_250_000_000, null],
    ['installment', null, 150_000_000],
    ['negotiable', null, null],
    ['placeholder', null, null],
    [null, null, null],
  ] as const) {
    await db.query(SET_PRICE, [listing, type, asking, downPayment]);
  }
  for (const [type, asking, downPayment] of [
    ['asking', null, null],
    ['asking', 1_250_000_000, 150_000_000],
    ['installment', 1_250_000_000, null],
    ['negotiable', 1_000, null],
    ['placeholder', 1_000, null],
    [null, 1_250_000_000, null],
  ] as const) {
    expect(await failure(SET_PRICE, [listing, type, asking, downPayment])).toMatchObject({
      code: '23514',
      constraint: 'listing_price_type_amounts',
    });
  }
  expect(await failure(SET_PRICE, [listing, 'asking', 0, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_asking_price_toman_range',
  });
  expect(await failure(SET_PRICE, [listing, 'asking', 1_000_000_000_000_000, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_asking_price_toman_range',
  });
  expect(await failure(SET_PRICE, [listing, 'installment', null, 0])).toMatchObject({
    code: '23514',
    constraint: 'listing_down_payment_toman_range',
  });
  expect(await failure(SET_PRICE, [listing, 'bargain', null, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_type_valid',
  });
});

test("a listing's model year is stated in one calendar or both, and the two agree (ADR-0014)", async () => {
  const listing = seeded.listingId;
  for (const [written, sh, ad] of [
    ['sh', 1402, null],
    ['ad', 1404, 2025],
    ['both', 1392, 2013],
    ['both', 1401, 2023],
    [null, null, null],
  ] as const) {
    await db.query(SET_YEAR, [listing, written, sh, ad]);
  }
  for (const [written, sh, ad] of [
    ['sh', 1402, 2023],
    ['sh', null, null],
    ['ad', 1403, 2025],
    ['ad', null, 2025],
    ['both', 1392, 2015],
    ['both', null, 2013],
    [null, 1402, null],
  ] as const) {
    expect(await failure(SET_YEAR, [listing, written, sh, ad])).toMatchObject({
      code: '23514',
      constraint: 'listing_model_year_calendars_agree',
    });
  }
  expect(await failure(SET_YEAR, [listing, 'sh', 1299, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_model_year_sh_range',
  });
  expect(await failure(SET_YEAR, [listing, 'ad', 1299, 1920])).toMatchObject({
    code: '23514',
    constraint: 'listing_model_year_ad_range',
  });
  expect(await failure(SET_YEAR, [listing, 'jalali', null, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_model_year_written_valid',
  });
});

test("a listing's other attributes are never negative or blank, and its words come from fixed lists", async () => {
  const listing = seeded.listingId;
  // A Divar listing's values as the parser derives them.
  await db.query(
    `UPDATE listing SET title = 'پژو ۲۰۶ تیپ ۵، مدل ۱۳۹۲', source_model_key = 'Peugeot 206 5', mileage_km = 91000,
       fuel = 'dual_fuel_factory', gearbox = 'manual', insurance_months_left = 6, accepts_swap = true,
       accepts_installments = true, seller_type = 'private', body_condition = 'partly_repainted',
       engine_condition = 'sound', gearbox_condition = 'sound', front_chassis_condition = 'intact',
       rear_chassis_condition = 'damaged', parser_version = 1
     WHERE id = $1`,
    [listing],
  );
  for (const [statement, value, constraint] of [
    ['UPDATE listing SET title = $2 WHERE id = $1', ' ', 'listing_title_not_blank'],
    ['UPDATE listing SET source_model_key = $2 WHERE id = $1', '', 'listing_source_model_key_not_blank'],
    ['UPDATE listing SET mileage_km = $2 WHERE id = $1', -1, 'listing_mileage_km_range'],
    // More than any car drives: a typo or a code, never a mileage.
    ['UPDATE listing SET mileage_km = $2 WHERE id = $1', 10_000_000, 'listing_mileage_km_range'],
    [
      'UPDATE listing SET insurance_months_left = $2 WHERE id = $1',
      -1,
      'listing_insurance_months_left_nonnegative',
    ],
    ['UPDATE listing SET parser_version = $2 WHERE id = $1', 0, 'listing_parser_version_positive'],
    ['UPDATE listing SET fuel = $2 WHERE id = $1', 'cng', 'listing_fuel_valid'],
    ['UPDATE listing SET gearbox = $2 WHERE id = $1', 'cvt', 'listing_gearbox_valid'],
    ['UPDATE listing SET seller_type = $2 WHERE id = $1', 'agency', 'listing_seller_type_valid'],
    ['UPDATE listing SET body_condition = $2 WHERE id = $1', 'repainted', 'listing_body_condition_valid'],
    ['UPDATE listing SET engine_condition = $2 WHERE id = $1', 'intact', 'listing_engine_condition_valid'],
    ['UPDATE listing SET gearbox_condition = $2 WHERE id = $1', 'intact', 'listing_gearbox_condition_valid'],
    [
      'UPDATE listing SET front_chassis_condition = $2 WHERE id = $1',
      'sound',
      'listing_front_chassis_condition_valid',
    ],
    [
      'UPDATE listing SET rear_chassis_condition = $2 WHERE id = $1',
      'sound',
      'listing_rear_chassis_condition_valid',
    ],
  ] as const) {
    expect(await failure(statement, [listing, value])).toMatchObject({ code: '23514', constraint });
  }
});

const PHOTO = `INSERT INTO listing_photo (listing_id, position, url, thumbnail_url) VALUES ($1, $2, $3, $4)`;
const PHOTO_URL = 'https://s100.divarcdn.com/static/photo/neda/webp_post/AAAA/0000.webp';

test("a listing's photos are https addresses in the source's order, and leave with the listing in a purge (ADR-0025)", async () => {
  const listing = seeded.listingId;
  await db.query(PHOTO, [listing, 1, PHOTO_URL, PHOTO_URL.replace('webp_post', 'webp_thumbnail')]);
  await db.query(PHOTO, [listing, 2, PHOTO_URL, null]);
  expect(await failure(PHOTO, [listing, 2, PHOTO_URL, null])).toMatchObject({
    code: '23505',
    constraint: 'listing_photo_pkey',
  });
  expect(await failure(PHOTO, [listing, 0, PHOTO_URL, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_photo_position_positive',
  });
  expect(
    await failure(PHOTO, [listing, 3, 'http://s100.divarcdn.com/static/photo/a.webp', null]),
  ).toMatchObject({
    code: '23514',
    constraint: 'listing_photo_url_https',
  });
  expect(
    await failure(PHOTO, [listing, 3, PHOTO_URL, 'ftp://s100.divarcdn.com/static/photo/a.webp']),
  ).toMatchObject({ code: '23514', constraint: 'listing_photo_thumbnail_url_https' });
  expect(await failure(PHOTO, [listing + 1_000, 1, PHOTO_URL, null])).toMatchObject({
    code: '23503',
    constraint: 'listing_photo_listing_fk',
  });
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.query(`DELETE FROM listing WHERE id = $1`, [listing]);
  expect(await count(`SELECT count(*) FROM listing_photo WHERE listing_id = $1`, [listing])).toBe(0);
});

const UNPARSED = `INSERT INTO listing_unparsed_value (listing_id, field, raw_text) VALUES ($1, $2, $3)`;

test('an unparsed value names the attribute it would fill, keeps its raw text once, and leaves with the listing', async () => {
  const listing = seeded.listingId;
  await db.query(UNPARSED, [listing, 'model_year', 'قبل از ۱۳۶۶ - قبل از ۱۹۸۷']);
  expect(await failure(UNPARSED, [listing, 'model_year', '۱۳۹۲'])).toMatchObject({
    code: '23505',
    constraint: 'listing_unparsed_value_pkey',
  });
  // A colour the parser does not know is kept like any other field it reads (CS-50); ownership is no field of ours.
  await db.query(UNPARSED, [listing, 'colour', 'صورتی جیغ']);
  expect(await failure(UNPARSED, [listing, 'ownership', 'سند تک برگ'])).toMatchObject({
    code: '23514',
    constraint: 'listing_unparsed_value_field_valid',
  });
  expect(await failure(UNPARSED, [listing, 'fuel', '  '])).toMatchObject({
    code: '23514',
    constraint: 'listing_unparsed_value_raw_text_not_blank',
  });
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.query(`DELETE FROM listing WHERE id = $1`, [listing]);
  expect(await count(`SELECT count(*) FROM listing_unparsed_value WHERE listing_id = $1`, [listing])).toBe(0);
});

test('the worker derives attributes, photos and unparsed values; the web role reads the attributes but no photo yet', async () => {
  const listing = seeded.listingId;
  await db.exec('SET LOCAL ROLE carshenas_worker');
  await db.query(`UPDATE listing SET mileage_km = 91000, parser_version = 1 WHERE id = $1`, [listing]);
  await db.query(PHOTO, [listing, 1, PHOTO_URL, null]);
  await db.query(`UPDATE listing_photo SET thumbnail_url = url WHERE listing_id = $1`, [listing]);
  await db.query(`DELETE FROM listing_photo WHERE listing_id = $1 AND position > 1`, [listing]);
  await db.query(UNPARSED, [listing, 'fuel', 'هیدروژن']);
  await db.query(`UPDATE listing_unparsed_value SET raw_text = 'هیدروژنی' WHERE listing_id = $1`, [listing]);
  await db.query(`DELETE FROM listing_unparsed_value WHERE listing_id = $1`, [listing]);
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await count(`SELECT count(*) FROM listing WHERE mileage_km = 91000`)).toBe(1);
  expect(await failure(`SELECT 1 FROM listing_photo`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT 1 FROM listing_unparsed_value`)).toMatchObject({ code: '42501' });
  await db.exec('SET LOCAL ROLE carshenas_readonly');
  expect(await count(`SELECT count(*) FROM listing_photo`)).toBe(1);
  expect(await failure(`DELETE FROM listing_photo`)).toMatchObject({ code: '42501' });
});

// The superadmin section (CS-40, ADR-0023).
const CHANGE = `SELECT change_source_state($1, $2, $3, $4, $5) AS outcome`;

async function changeState(
  sourceId: string,
  seenState: string,
  seenStoppedAt: string | null,
  newState: string | null,
  accountId: number,
): Promise<string | undefined> {
  const { rows } = await db.query<{ outcome: string }>(CHANGE, [
    sourceId,
    seenState,
    seenStoppedAt,
    newState,
    accountId,
  ]);
  return rows[0]?.outcome;
}

/** What the crawler does on a block (stop_source()), at an instant with microseconds. */
async function stopOnBlock(sourceId: string, stoppedAt: string): Promise<void> {
  await db.query(
    `UPDATE source SET crawl_state = 'stopped_on_block', stopped_at = $2, stop_reason = 'blocked' WHERE id = $1`,
    [sourceId, stoppedAt],
  );
}

const STOPPED_AT = '2026-09-29 13:13:44.123456+00';

test('a change of crawl state is a real change, to enabled or paused, keeps the stop it cleared, and stays as written', async () => {
  const superadminId = await account('pedram', 'superadmin');
  const insert = `INSERT INTO source_state_change
      (source_id, from_state, to_state, changed_by_account_id, cleared_stopped_at, cleared_stop_reason)
    VALUES ($1, $2, $3, $4, $5, $6)`;
  await db.query(insert, ['karnameh', 'paused', 'enabled', superadminId, null, null]);
  await db.query(insert, ['bama', 'stopped_on_block', 'enabled', superadminId, STOPPED_AT, 'blocked']);
  expect(await failure(insert, ['karnameh', 'paused', 'paused', superadminId, null, null])).toMatchObject({
    code: '23514',
    constraint: 'source_state_change_is_change',
  });
  // Only the crawler stops a source.
  expect(
    await failure(insert, ['karnameh', 'enabled', 'stopped_on_block', superadminId, null, null]),
  ).toMatchObject({
    code: '23514',
    constraint: 'source_state_change_to_state_valid',
  });
  expect(await failure(insert, ['karnameh', 'running', 'paused', superadminId, null, null])).toMatchObject({
    code: '23514',
    constraint: 'source_state_change_from_state_valid',
  });
  expect(
    await failure(insert, ['bama', 'stopped_on_block', 'enabled', superadminId, STOPPED_AT, 'captcha']),
  ).toMatchObject({ code: '23514', constraint: 'source_state_change_cleared_stop_reason_valid' });
  // Leaving a stop keeps when and why; no other change carries a stop.
  for (const [stoppedAt, reason] of [
    [null, null],
    [STOPPED_AT, null],
    [null, 'blocked'],
  ] as const) {
    expect(
      await failure(insert, ['bama', 'stopped_on_block', 'paused', superadminId, stoppedAt, reason]),
    ).toMatchObject({ code: '23514', constraint: 'source_state_change_stop_kept' });
  }
  expect(
    await failure(insert, ['karnameh', 'paused', 'enabled', superadminId, STOPPED_AT, 'blocked']),
  ).toMatchObject({ code: '23514', constraint: 'source_state_change_stop_kept' });
  expect(await failure(`UPDATE source_state_change SET to_state = 'paused'`)).toMatchObject({
    code: '23000',
    constraint: 'source_state_change_append_only',
  });
  expect(await failure(`DELETE FROM source_state_change`)).toMatchObject({
    code: '23000',
    constraint: 'source_state_change_append_only',
  });
  // A source or an account with a recorded change stays, unless a purge removes the change first.
  expect(await failure(`DELETE FROM source WHERE id = 'karnameh'`)).toMatchObject({
    code: '23001',
    constraint: 'source_state_change_source_fk',
  });
  expect(await failure(`DELETE FROM account WHERE id = $1`, [superadminId])).toMatchObject({
    code: '23001',
    constraint: 'source_state_change_account_fk',
  });
});

test('a superadmin pauses and resumes a source, each change recorded with who and when, and a repeat changes nothing', async () => {
  const superadminId = await account('pedram', 'superadmin');
  expect(await changeState('karnameh', 'paused', null, 'enabled', superadminId)).toBe('changed');
  expect(await changeState('karnameh', 'paused', null, 'enabled', superadminId)).toBe('unchanged');
  expect(await changeState('karnameh', 'enabled', null, 'paused', superadminId)).toBe('changed');
  // Each change is stamped when it took effect (clock_timestamp()), inside this test's transaction and after the one
  // before it, so a source's history reads in the order its changes happened.
  const { rows } = await db.query(
    `SELECT from_state, to_state, changed_by_account_id = $1 AS by_superadmin,
            changed_at BETWEEN now() AND clock_timestamp() AS during_the_test,
            changed_at > coalesce(lag(changed_at) OVER (ORDER BY id), '-infinity') AS after_the_previous,
            cleared_stopped_at, cleared_stop_reason
     FROM source_state_change WHERE source_id = 'karnameh' ORDER BY id`,
    [superadminId],
  );
  expect(rows).toEqual([
    {
      from_state: 'paused',
      to_state: 'enabled',
      by_superadmin: true,
      during_the_test: true,
      after_the_previous: true,
      cleared_stopped_at: null,
      cleared_stop_reason: null,
    },
    {
      from_state: 'enabled',
      to_state: 'paused',
      by_superadmin: true,
      during_the_test: true,
      after_the_previous: true,
      cleared_stopped_at: null,
      cleared_stop_reason: null,
    },
  ]);
  expect(await count(`SELECT count(*) FROM source WHERE id = 'karnameh' AND crawl_state = 'paused'`)).toBe(1);
});

test('resuming a source stopped on a block clears its stop, which the change keeps, and only the stop that was seen', async () => {
  const superadminId = await account('pedram', 'superadmin');
  await stopOnBlock('bama', STOPPED_AT);
  // A page that still showed the source running, or showed another stop, changes nothing.
  expect(await changeState('bama', 'enabled', null, 'paused', superadminId)).toBe('stale');
  expect(
    await changeState('bama', 'stopped_on_block', '2026-09-29 13:13:44.123+00', 'enabled', superadminId),
  ).toBe('stale');
  expect(await count(`SELECT count(*) FROM source_state_change`)).toBe(0);
  expect(await changeState('bama', 'stopped_on_block', STOPPED_AT, 'enabled', superadminId)).toBe('changed');
  const { rows: sources } = await db.query(
    `SELECT crawl_state, stopped_at, stop_reason FROM source WHERE id = 'bama'`,
  );
  expect(sources).toEqual([{ crawl_state: 'enabled', stopped_at: null, stop_reason: null }]);
  const { rows: changes } = await db.query(
    `SELECT from_state, to_state, cleared_stopped_at = $1::timestamptz AS kept_stop, cleared_stop_reason
     FROM source_state_change WHERE source_id = 'bama'`,
    [STOPPED_AT],
  );
  expect(changes).toEqual([
    { from_state: 'stopped_on_block', to_state: 'enabled', kept_stop: true, cleared_stop_reason: 'blocked' },
  ]);
  // A stop can also be left paused: the source stays down, now by a person's choice.
  await stopOnBlock('bama', '2026-09-30 08:00:00.000001+00');
  expect(
    await changeState('bama', 'stopped_on_block', '2026-09-30 08:00:00.000001+00', 'paused', superadminId),
  ).toBe('changed');
  expect(await count(`SELECT count(*) FROM source WHERE id = 'bama' AND crawl_state = 'paused'`)).toBe(1);
});

test('only a superadmin changes a source, only to enabled or paused, and a source that is not crawled stays paused', async () => {
  const buyerId = await account('ali_1403');
  const superadminId = await account('pedram', 'superadmin');
  for (const accountId of [buyerId, 999_999]) {
    expect(await failure(CHANGE, ['karnameh', 'paused', null, 'enabled', accountId])).toMatchObject({
      code: '23514',
      constraint: 'source_state_change_by_superadmin',
    });
  }
  for (const newState of ['stopped_on_block', 'running', null]) {
    expect(await failure(CHANGE, ['karnameh', 'paused', null, newState, superadminId])).toMatchObject({
      code: '23514',
      constraint: 'source_state_change_to_state_valid',
    });
  }
  expect(await failure(CHANGE, ['partner_api', 'paused', null, 'enabled', superadminId])).toMatchObject({
    code: '23514',
    constraint: 'source_only_crawled_sources_run',
  });
  expect(await changeState('no_such_source', 'paused', null, 'enabled', superadminId)).toBe('stale');
  expect(await count(`SELECT count(*) FROM source_state_change`)).toBe(0);
});

test("the superadmin section's role reads sources and their changes, and changes a source only through the function", async () => {
  const superadminId = await account('pedram', 'superadmin');
  await db.exec('SET LOCAL ROLE carshenas_admin');
  expect(await count(`SELECT count(*) FROM source`)).toBe(5);
  expect(await changeState('karnameh', 'paused', null, 'enabled', superadminId)).toBe('changed');
  expect(await count(`SELECT count(*) FROM source_state_change`)).toBe(1);
  expect(await count(`SELECT count(username) FROM account WHERE role = 'superadmin'`)).toBe(1);
  expect(await failure(`SELECT password_hash FROM account`)).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE source SET crawl_state = 'paused' WHERE id = 'karnameh'`)).toMatchObject({
    code: '42501',
  });
  expect(
    await failure(
      `INSERT INTO source_state_change (source_id, from_state, to_state, changed_by_account_id)
       VALUES ('karnameh', 'enabled', 'paused', $1)`,
      [superadminId],
    ),
  ).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE account SET role = 'buyer'`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT id FROM account_session`)).toMatchObject({ code: '42501' });
  // CS-41 lets the section read the fetch log (the worker's screens); it still writes none of it, nor snapshots.
  expect(await count(`SELECT count(*) FROM fetch_log`)).toBeGreaterThanOrEqual(0);
  expect(await failure(`DELETE FROM fetch_log`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT id FROM snapshot`)).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE listing SET last_seen_at = now()`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT stop_source('bama', 'blocked', now())`)).toMatchObject({ code: '42501' });
});

test('public pages, the worker and people inspecting data never change a source through the section', async () => {
  const superadminId = await account('pedram', 'superadmin');
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await failure(CHANGE, ['karnameh', 'paused', null, 'enabled', superadminId])).toMatchObject({
    code: '42501',
  });
  expect(await failure(`SELECT id FROM source_state_change`)).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE source SET crawl_state = 'enabled' WHERE id = 'karnameh'`)).toMatchObject({
    code: '42501',
  });
  await db.exec('SET LOCAL ROLE carshenas_worker');
  expect(await failure(CHANGE, ['karnameh', 'paused', null, 'enabled', superadminId])).toMatchObject({
    code: '42501',
  });
  await db.exec('SET LOCAL ROLE carshenas_readonly');
  expect(await count(`SELECT count(*) FROM source_state_change`)).toBe(0);
  expect(await failure(CHANGE, ['karnameh', 'paused', null, 'enabled', superadminId])).toMatchObject({
    code: '42501',
  });
});

test('a crawled source has a daily request budget of at most half of what its interval allows (CS-35)', async () => {
  // 3,000 ms between requests allows 28,800 a day; half of it is 14,400.
  await db.exec(`UPDATE source SET daily_request_budget = 14400 WHERE id = 'bama'`);
  expect(await failure(`UPDATE source SET daily_request_budget = 14401 WHERE id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'source_daily_request_budget_range',
  });
  expect(await failure(`UPDATE source SET daily_request_budget = 0 WHERE id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'source_daily_request_budget_range',
  });
  expect(await failure(`UPDATE source SET daily_request_budget = NULL WHERE id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'source_crawl_has_budget',
  });
  // A longer interval lowers the ceiling with it.
  expect(await failure(`UPDATE source SET min_request_interval_ms = 6000 WHERE id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'source_daily_request_budget_range',
  });
  expect(await count(`SELECT daily_request_budget AS count FROM source WHERE id = 'divar'`)).toBe(12000);
});

test('a lane counts its requests for one Tehran day at a time, never below zero (CS-35)', async () => {
  await db.exec(`INSERT INTO crawl_lane (source_id) VALUES ('bama')`);
  expect(await failure(`UPDATE crawl_lane SET budget_spent = 1 WHERE source_id = 'bama'`)).toMatchObject({
    code: '23514',
    constraint: 'crawl_lane_budget_day_counted',
  });
  expect(
    await failure(
      `UPDATE crawl_lane SET budget_day = '2026-09-30', budget_spent = -1 WHERE source_id = 'bama'`,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_lane_budget_spent_nonnegative' });
  await db.exec(`UPDATE crawl_lane SET budget_day = '2026-09-30', budget_spent = 1 WHERE source_id = 'bama'`);
});

test('a price event cites exactly one piece of evidence: a snapshot or the list page that showed it (CS-35)', async () => {
  const listFetch = await returningId(
    `INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome)
     VALUES ('bama', $1, 'https://bama.ir/car?page=1', now() - interval '1 minute', 200, 'ok') RETURNING id`,
    [seeded.crawlRunId],
  );
  const insert = `INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id, fetch_log_id)
                  VALUES ($1, $2, 'asking', $3, $4, $5)`;
  await db.query(insert, [seeded.listingId, minute(0), 1_250_000_000, null, listFetch]);
  await db.query(insert, [seeded.listingId, minute(10), 1_200_000_000, seeded.snapshotId, null]);
  expect(await failure(insert, [seeded.listingId, minute(20), 1_100_000_000, null, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_price_event_one_evidence',
  });
  expect(
    await failure(insert, [seeded.listingId, minute(20), 1_100_000_000, seeded.snapshotId, listFetch]),
  ).toMatchObject({ code: '23514', constraint: 'listing_price_event_one_evidence' });
  expect(await failure(insert, [seeded.listingId, minute(20), 1_100_000_000, null, 999_999])).toMatchObject({
    code: '23503',
    constraint: 'listing_price_event_fetch_log_fk',
  });
});

test('a listing has at most one pending re-check request, which ends with what became of it (CS-35)', async () => {
  const request = `INSERT INTO listing_recheck_request (listing_id) VALUES ($1)`;
  await db.query(request, [seeded.listingId]);
  expect(await failure(request, [seeded.listingId])).toMatchObject({
    code: '23505',
    constraint: 'listing_recheck_request_pending_unique',
  });
  // Opening the page again adds nothing.
  await db.query(`${request} ON CONFLICT DO NOTHING`, [seeded.listingId]);
  expect(
    await failure(`UPDATE listing_recheck_request SET handled_at = now() WHERE listing_id = $1`, [
      seeded.listingId,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'listing_recheck_request_handled_with_outcome' });
  expect(
    await failure(
      `UPDATE listing_recheck_request SET handled_at = now(), outcome = 'done' WHERE listing_id = $1`,
      [seeded.listingId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'listing_recheck_request_outcome_valid' });
  await db.query(
    `UPDATE listing_recheck_request SET handled_at = now(), outcome = 'queued' WHERE listing_id = $1`,
    [seeded.listingId],
  );
  // Handled, so the next opening may ask again.
  await db.query(request, [seeded.listingId]);
  expect(await count(`SELECT count(*) FROM listing_recheck_request`)).toBe(2);
});

test('the web role asks for re-checks without reading them; the worker handles them (CS-35)', async () => {
  await db.exec('SET LOCAL ROLE carshenas_web');
  await db.query(`INSERT INTO listing_recheck_request (listing_id) VALUES ($1) ON CONFLICT DO NOTHING`, [
    seeded.listingId,
  ]);
  expect(await failure(`SELECT id FROM listing_recheck_request`)).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE listing_recheck_request SET outcome = 'fresh'`)).toMatchObject({
    code: '42501',
  });
  await db.exec('SET LOCAL ROLE carshenas_worker');
  await db.query(
    `UPDATE listing_recheck_request SET handled_at = now(), outcome = 'fresh' WHERE listing_id = $1`,
    [seeded.listingId],
  );
  expect(await failure(`DELETE FROM listing_recheck_request`)).toMatchObject({ code: '42501' });
  expect(await failure(`UPDATE listing_recheck_request SET listing_id = listing_id`)).toMatchObject({
    code: '42501',
  });
});

test('a freshness measurement is stored once an hour per source and model, with counts and minutes that make sense (CS-35)', async () => {
  const insert = `INSERT INTO freshness_measurement (source_id, source_model_key, measured_at, new_listings, left_market,
                    active_listings, seen_within_48h, posting_to_first_seen_p50_minutes, posting_to_first_seen_p90_minutes,
                    last_seen_age_p50_minutes, last_seen_age_p90_minutes)
                  VALUES ('bama', $1, '2026-09-30 10:00+00', 5, 1, 40, $2, $3, $4, 60, 600)`;
  await db.query(insert, [null, 30, 20, 50]);
  await db.query(insert, ['Peugeot 206', 10, null, null]);
  // The whole source is measured once an hour too: NULL is not a way around the key.
  expect(await failure(insert, [null, 30, 20, 50])).toMatchObject({
    code: '23505',
    constraint: 'freshness_measurement_once_unique',
  });
  expect(await failure(insert, ['Peugeot 405', 41, null, null])).toMatchObject({
    code: '23514',
    constraint: 'freshness_measurement_seen_within_active',
  });
  expect(await failure(insert, ['Peugeot 405', 10, 50, 20])).toMatchObject({
    code: '23514',
    constraint: 'freshness_measurement_minutes_nonnegative',
  });
  expect(await failure(`UPDATE freshness_measurement SET new_listings = 6`)).toMatchObject({
    code: '23000',
    constraint: 'freshness_measurement_append_only',
  });
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await count(`SELECT count(*) FROM freshness_measurement`)).toBe(2);
  expect(await failure(`SELECT count(*) FROM source_daily_spend`)).toMatchObject({ code: '42501' });
});

test("a source's daily spend counts each request once, by the Tehran day and the kind of its run (CS-35)", async () => {
  // The seed logged one detail request; one more, at 23:00 UTC, is already the next Tehran day.
  await db.query(`UPDATE crawl_run SET status = 'succeeded', finished_at = now() WHERE id = $1`, [
    seeded.crawlRunId,
  ]);
  const sweep = await returningId(
    `INSERT INTO crawl_run (source_id, policy_check_id, kind) VALUES ('bama', $1, 'sweep') RETURNING id`,
    [seeded.policyCheckId],
  );
  await db.query(
    `INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome)
     VALUES ('bama', $1, 'https://bama.ir/car?page=1', '2026-09-30 23:00+00', 200, 'ok')`,
    [sweep],
  );
  const { rows } = await db.query<{
    tehran_day: Date;
    kind: string;
    requests: number;
    daily_request_budget: number;
  }>(
    `SELECT tehran_day, kind, requests, daily_request_budget FROM source_daily_spend
     WHERE source_id = 'bama' AND kind = 'sweep'`,
  );
  expect(
    rows.map((row) => [
      row.tehran_day.toISOString().slice(0, 10),
      row.kind,
      row.requests,
      row.daily_request_budget,
    ]),
  ).toEqual([['2026-10-01', 'sweep', 1, 12000]]);
  expect(await count(`SELECT sum(requests) AS count FROM source_daily_spend WHERE source_id = 'bama'`)).toBe(
    2,
  );
});

async function catalogueRows() {
  await db.exec(
    `INSERT INTO body_type (code, label_fa, position) VALUES ('hatchback', 'هاچ‌بک', 1), ('sedan', 'سدان', 2)`,
  );
  const peugeot = await returningId(
    `INSERT INTO make (slug, name_fa, name_en) VALUES ('peugeot', 'پژو', 'Peugeot') RETURNING id`,
  );
  const saipa = await returningId(
    `INSERT INTO make (slug, name_fa, name_en) VALUES ('saipa', 'سایپا', 'Saipa') RETURNING id`,
  );
  const p206 = await returningId(
    `INSERT INTO model (make_id, slug, name_fa, name_en, body_type) VALUES ($1, '206', 'پژو ۲۰۶', 'Peugeot 206', 'hatchback') RETURNING id`,
    [peugeot],
  );
  const tip5 = await returningId(
    `INSERT INTO trim (model_id, slug, name_fa, name_en) VALUES ($1, 'tip-5', 'پژو ۲۰۶ تیپ ۵', 'Peugeot 206 5') RETURNING id`,
    [p206],
  );
  return { peugeot, saipa, p206, tip5 };
}

test('fa_normalize folds the ways a name is typed into one (CS-50)', async () => {
  const { rows } = await db.query<{ a: string; same: boolean }>(
    `SELECT fa_normalize('پژو ۲۰۶  تيپ ٢') AS a,
            fa_normalize('پژو 206 تیپ 2') = fa_normalize('پژو ۲۰۶ تيپ ٢') AS same`,
  );
  expect(rows[0]).toEqual({ a: 'پژو 206 تیپ 2', same: true });
});

test('a source key names exactly one level of the catalogue, consistently with its parents (CS-50)', async () => {
  const { peugeot, saipa, p206, tip5 } = await catalogueRows();
  const insert = `INSERT INTO catalogue_source_key (source_id, source_model_key, level, make_id, model_id, trim_id)
                  VALUES ('bama', $1, $2, $3, $4, $5)`;
  await db.query(insert, ['Peugeot', 'make', peugeot, null, null]);
  await db.query(insert, ['Peugeot 206', 'model', peugeot, p206, null]);
  await db.query(insert, ['Peugeot 206 5', 'trim', peugeot, p206, tip5]);
  expect(await failure(insert, ['Peugeot 206 X', 'trim', peugeot, p206, null])).toMatchObject({
    code: '23514',
    constraint: 'catalogue_source_key_level_matches',
  });
  // A model of another make is refused by the composite key.
  expect(await failure(insert, ['Saipa 206', 'model', saipa, p206, null])).toMatchObject({
    code: '23503',
    constraint: 'catalogue_source_key_model_fk',
  });
  expect(await failure(insert, ['Peugeot 206', 'model', peugeot, p206, null])).toMatchObject({
    code: '23505',
    constraint: 'catalogue_source_key_pkey',
  });
});

test('an alias names one target, once per normalised spelling and source (CS-50)', async () => {
  const { peugeot, p206 } = await catalogueRows();
  const insert = `INSERT INTO catalogue_alias (make_id, model_id, alias, script, status) VALUES ($1, $2, $3, $4, 'curated')`;
  await db.query(insert, [null, p206, '۲۰۶', 'fa']);
  // «206» normalises to the same text: one alias per spelling.
  expect(await failure(insert, [null, p206, '206', 'latin'])).toMatchObject({
    code: '23505',
    constraint: 'catalogue_alias_unique',
  });
  expect(await failure(insert, [peugeot, p206, 'پژو ۲۰۶', 'fa'])).toMatchObject({
    code: '23514',
    constraint: 'catalogue_alias_one_target',
  });
  expect(await failure(insert, [null, p206, 'دویست و شش', 'arabic'])).toMatchObject({
    code: '23514',
    constraint: 'catalogue_alias_script_valid',
  });
});

test("a listing's catalogue match is one explicit state, consistent with its make, model and trim (CS-50)", async () => {
  const { peugeot, saipa, p206, tip5 } = await catalogueRows();
  const set = `UPDATE listing SET catalogue_match = $2, make_id = $3, model_id = $4, trim_id = $5 WHERE id = $1`;
  await db.query(set, [seeded.listingId, 'trim', peugeot, p206, tip5]);
  await db.query(set, [seeded.listingId, 'model', peugeot, p206, null]);
  await db.query(set, [seeded.listingId, 'unmatched', null, null, null]);
  expect(await failure(set, [seeded.listingId, 'model', peugeot, null, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_catalogue_match_consistent',
  });
  expect(await failure(set, [seeded.listingId, 'unmatched', peugeot, null, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_catalogue_match_consistent',
  });
  expect(await failure(set, [seeded.listingId, 'model', saipa, p206, null])).toMatchObject({
    code: '23503',
    constraint: 'listing_model_fk',
  });
});

async function valuationRun(asOf = '2026-09-30', status = 'running'): Promise<number> {
  const done = status !== 'running';
  const count = status === 'succeeded' ? 10 : null;
  return returningId(
    `INSERT INTO valuation_run (as_of_date, method_version, status, reference_year_sh, mileage_norm_km_per_year,
                                window_days, prior_strength, comparable_count, valued_count, rated_count, finished_at)
     VALUES ($1, 1, $2, 1405, 20000, 30, 20, $3, $3, $3, CASE WHEN $4 THEN now() END) RETURNING id`,
    [asOf, status, count, done],
  );
}

test('a valuation run is finished exactly when it is done, and one run of a day and method succeeds (CS-51)', async () => {
  await valuationRun('2026-09-30', 'succeeded');
  expect(await failure(`UPDATE valuation_run SET finished_at = NULL`)).toMatchObject({
    code: '23514',
    constraint: 'valuation_run_finished_when_done',
  });
  expect(
    await failure(`UPDATE valuation_run SET comparable_count = NULL WHERE status = 'succeeded'`),
  ).toMatchObject({ code: '23514', constraint: 'valuation_run_counts_when_succeeded' });
  const again = await valuationRun('2026-09-30');
  expect(
    await failure(
      `UPDATE valuation_run SET status = 'succeeded', finished_at = now(), comparable_count = 1,
                          valued_count = 1, rated_count = 1 WHERE id = $1`,
      [again],
    ),
  ).toMatchObject({ code: '23505', constraint: 'valuation_run_succeeded_unique' });
  // A failed run of the same day is allowed beside it.
  await db.query(`UPDATE valuation_run SET status = 'failed', finished_at = now() WHERE id = $1`, [again]);
});

test('a coefficient names exactly the scope its term needs (CS-51)', async () => {
  const { p206, tip5 } = await catalogueRows();
  const run = await valuationRun();
  const insert = `INSERT INTO valuation_coefficient (valuation_run_id, term, model_id, trim_id, coefficient) VALUES ($1, $2, $3, $4, 0.1)`;
  await db.query(insert, [run, 'mileage_deviation', null, null]);
  await db.query(insert, [run, 'model_level', p206, null]);
  await db.query(insert, [run, 'trim_level', p206, tip5]);
  expect(await failure(insert, [run, 'mileage_deviation', null, null])).toMatchObject({
    code: '23505',
    constraint: 'valuation_coefficient_term_scope_unique',
  });
  expect(await failure(insert, [run, 'zero_km', p206, null])).toMatchObject({
    code: '23514',
    constraint: 'valuation_coefficient_scope_matches_term',
  });
  expect(await failure(insert, [run, 'model_age_slope', null, null])).toMatchObject({
    code: '23514',
    constraint: 'valuation_coefficient_scope_matches_term',
  });
  expect(await failure(insert, [run, 'colour', null, null])).toMatchObject({
    code: '23514',
    constraint: 'valuation_coefficient_term_valid',
  });
});

test('a listing valuation holds a rating with its numbers or exactly one reason for none (CS-51 #4)', async () => {
  const run = await valuationRun();
  const insert = `INSERT INTO listing_valuation (valuation_run_id, listing_id, asking_price_toman, market_value_toman,
                                                price_gap_pct, deal_rating, no_rating_reason)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)`;
  const other = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
    VALUES ('bama', 'ad-1002', 'https://bama.ir/car/ad-1002', 'active', now(), now()) RETURNING id`);
  const third = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
    VALUES ('bama', 'ad-1003', 'https://bama.ir/car/ad-1003', 'active', now(), now()) RETURNING id`);
  await db.query(insert, [run, seeded.listingId, 1_000_000_000, 1_100_000_000, -9.09, 'good', null]);
  await db.query(insert, [run, other, null, 1_100_000_000, null, null, 'no_asking_price']);
  expect(
    await failure(insert, [run, third, 1_000_000_000, 1_100_000_000, -9.09, 'good', 'price_outlier']),
  ).toMatchObject({ code: '23514', constraint: 'listing_valuation_rating_or_reason' });
  expect(await failure(insert, [run, third, null, null, null, null, null])).toMatchObject({
    code: '23514',
    constraint: 'listing_valuation_rating_or_reason',
  });
  expect(await failure(insert, [run, third, null, 1_100_000_000, null, 'fair', null])).toMatchObject({
    code: '23514',
    constraint: 'listing_valuation_rating_has_numbers',
  });
  expect(
    await failure(insert, [run, third, 1_000_000_000, 1_100_000_000, -9.09, null, 'price_outlier']),
  ).toMatchObject({
    code: '23514',
    constraint: 'listing_valuation_gap_only_when_rated',
  });
  expect(await failure(insert, [run, third, null, null, null, null, 'too_expensive'])).toMatchObject({
    code: '23514',
    constraint: 'listing_valuation_no_rating_reason_valid',
  });
  expect(await failure(insert, [run, third, 0, null, null, null, 'unknown_price'])).toMatchObject({
    code: '23514',
    constraint: 'listing_valuation_asking_price_toman_range',
  });
  // The ratings are ordered: "good or better" is a comparison.
  expect(
    await count(
      `SELECT count(*) FROM listing_valuation WHERE deal_rating <= 'good' AND valuation_run_id = $1`,
      [run],
    ),
  ).toBe(1);
});

test('a comparable shown beside a listing is never the listing itself (CS-51)', async () => {
  const { p206 } = await catalogueRows();
  const run = await valuationRun();
  await db.query(
    `INSERT INTO valuation_segment (valuation_run_id, model_id, comparable_count, zero_km_count, min_model_year_sh,
                                    max_model_year_sh, error_pct, rates_listings) VALUES ($1, $2, 1, 0, 1400, 1400, 5, true)`,
    [run, p206],
  );
  await db.query(
    `INSERT INTO valuation_comparable (valuation_run_id, listing_id, model_id, model_year_sh, mileage_km,
                                       asking_price_toman, fitted_value_toman, is_outlier)
     VALUES ($1, $2, $3, 1400, 100000, 1000000000, 1000000000, false)`,
    [run, seeded.listingId, p206],
  );
  await db.query(
    `INSERT INTO listing_valuation (valuation_run_id, listing_id, asking_price_toman, market_value_toman, price_gap_pct,
                                    deal_rating) VALUES ($1, $2, 1000000000, 1000000000, 0, 'fair')`,
    [run, seeded.listingId],
  );
  expect(
    await failure(
      `INSERT INTO listing_valuation_comparable (valuation_run_id, listing_id, comparable_listing_id, position,
                                                 asking_price_toman, adjusted_price_toman)
       VALUES ($1, $2, $2, 1, 1000000000, 1000000000)`,
      [run, seeded.listingId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'listing_valuation_comparable_not_itself' });
  expect(
    await failure(
      `INSERT INTO valuation_segment (valuation_run_id, model_id, comparable_count, zero_km_count, min_model_year_sh,
                                      max_model_year_sh, error_pct, rates_listings) VALUES ($1, $2, 1, 0, 1401, 1400, 5, false)`,
      [run, p206],
    ),
  ).toMatchObject({ code: '23514', constraint: 'valuation_segment_years_ordered' });
  expect(
    await failure(
      `INSERT INTO valuation_segment (valuation_run_id, model_id, comparable_count, zero_km_count, min_model_year_sh,
                                      max_model_year_sh, error_pct, rates_listings) VALUES ($1, $2, 1, 0, 1400, 1400, NULL, true)`,
      [run, p206],
    ),
  ).toMatchObject({ code: '23514', constraint: 'valuation_segment_rates_with_error' });
});

// The worker and pipeline screens (CS-41).

test("a worker's heartbeat names its process and release, and never beats or stops before it started", async () => {
  const insert = `INSERT INTO worker_heartbeat (instance_id, hostname, pid, version, started_at, beat_at, stopped_at)
                  VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`;
  const start = '2026-09-30 10:00:00+00';
  await db.query(insert, ['worker-1', 4242, 'abc1234', start, start, null]);
  for (const [params, constraint] of [
    [[' ', 1, 'v', start, start, null], 'worker_heartbeat_hostname_format'],
    [['h', 0, 'v', start, start, null], 'worker_heartbeat_pid_positive'],
    [['h', 1, '', start, start, null], 'worker_heartbeat_version_format'],
    [['h', 1, 'v', start, '2026-09-30 09:59:59+00', null], 'worker_heartbeat_beat_after_start'],
    [['h', 1, 'v', start, start, '2026-09-30 09:00:00+00'], 'worker_heartbeat_stop_after_start'],
  ] as const) {
    expect(await failure(insert, [...params])).toMatchObject({ code: '23514', constraint });
  }
  const { rows } = await db.query<{ instance_id: string }>(`SELECT instance_id FROM worker_heartbeat`);
  expect(
    await failure(
      `INSERT INTO worker_heartbeat (instance_id, hostname, pid, version, started_at, beat_at)
       VALUES ($1, 'h', 1, 'v', now(), now())`,
      [rows[0]?.instance_id],
    ),
  ).toMatchObject({ code: '23505', constraint: 'worker_heartbeat_instance_unique' });
});

const JOB_QUEUE = 'crawl.bama';

async function seedJob(state: string): Promise<string> {
  await db.query(
    `INSERT INTO pgboss.queue (name, policy, retry_limit, retry_delay, retry_backoff, expire_seconds, retention_seconds,
                               deletion_seconds, partition, table_name)
     VALUES ($1, 'standard', 2, 0, false, 900, 1209600, 604800, false, 'job_common')
     ON CONFLICT (name) DO NOTHING`,
    [JOB_QUEUE],
  );
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO pgboss.job (name, state, data, retry_count, retry_limit, start_after, keep_until, completed_on, output)
     VALUES ($1, $2::pgboss.job_state, '{"kind": "crawl.bama-listing"}', 2, 2, now() - interval '20 days',
             now() - interval '6 days', CASE WHEN $2 = 'failed' THEN now() - interval '1 hour' END,
             '{"type": "TypeError", "message": "boom"}')
     RETURNING id`,
    [JOB_QUEUE, state],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('no job');
  return id;
}

async function changeJob(jobId: string, seenState: string, action: string | null, accountId: number) {
  const { rows } = await db.query<{ outcome: string }>(
    `SELECT change_job_state($1, $2, $3, $4, $5) AS outcome`,
    [JOB_QUEUE, jobId, seenState, action, accountId],
  );
  return rows[0]?.outcome;
}

async function jobRow(jobId: string) {
  const { rows } = await db.query<{
    state: string;
    retry_limit: number;
    completed_on: Date | null;
    runnable: boolean;
    kept: boolean;
  }>(
    `SELECT state::text, retry_limit, completed_on, start_after <= now() AS runnable,
            keep_until >= now() + interval '14 days' AS kept
     FROM pgboss.job WHERE id = $1`,
    [jobId],
  );
  return rows[0];
}

test('a superadmin retries a failed job once, as pg-boss would, and the retry is recorded with who and when', async () => {
  const superadminId = await account('pedram', 'superadmin');
  const jobId = await seedJob('failed');
  await db.exec('SET LOCAL ROLE carshenas_admin');
  expect(await changeJob(jobId, 'failed', 'retry', superadminId)).toBe('changed');
  // A repeated press changes nothing.
  expect(await changeJob(jobId, 'failed', 'retry', superadminId)).toBe('unchanged');
  await db.exec('RESET ROLE');
  expect(await jobRow(jobId)).toEqual({
    state: 'retry',
    retry_limit: 3,
    completed_on: null,
    runnable: true,
    // Its keep_until had passed; pg-boss's maintenance would have deleted the retried job at once. It is kept for
    // its queue's retention (14 days) from now.
    kept: true,
  });
  const { rows } = await db.query<{ action: string; from_state: string; changed_by_account_id: number }>(
    `SELECT action, from_state, changed_by_account_id::integer FROM job_state_change WHERE job_id = $1`,
    [jobId],
  );
  expect(rows).toEqual([{ action: 'retry', from_state: 'failed', changed_by_account_id: superadminId }]);
});

test('a superadmin cancels a job waiting to run again, and a stale page or a job the action does not fit changes nothing', async () => {
  const superadminId = await account('pedram', 'superadmin');
  const waiting = await seedJob('retry');
  const failed = await seedJob('failed');
  const running = await seedJob('active');
  expect(await changeJob(waiting, 'retry', 'cancel', superadminId)).toBe('changed');
  expect(await changeJob(waiting, 'retry', 'cancel', superadminId)).toBe('unchanged');
  expect((await jobRow(waiting))?.state).toBe('cancelled');
  // The page showed it failed, but it was retried meanwhile: nothing changes.
  expect(await changeJob(failed, 'created', 'retry', superadminId)).toBe('stale');
  // A failed job is retried, not cancelled; a running job is neither.
  expect(await changeJob(failed, 'failed', 'cancel', superadminId)).toBe('stale');
  expect(await changeJob(running, 'active', 'cancel', superadminId)).toBe('stale');
  expect(await changeJob(running, 'active', 'retry', superadminId)).toBe('stale');
  // A job pg-boss has deleted.
  expect(await changeJob('00000000-0000-4000-8000-000000000000', 'failed', 'retry', superadminId)).toBe(
    'stale',
  );
  expect((await jobRow(failed))?.state).toBe('failed');
  expect((await jobRow(running))?.state).toBe('active');
  const { rows } = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM job_state_change`);
  expect(rows[0]?.count).toBe(1);
});

test('only a superadmin retries or cancels a job, only through the function, and its history is never rewritten', async () => {
  const buyerId = await account('ali_1403');
  const superadminId = await account('pedram', 'superadmin');
  const jobId = await seedJob('failed');
  expect(
    await failure(`SELECT change_job_state($1, $2, 'failed', 'retry', $3)`, [JOB_QUEUE, jobId, buyerId]),
  ).toMatchObject({
    code: '23514',
    constraint: 'job_state_change_by_superadmin',
  });
  expect(
    await failure(`SELECT change_job_state($1, $2, 'failed', 'delete', $3)`, [
      JOB_QUEUE,
      jobId,
      superadminId,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'job_state_change_action_valid' });
  expect(
    await failure(
      `INSERT INTO job_state_change (queue, job_id, action, from_state, changed_by_account_id)
       VALUES ($1, $2, 'retry', 'active', $3)`,
      [JOB_QUEUE, jobId, superadminId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'job_state_change_from_state_valid' });
  await changeJob(jobId, 'failed', 'retry', superadminId);
  expect(await failure(`UPDATE job_state_change SET action = 'cancel'`)).toMatchObject({ code: '23000' });
  expect(await failure(`DELETE FROM job_state_change`)).toMatchObject({ code: '23000' });

  await db.exec('SET LOCAL ROLE carshenas_admin');
  expect(await failure(`UPDATE pgboss.job SET state = 'retry' WHERE id = $1`, [jobId])).toMatchObject({
    code: '42501',
  });
  expect(
    await failure(
      `INSERT INTO job_state_change (queue, job_id, action, from_state, changed_by_account_id)
       VALUES ($1, $2, 'retry', 'failed', $3)`,
      [JOB_QUEUE, jobId, superadminId],
    ),
  ).toMatchObject({ code: '42501' });
  await db.exec('RESET ROLE');
  for (const role of ['carshenas_web', 'carshenas_worker']) {
    await db.exec(`SET LOCAL ROLE ${role}`);
    expect(
      await failure(`SELECT change_job_state($1, $2, 'failed', 'retry', $3)`, [
        JOB_QUEUE,
        jobId,
        superadminId,
      ]),
    ).toMatchObject({ code: '42501' });
    await db.exec('RESET ROLE');
  }
});

/** Notifies an account through the only way in (CS-68); the new id, or null when muted or already told. */
async function notify(
  accountId: number,
  eventKey = 'price_event:1',
  kind = 'listing_price_drop',
): Promise<number | null> {
  const { rows } = await db.query<{ id: number | bigint | null }>(
    `SELECT create_notification($1, $2, $3, '{"carName": "پژو ۲۰۶"}', $4) AS id`,
    [accountId, kind, eventKey, seeded.listingId],
  );
  const id = rows[0]?.id;
  return id === null || id === undefined ? null : Number(id);
}

test('each event notifies each buyer once, and never a buyer who muted its kind (CS-68 #3, #4)', async () => {
  const buyerId = await account('ali_1403');
  const otherId = await account('sara_1402');
  const first = await notify(buyerId);
  expect(first).toEqual(expect.any(Number));
  // The same event again, as a job that ran twice sends it: nothing new.
  expect(await notify(buyerId)).toBeNull();
  expect(await notify(otherId)).toEqual(expect.any(Number));
  expect(await notify(buyerId, 'price_event:2')).toEqual(expect.any(Number));
  await db.query(`INSERT INTO notification_mute (account_id, kind) VALUES ($1, 'listing_price_drop')`, [
    buyerId,
  ]);
  expect(await notify(buyerId, 'price_event:3')).toBeNull();
  expect(await count(`SELECT count(*) FROM notification WHERE account_id = $1`, [buyerId])).toBe(2);
  expect(
    await failure(`INSERT INTO notification_mute (account_id, kind) VALUES ($1, 'listing_price_drop')`, [
      buyerId,
    ]),
  ).toMatchObject({ code: '23505', constraint: 'notification_mute_once_unique' });
  expect(
    await failure(`INSERT INTO notification_mute (account_id, kind) VALUES ($1, 'no_such_kind')`, [buyerId]),
  ).toMatchObject({ code: '23503', constraint: 'notification_mute_kind_fk' });
});

test('a notification names a known kind, an event key, a small object of facts and a read time after it was made (CS-68)', async () => {
  const buyerId = await account('ali_1403');
  expect(
    await failure(`SELECT create_notification($1, 'no_such_kind', 'price_event:1', '{}')`, [buyerId]),
  ).toMatchObject({
    code: '23503',
    constraint: 'notification_kind_fk',
  });
  for (const eventKey of [
    '',
    'price_event',
    'price event:1',
    'Price_event:1',
    `price_event:${'9'.repeat(161)}`,
  ]) {
    expect(
      await failure(`SELECT create_notification($1, 'listing_price_drop', $2, '{}', $3)`, [
        buyerId,
        eventKey,
        seeded.listingId,
      ]),
    ).toMatchObject({ code: '23514', constraint: 'notification_event_key_format' });
  }
  expect(
    await failure(`SELECT create_notification($1, 'listing_price_drop', 'price_event:1', '[1, 2]', $2)`, [
      buyerId,
      seeded.listingId,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'notification_payload_object' });
  expect(
    await failure(`SELECT create_notification($1, 'listing_price_drop', 'price_event:1', $2, $3)`, [
      buyerId,
      JSON.stringify({ note: 'x'.repeat(5000) }),
      seeded.listingId,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'notification_payload_small' });
  expect(
    await failure(`SELECT create_notification(-1, 'listing_price_drop', 'price_event:1', '{}', $1)`, [
      seeded.listingId,
    ]),
  ).toMatchObject({
    code: '23503',
    constraint: 'notification_account_fk',
  });
  // A listing's kind names its listing, so the inbox always has something to link to.
  expect(
    await failure(`SELECT create_notification($1, 'listing_price_drop', 'price_event:1', '{}')`, [buyerId]),
  ).toMatchObject({ code: '23514', constraint: 'notification_listing_kind_has_listing' });
  const id = await notify(buyerId);
  expect(
    await failure(`UPDATE notification SET read_at = created_at - interval '1 second' WHERE id = $1`, [id]),
  ).toMatchObject({ code: '23514', constraint: 'notification_read_after_created' });
  expect(
    await failure(`INSERT INTO notification_kind (id, description) VALUES ('Price Drop', 'x')`),
  ).toMatchObject({
    code: '23514',
    constraint: 'notification_kind_id_format',
  });
});

test('a purged listing or a deleted account takes its notifications and mutes with it (CS-68)', async () => {
  const buyerId = await account('ali_1403');
  await notify(buyerId);
  await db.query(`INSERT INTO notification_mute (account_id, kind) VALUES ($1, 'listing_price_drop')`, [
    buyerId,
  ]);
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.query(`DELETE FROM listing WHERE id = $1`, [seeded.listingId]);
  expect(await count(`SELECT count(*) FROM notification WHERE account_id = $1`, [buyerId])).toBe(0);
  await db.query(`DELETE FROM account WHERE id = $1`, [buyerId]);
  expect(await count(`SELECT count(*) FROM notification_mute WHERE account_id = $1`, [buyerId])).toBe(0);
});

test('producers write only through the function; the web app reads, marks read and mutes, and never creates (CS-68)', async () => {
  const buyerId = await account('ali_1403');
  const insert = `INSERT INTO notification (account_id, kind, event_key, payload) VALUES ($1, 'listing_price_drop', 'price_event:9', '{}')`;
  for (const role of ['carshenas_worker', 'carshenas_admin']) {
    await db.exec(`SET LOCAL ROLE ${role}`);
    expect(await failure(insert, [buyerId])).toMatchObject({ code: '42501' });
    expect(await notify(buyerId, `price_event:${role === 'carshenas_worker' ? '10' : '11'}`)).toEqual(
      expect.any(Number),
    );
    await db.exec('RESET ROLE');
  }
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await failure(insert, [buyerId])).toMatchObject({ code: '42501' });
  expect(
    await failure(`SELECT create_notification($1, 'listing_price_drop', 'price_event:12', '{}')`, [buyerId]),
  ).toMatchObject({
    code: '42501',
  });
  expect(await count(`SELECT count(*) FROM notification WHERE account_id = $1`, [buyerId])).toBe(2);
  await db.query(`UPDATE notification SET read_at = now() WHERE account_id = $1`, [buyerId]);
  expect(
    await failure(`UPDATE notification SET payload = '{}' WHERE account_id = $1`, [buyerId]),
  ).toMatchObject({
    code: '42501',
  });
  expect(await failure(`DELETE FROM notification WHERE account_id = $1`, [buyerId])).toMatchObject({
    code: '42501',
  });
  await db.query(`INSERT INTO notification_mute (account_id, kind) VALUES ($1, 'listing_price_drop')`, [
    buyerId,
  ]);
  await db.query(`DELETE FROM notification_mute WHERE account_id = $1`, [buyerId]);
  expect(
    await failure(`INSERT INTO notification_kind (id, description) VALUES ('made_up', 'x')`),
  ).toMatchObject({
    code: '42501',
  });
  await db.exec('RESET ROLE');
});

/** An extraction of the seeded snapshot through a stored answer (CS-52). */
async function extraction(status = 'usable', holdReasons: string[] = []): Promise<number> {
  const [statement, params] = aiAnswer();
  await db.query(statement, params);
  return returningId(
    `INSERT INTO extraction (snapshot_id, listing_id, ai_answer_id, status, hold_reasons)
     VALUES ($1, $2, (SELECT max(id) FROM ai_answer), $3, $4) RETURNING id`,
    [seeded.snapshotId, seeded.listingId, status, holdReasons],
  );
}

test("an extraction belongs to its snapshot's listing, once per answer, and is held exactly when it has a reason (CS-52)", async () => {
  const id = await extraction();
  const copy = `INSERT INTO extraction (snapshot_id, listing_id, ai_answer_id, status, hold_reasons)
                SELECT snapshot_id, $2, ai_answer_id, $3, $4 FROM extraction WHERE id = $1`;
  expect(await failure(copy, [id, seeded.listingId, 'usable', []])).toMatchObject({
    code: '23505',
    constraint: 'extraction_snapshot_answer_unique',
  });
  const [statement, params] = aiAnswer({ cache_key: new Uint8Array(32).fill(0xcd) });
  await db.query(statement, params);
  const insert = `INSERT INTO extraction (snapshot_id, listing_id, ai_answer_id, status, hold_reasons)
                  VALUES ($1, $2, (SELECT max(id) FROM ai_answer), $3, $4)`;
  expect(await failure(insert, [seeded.snapshotId, seeded.listingId + 1000, 'usable', []])).toMatchObject({
    code: '23503',
    constraint: 'extraction_snapshot_fk',
  });
  expect(await failure(insert, [seeded.snapshotId, seeded.listingId, 'held', []])).toMatchObject({
    code: '23514',
    constraint: 'extraction_held_with_reason',
  });
  expect(
    await failure(insert, [seeded.snapshotId, seeded.listingId, 'held', ['rate_it_great']]),
  ).toMatchObject({
    code: '23514',
    constraint: 'extraction_hold_reasons_valid',
  });
  await db.query(insert, [seeded.snapshotId, seeded.listingId, 'held', ['addressed_model']]);
});

test('an extraction and its fields are never changed or removed outside a purge (CS-52)', async () => {
  const id = await extraction();
  await db.query(
    `INSERT INTO extraction_field (extraction_id, field, value, evidence, confidence, threshold, status)
     VALUES ($1, 'paint', 'partial', 'کاپوت رنگ', 1, 0.75, 'accepted')`,
    [id],
  );
  for (const statement of [
    `UPDATE extraction SET status = 'held', hold_reasons = '{addressed_model}'`,
    `DELETE FROM extraction`,
    `UPDATE extraction_field SET value = 'none'`,
    `DELETE FROM extraction_field`,
  ]) {
    expect(await failure(statement)).toMatchObject({ code: '23000' });
  }
  expect(await failure(`TRUNCATE extraction_field CASCADE`)).toMatchObject({
    code: '23000',
    constraint: 'extraction_field_append_only',
  });
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.query(`DELETE FROM snapshot WHERE id = $1`, [seeded.snapshotId]);
  expect(await count(`SELECT count(*) FROM extraction`)).toBe(0);
  expect(await count(`SELECT count(*) FROM extraction_field`)).toBe(0);
});

test('a field is accepted exactly at or above its threshold, and has evidence exactly when it states a value (CS-52 #2)', async () => {
  const id = await extraction();
  const insert = `INSERT INTO extraction_field (extraction_id, field, value, evidence, confidence, threshold, status)
                  VALUES ($1, $2, $3, $4, $5, 0.75, $6)`;
  await db.query(insert, [id, 'paint', 'partial', 'کاپوت رنگ', 1, 'accepted']);
  expect(await failure(insert, [id, 'swap', 'no', 'معاوضه ندارم', 0.6, 'accepted'])).toMatchObject({
    code: '23514',
    constraint: 'extraction_field_status_by_threshold',
  });
  expect(await failure(insert, [id, 'swap', 'no', '', 1, 'accepted'])).toMatchObject({
    code: '23514',
    constraint: 'extraction_field_evidence_with_value',
  });
  expect(await failure(insert, [id, 'mileage_km', '12000', '12000 km', 1, 'accepted'])).toMatchObject({
    code: '23503',
    constraint: 'extraction_field_def_fk',
  });
  expect(await failure(insert, [id, 'plate', 'Free Zone', 'منطقه آزاد', 1, 'accepted'])).toMatchObject({
    code: '23514',
    constraint: 'extraction_field_value_format',
  });
});

test('a review item names exactly the subject its kind needs, and a subject is open once (CS-52)', async () => {
  const id = await extraction();
  await db.query(
    `INSERT INTO extraction_field (extraction_id, field, value, evidence, confidence, threshold, status)
     VALUES ($1, 'swap', 'yes', 'معاوضه', 0.6, 0.75, 'needs_review')`,
    [id],
  );
  const field = `INSERT INTO review_item (kind, extraction_id, field) VALUES ('extraction_field', $1, 'swap')`;
  await db.query(field, [id]);
  expect(await failure(field, [id])).toMatchObject({
    code: '23505',
    constraint: 'review_item_open_subject_unique',
  });
  await db.query(`UPDATE review_item SET status = 'resolved', closed_at = now()`);
  await db.query(field, [id]);
  expect(
    await failure(`INSERT INTO review_item (kind, extraction_id) VALUES ('extraction_field', $1)`, [id]),
  ).toMatchObject({ code: '23514', constraint: 'review_item_subject_by_kind' });
  const invalid = `INSERT INTO review_item (kind, snapshot_id, task, prompt_version, outcome, problems)
                   VALUES ('answer_invalid', $1, 'listing.facts', '0123456789abcdef', $2, $3)`;
  await db.query(invalid, [seeded.snapshotId, 'invalid', JSON.stringify([{ path: 'paint', message: 'x' }])]);
  expect(await failure(invalid, [seeded.snapshotId, 'invalid', '[]'])).toMatchObject({
    code: '23505',
    constraint: 'review_item_open_subject_unique',
  });
  expect(await failure(invalid, [seeded.snapshotId, 'ok', '[]'])).toMatchObject({
    code: '23514',
    constraint: 'review_item_outcome_valid',
  });
  expect(
    await failure(`UPDATE review_item SET status = 'dismissed' WHERE kind = 'answer_invalid'`),
  ).toMatchObject({ code: '23514', constraint: 'review_item_closed_when_done' });
});

test('a paid call is recorded with its cost, an error with its reason, and never changed outside a purge (CS-52)', async () => {
  const insert = `INSERT INTO model_spend (task, prompt_version, model, outcome, error_reason, cost_usd_micros, estimated, snapshot_id)
                  VALUES ('listing.facts', '0123456789abcdef', 'gemini-3.7-flash', $1, $2, $3, $4, $5)`;
  await db.query(insert, ['invalid', null, 6400, false, seeded.snapshotId]);
  await db.query(insert, ['error', 'timeout', 10000, true, seeded.snapshotId]);
  expect(await failure(insert, ['error', null, 0, true, seeded.snapshotId])).toMatchObject({
    code: '23514',
    constraint: 'model_spend_reason_with_error',
  });
  expect(await failure(insert, ['ok', 'timeout', 0, false, seeded.snapshotId])).toMatchObject({
    code: '23514',
    constraint: 'model_spend_reason_with_error',
  });
  expect(await failure(insert, ['ok', null, -1, false, seeded.snapshotId])).toMatchObject({
    code: '23514',
    constraint: 'model_spend_cost_usd_micros_range',
  });
  expect(await failure(insert, ['cached', null, 0, false, seeded.snapshotId])).toMatchObject({
    code: '23514',
    constraint: 'model_spend_outcome_valid',
  });
  expect(await failure(`UPDATE model_spend SET cost_usd_micros = 0`)).toMatchObject({
    code: '23000',
    constraint: 'model_spend_append_only',
  });
  expect(await failure(`DELETE FROM model_spend`)).toMatchObject({ code: '23000' });
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.query(`DELETE FROM snapshot WHERE id = $1`, [seeded.snapshotId]);
  expect(await count(`SELECT count(*) FROM model_spend`)).toBe(0);
});

test('a published evaluation keeps its scores within their totals, once per prompt version and model (CS-66)', async () => {
  // The migration seeds CS-52's report of 2026-09-30; the web role reads it for the data-status page.
  await db.exec('SET LOCAL ROLE carshenas_web');
  expect(await count(`SELECT count(*) FROM ai_evaluation WHERE task = 'listing.facts'`)).toBe(1);
  expect(await count(`SELECT count(*) FROM valuation_run`)).toBe(0);
  expect(await count(`SELECT count(*) FROM valuation_segment`)).toBe(0);
  expect(await failure(`DELETE FROM ai_evaluation`)).toMatchObject({ code: '42501' });
  await db.exec('RESET ROLE');
  const insert = `INSERT INTO ai_evaluation (task, prompt_version, model, evaluated_on, items, items_right, fields_scored,
                    fields_right, injected_items, injected_held, report_path)
                  VALUES ('query.filters', $1, 'google/gemini-3.7-flash', '2026-10-01', $2, $3, $4, $5, $6, $7, $8)`;
  const good = ['0123456789abcdef', 50, 45, 400, 390, 0, 0, 'docs/evidence/query-filters/2026-10-01.md'];
  await db.query(insert, good);
  expect(await failure(insert, good)).toMatchObject({
    code: '23505',
    constraint: 'ai_evaluation_run_unique',
  });
  const variant = (index: number, value: unknown) => good.map((old, at) => (at === index ? value : old));
  expect(await failure(insert, variant(2, 51))).toMatchObject({
    code: '23514',
    constraint: 'ai_evaluation_items_range',
  });
  expect(await failure(insert, variant(4, 401))).toMatchObject({
    code: '23514',
    constraint: 'ai_evaluation_fields_range',
  });
  expect(await failure(insert, variant(6, 1))).toMatchObject({
    code: '23514',
    constraint: 'ai_evaluation_injected_range',
  });
  expect(await failure(insert, variant(7, 'https://example.com/report.md'))).toMatchObject({
    code: '23514',
    constraint: 'ai_evaluation_report_path_format',
  });
  expect(await failure(`UPDATE ai_evaluation SET items_right = 0`)).toMatchObject({
    code: '23000',
    constraint: 'ai_evaluation_append_only',
  });
});

// The search tables (CS-59, ADR-0028).

const SEARCH_DOCUMENT = `INSERT INTO search_document (
    listing_id, source_id, listed_at, last_seen_at, price_type, asking_price_toman, has_photo, photo_count,
    cover_photo_url, search_text, refreshed_at)
  VALUES ($1, 'bama', now(), now(), $2, $3, $4, $5, $6, 'پژو ۲۰۶ تیپ ۲', now())`;

test('a search document holds a listing whose details were read, within its ranges, and goes with the listing (CS-59)', async () => {
  const insert = (
    priceType: string | null,
    price: number | null,
    hasPhoto = false,
    photos = 0,
    cover: string | null = null,
  ) =>
    [SEARCH_DOCUMENT, [seeded.listingId, priceType, price, hasPhoto, photos, cover]] as [string, unknown[]];
  // A list row alone has no price_type, and is no row of the table.
  expect(await failure(...insert(null, null))).toMatchObject({ code: '23502', column: 'price_type' });
  expect(await failure(...insert('asking', 0))).toMatchObject({
    code: '23514',
    constraint: 'search_document_asking_price_toman_range',
  });
  expect(await failure(...insert('asking', 1_000_000_000_000_000))).toMatchObject({
    code: '23514',
    constraint: 'search_document_asking_price_toman_range',
  });
  // Photos are counted and the cover is the first of them: a flag and a count that disagree, or a cover without a
  // photo, is refused.
  expect(await failure(...insert('asking', 5, true, 0, 'https://x.test/1.jpg'))).toMatchObject({
    constraint: 'search_document_photos_counted',
  });
  expect(await failure(...insert('asking', 5, false, 0, 'https://x.test/1.jpg'))).toMatchObject({
    constraint: 'search_document_cover_with_photo',
  });
  expect(await failure(...insert('asking', 5, true, 2, null))).toMatchObject({
    constraint: 'search_document_cover_with_photo',
  });
  expect(
    await failure(SEARCH_DOCUMENT, [seeded.listingId + 1000, 'asking', 5, false, 0, null]),
  ).toMatchObject({ code: '23503', constraint: 'search_document_listing_fk' });
  await db.query(...insert('asking', 800_000_000, true, 3, 'https://x.test/1.jpg'));
  expect(await failure(...insert('asking', 800_000_000))).toMatchObject({
    code: '23505',
    constraint: 'search_document_pkey',
  });
  // The text is stored as written and searched as normalised: the Persian digits, the Arabic letters and the run-on
  // digit all find it.
  const { rows } = await db.query<{ found: boolean }>(
    `SELECT text_vector @@ search_tsquery($1) AS found FROM search_document WHERE listing_id = $2`,
    ['۲۰۶ تيپ ۲', seeded.listingId],
  );
  expect(rows[0]?.found).toBe(true);
  // The row goes with its listing (a purge removes the listing, its snapshots and now its document).
  await db.exec(`SET LOCAL carshenas.purge = 'on'`);
  await db.query(`DELETE FROM listing WHERE id = $1`, [seeded.listingId]);
  expect(await count(`SELECT count(*) FROM search_document`)).toBe(0);
});

test('the counts, the build events and the vocabulary refuse what they cannot hold (CS-59)', async () => {
  const facet = `INSERT INTO search_facet_count (facet, value, label_fa, "position", listing_count, changed_at)
                 VALUES ($1, $2, 'سدان', $3, $4, now())`;
  await db.query(facet, ['body_type', 'sedan', 1, 10]);
  await db.query(facet, ['seen', '', 0, 20]);
  expect(await failure(facet, ['colour', 'white', 1, 10])).toMatchObject({
    code: '23514',
    constraint: 'search_facet_count_facet_valid',
  });
  expect(await failure(facet, ['body_type', 'suv', 1, -1])).toMatchObject({
    constraint: 'search_facet_count_listing_count_nonnegative',
  });
  expect(await failure(facet, ['body_type', 'suv', -1, 1])).toMatchObject({
    constraint: 'search_facet_count_position_nonnegative',
  });
  expect(await failure(facet, ['body_type', 'sedan', 2, 11])).toMatchObject({
    code: '23505',
    constraint: 'search_facet_count_pkey',
  });
  const event = `INSERT INTO search_build_event (event, happened_at) VALUES ($1, now())`;
  await db.query(event, ['full_rebuild']);
  expect(await failure(event, ['half_rebuild'])).toMatchObject({
    code: '23514',
    constraint: 'search_build_event_event_valid',
  });
  expect(await failure(event, ['full_rebuild'])).toMatchObject({
    code: '23505',
    constraint: 'search_build_event_pkey',
  });
  const word = `INSERT INTO search_word (word, listing_count) VALUES ($1, $2)`;
  expect(await failure(word, ['  ', 3])).toMatchObject({ constraint: 'search_word_word_not_blank' });
  expect(await failure(word, ['سالم', 0])).toMatchObject({
    constraint: 'search_word_listing_count_positive',
  });
});

async function marksOf(listingId: number): Promise<number> {
  return count(`SELECT count(*) FROM search_document_stale WHERE listing_id = $1`, [listingId]);
}

test('a change to a listing, a photo, a text fact or a valuation run marks the listings whose rows may change (CS-59)', async () => {
  const id = seeded.listingId;
  expect(await marksOf(id)).toBe(0);
  // A list row (no details read) is not searchable: nothing about it marks it, a sweep that sees it again included.
  await db.query(`UPDATE listing SET last_seen_at = last_seen_at + interval '1 minute' WHERE id = $1`, [id]);
  const bare = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
    VALUES ('bama', 'ad-1002', 'https://bama.ir/car/ad-1002', 'active', now(), now()) RETURNING id`);
  expect(await marksOf(id)).toBe(0);
  expect(await marksOf(bare)).toBe(0);
  // Reading its details marks it; an update that changes nothing does not; each change is a mark of its own (a mark
  // has no unique key, so a writer never waits on a build that is taking the same one).
  await db.query(`UPDATE listing SET price_type = 'asking', asking_price_toman = 800000000 WHERE id = $1`, [
    id,
  ]);
  expect(await marksOf(id)).toBe(1);
  await db.query(`UPDATE listing SET price_type = 'asking' WHERE id = $1`, [id]);
  expect(await marksOf(id)).toBe(1);
  await db.query(`UPDATE listing SET last_seen_at = last_seen_at + interval '1 minute' WHERE id = $1`, [id]);
  expect(await marksOf(id)).toBe(2);
  // A new listing with details is marked at its insert, one without is not.
  const detailed = await returningId(`
    INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, price_type, asking_price_toman)
    VALUES ('bama', 'ad-1003', 'https://bama.ir/car/ad-1003', 'active', now(), now(), 'asking', 500000000) RETURNING id`);
  expect(await marksOf(detailed)).toBe(1);
  // Photos, whichever way they change.
  await db.query(
    `INSERT INTO listing_photo (listing_id, position, url) VALUES ($1, 1, 'https://x.test/1.jpg')`,
    [id],
  );
  expect(await marksOf(id)).toBe(3);
  await db.query(`UPDATE listing_photo SET url = 'https://x.test/2.jpg' WHERE listing_id = $1`, [id]);
  expect(await marksOf(id)).toBe(4);
  await db.query(`DELETE FROM listing_photo WHERE listing_id = $1`, [id]);
  expect(await marksOf(id)).toBe(5);
  // A text fact.
  const extractionId = await extraction();
  await db.query(
    `INSERT INTO extraction_field (extraction_id, field, value, evidence, confidence, threshold, status)
     VALUES ($1, 'paint', 'none', 'بدون رنگ', 1, 0.75, 'accepted')`,
    [extractionId],
  );
  expect(await marksOf(id)).toBe(6);
  // A valuation run that succeeds marks every active listing whose details are read, and no list row.
  const run = await returningId(`
    INSERT INTO valuation_run (as_of_date, method_version, status, reference_year_sh, mileage_norm_km_per_year, window_days, prior_strength)
    VALUES ('2098-01-01', 99, 'running', 1405, 20000, 30, 1) RETURNING id`);
  expect(await marksOf(id)).toBe(6);
  await db.query(
    `UPDATE valuation_run SET status = 'succeeded', finished_at = now(), comparable_count = 0, valued_count = 0, rated_count = 0 WHERE id = $1`,
    [run],
  );
  expect(await marksOf(id)).toBe(7);
  expect(await marksOf(detailed)).toBe(2);
  expect(await marksOf(bare)).toBe(0);
});

test('the table records that it changed, and a statement that changed no row records nothing (CS-59)', async () => {
  const happened = async () =>
    (
      await db.query<{ at: string }>(
        `SELECT happened_at::text AS at FROM search_build_event WHERE event = 'documents_changed'`,
      )
    ).rows[0]?.at;
  expect(await happened()).toBeUndefined();
  await db.query(SEARCH_DOCUMENT, [seeded.listingId, 'asking', 800_000_000, false, 0, null]);
  const inserted = await happened();
  expect(inserted).toBeDefined();
  // No row matched: no change.
  await db.query(`UPDATE search_document SET photo_count = 0 WHERE false`);
  await db.query(`DELETE FROM search_document WHERE false`);
  expect(await happened()).toBe(inserted);
  await db.query(`UPDATE search_document SET search_text = 'پژو'`);
  const updated = await happened();
  expect(updated && inserted && updated > inserted).toBe(true);
  await db.query(`DELETE FROM search_document`);
  const deleted = await happened();
  expect(deleted && updated && deleted > updated).toBe(true);
});

test('search_query replaces a typo only by a common word one edit away, and names the words that match nothing (CS-59)', async () => {
  await db.query(
    `INSERT INTO search_facet_count (facet, value, label_fa, "position", listing_count, changed_at)
     VALUES ('total', '', 'همه', 0, 3000, now())`,
  );
  for (const [word, listings] of [
    ['کارکرده', 200],
    ['سالم', 300],
    ['ویژه', 4],
    ['مدارک', 50],
    ['207i', 100],
    ['پژو', 900],
  ] as const)
    await db.query(`INSERT INTO search_word (word, listing_count) VALUES ($1, $2)`, [word, listings]);
  const plan = async (words: string) => {
    const { rows } = await db.query<{
      tsquery_text: string | null;
      corrections: { from: string; to: string }[];
      unmatched: string[];
    }>(`SELECT * FROM search_query($1)`, [words]);
    const [row] = rows;
    if (!row) throw new Error('no row');
    return row;
  };
  // Replaced, as the exact word: a substitution, a swap of neighbours.
  expect(await plan('کارکرذه')).toEqual({
    tsquery_text: "'کارکرده'",
    corrections: [{ from: 'کارکرذه', to: 'کارکرده' }],
    unmatched: [],
  });
  expect((await plan('سلام')).corrections).toEqual([{ from: 'سلام', to: 'سالم' }]);
  // Known, and the prefix of a known word: left as typed.
  expect(await plan('کارکرده')).toMatchObject({ corrections: [], unmatched: [] });
  expect(await plan('کارک')).toMatchObject({ tsquery_text: "'کارک':*", corrections: [], unmatched: [] });
  // Not replaced: under four letters, with a digit, rare, too far; each is named as matching nothing.
  expect(await plan('سلم')).toMatchObject({ corrections: [], unmatched: ['سلم'] });
  expect(await plan('208i')).toMatchObject({ corrections: [], unmatched: ['208i'] });
  expect(await plan('ویذه')).toMatchObject({ corrections: [], unmatched: ['ویذه'] });
  expect(await plan('مزدا')).toMatchObject({ corrections: [], unmatched: ['مزدا'] });
  expect(await plan('208')).toMatchObject({ corrections: [], unmatched: ['208'] });
  // At most three words of a query are tried.
  const many = await plan('کارکرذه سلام سالمم کارکردهه سالمی');
  expect(many.corrections.map((fix) => fix.to)).toEqual(['کارکرده', 'سالم', 'سالم']);
  expect(many.unmatched).toEqual(['کارکردهه', 'سالمی']);
  // Nothing to search.
  expect(await plan('!!! --')).toEqual({ tsquery_text: null, corrections: [], unmatched: [] });
  // The tsquery of the words, for a search that wants only that.
  const { rows } = await db.query<{ q: string }>(`SELECT search_tsquery($1)::text AS q`, ['پژو ۲۰۶']);
  expect(rows[0]?.q).toBe("'پژو':* & '206'");
});
