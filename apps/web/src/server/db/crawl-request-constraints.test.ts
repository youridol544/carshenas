// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { MAX_OPEN_REQUESTS_PER_ACCOUNT, MAX_REQUESTS_PER_FILE } from '@/lib/crawl-requests-rules';
import { createMigratedDatabase } from '@/server/db/schema-test-database';

// Crawl requests (CS-71, ADR-0033): what the schema itself enforces, proved by what PostgreSQL rejects, with the
// expected SQLSTATE and constraint name (code maps that pair to a result). Each test runs in a transaction that is
// rolled back, on a database migrated from db/migrations.

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDatabase();
});
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

async function account(username: string, role: 'buyer' | 'superadmin' = 'buyer'): Promise<number> {
  return returningId(`INSERT INTO account (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id`, [
    username,
    HASH,
    role,
  ]);
}

async function catalogue(): Promise<{
  modelId: number;
  otherModelId: number;
  trimId: number;
  otherTrimId: number;
}> {
  const makeId = await returningId(
    `INSERT INTO make (slug, name_en) VALUES ('peugeot', 'Peugeot') RETURNING id`,
  );
  const modelId = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, '206', '206') RETURNING id`,
    [makeId],
  );
  const otherModelId = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, '405', '405') RETURNING id`,
    [makeId],
  );
  const trimId = await returningId(
    `INSERT INTO trim (model_id, slug, name_en) VALUES ($1, 'type-5', 'Type 5') RETURNING id`,
    [modelId],
  );
  const otherTrimId = await returningId(
    `INSERT INTO trim (model_id, slug, name_en) VALUES ($1, 'glx', 'GLX') RETURNING id`,
    [otherModelId],
  );
  return { modelId, otherModelId, trimId, otherTrimId };
}

let fileCounter = 0;
async function searchFile(accountId: number): Promise<number> {
  fileCounter += 1;
  return returningId(
    `INSERT INTO search_file (account_id, name, search) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [
      accountId,
      `پرونده ${String(fileCounter)}`,
      JSON.stringify({ v: 1, filters: {}, q: `کلمه${String(fileCounter)}` }),
    ],
  );
}

async function request(modelId: number, trimId: number | null = null): Promise<number> {
  return returningId(`INSERT INTO crawl_request (model_id, trim_id) VALUES ($1, $2) RETURNING id`, [
    modelId,
    trimId,
  ]);
}

async function link(requestId: number, fileId: number): Promise<void> {
  await db.query(`INSERT INTO crawl_request_file (crawl_request_id, search_file_id) VALUES ($1, $2)`, [
    requestId,
    fileId,
  ]);
}

test('the numbers the app shows are the numbers the schema enforces', () => {
  expect([MAX_REQUESTS_PER_FILE, MAX_OPEN_REQUESTS_PER_ACCOUNT]).toEqual([3, 10]);
});

test('a scope has one request, whether a model or one of its trims, decided by the unique key (CS-71 #1)', async () => {
  const { modelId, trimId } = await catalogue();
  await request(modelId);
  expect(
    await failure(`INSERT INTO crawl_request (model_id, trim_id) VALUES ($1, NULL)`, [modelId]),
  ).toMatchObject({ code: '23505', constraint: 'crawl_request_once_per_scope_unique' });
  // A trim is its own scope; asking for it twice is one request again.
  await request(modelId, trimId);
  expect(
    await failure(`INSERT INTO crawl_request (model_id, trim_id) VALUES ($1, $2)`, [modelId, trimId]),
  ).toMatchObject({ code: '23505', constraint: 'crawl_request_once_per_scope_unique' });
  // The insert that lost the race maps to the existing request with ON CONFLICT, which is how the app asks.
  const { rows } = await db.query<{ id: number }>(
    `WITH made AS (
       INSERT INTO crawl_request (model_id, trim_id) VALUES ($1, NULL)
       ON CONFLICT ON CONSTRAINT crawl_request_once_per_scope_unique DO NOTHING RETURNING id)
     SELECT id FROM made UNION ALL SELECT id FROM crawl_request WHERE model_id = $1 AND trim_id IS NULL`,
    [modelId],
  );
  expect(rows).toHaveLength(1);
});

test('a trim cannot sit under another model', async () => {
  const { modelId, otherTrimId } = await catalogue();
  expect(
    await failure(`INSERT INTO crawl_request (model_id, trim_id) VALUES ($1, $2)`, [modelId, otherTrimId]),
  ).toMatchObject({ code: '23503', constraint: 'crawl_request_trim_fk' });
});

test('two buyers asking for one model share one request, and a file asks once (CS-71 #1, #6)', async () => {
  const { modelId } = await catalogue();
  const first = await searchFile(await account('ali_1403'));
  const second = await searchFile(await account('sara_1402'));
  const id = await request(modelId);
  await link(id, first);
  await link(id, second);
  expect(
    await failure(`INSERT INTO crawl_request_file (crawl_request_id, search_file_id) VALUES ($1, $2)`, [
      id,
      first,
    ]),
  ).toMatchObject({ code: '23505', constraint: 'crawl_request_file_pkey' });
  const { rows } = await db.query<{ demand: number }>(
    `SELECT count(DISTINCT f.account_id)::int AS demand
     FROM crawl_request_file l JOIN search_file f ON f.id = l.search_file_id WHERE l.crawl_request_id = $1`,
    [id],
  );
  expect(rows[0]?.demand).toBe(2);
});

test('a file asks for at most three requests, and an account has at most ten waiting (CS-71)', async () => {
  const { modelId, otherModelId, trimId, otherTrimId } = await catalogue();
  const buyer = await account('ali_1403');
  const file = await searchFile(buyer);
  await link(await request(modelId), file);
  await link(await request(modelId, trimId), file);
  await link(await request(otherModelId), file);
  const fourth = await request(otherModelId, otherTrimId);
  expect(
    await failure(`INSERT INTO crawl_request_file (crawl_request_id, search_file_id) VALUES ($1, $2)`, [
      fourth,
      file,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_request_per_file_limit' });

  // Ten waiting requests across files of one account; the eleventh is refused, another account is not limited.
  const makeId = await returningId(`INSERT INTO make (slug, name_en) VALUES ('many', 'Many') RETURNING id`);
  const requests: number[] = [];
  for (let index = 0; index < MAX_OPEN_REQUESTS_PER_ACCOUNT + 1; index += 1) {
    const modelOfMany = await returningId(
      `INSERT INTO model (make_id, slug, name_en) VALUES ($1, $2, $2) RETURNING id`,
      [makeId, `m${String(index)}`],
    );
    requests.push(await request(modelOfMany));
  }
  const heavy = await account('heavy_1403');
  let files = 0;
  for (const [index, id] of requests.slice(0, MAX_OPEN_REQUESTS_PER_ACCOUNT).entries()) {
    if (index % 3 === 0) files = await searchFile(heavy);
    await link(id, files);
  }
  const eleventh = requests[MAX_OPEN_REQUESTS_PER_ACCOUNT] ?? 0;
  expect(
    await failure(`INSERT INTO crawl_request_file (crawl_request_id, search_file_id) VALUES ($1, $2)`, [
      eleventh,
      files,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_request_per_account_limit' });
  // Another account is not limited by it, and an answered request frees a place.
  await link(eleventh, await searchFile(await account('light_1403')));
  const admin = await account('admin_1', 'superadmin');
  await db.query(`SELECT decide_crawl_request($1, 'pending', 'approved', NULL, $2)`, [requests[0], admin]);
  await link(eleventh, files);
});

test('a declined request cannot be joined', async () => {
  const { modelId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  const buyer = await account('ali_1403');
  const file = await searchFile(buyer);
  const id = await request(modelId);
  await link(id, file);
  await db.query(`SELECT decide_crawl_request($1, 'pending', 'declined', 'ظرفیت نداریم', $2)`, [id, admin]);
  const other = await searchFile(await account('sara_1402'));
  expect(
    await failure(`INSERT INTO crawl_request_file (crawl_request_id, search_file_id) VALUES ($1, $2)`, [
      id,
      other,
    ]),
  ).toMatchObject({ code: '23514', constraint: 'crawl_request_file_not_declined' });
});

test('a request says exactly what its state knows (CS-71)', async () => {
  const { modelId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  const id = await request(modelId);
  const update = (statement: string, ...params: unknown[]) => failure(statement, [id, ...params]);
  expect(await update(`UPDATE crawl_request SET state = 'approved' WHERE id = $1`)).toMatchObject({
    code: '23514',
    constraint: 'crawl_request_state_matches_decision',
  });
  expect(await update(`UPDATE crawl_request SET state = 'bogus' WHERE id = $1`)).toMatchObject({
    code: '23514',
  });
  expect(
    await update(
      'UPDATE crawl_request SET decided_by_account_id = $2, decided_at = now() WHERE id = $1',
      admin,
    ),
  ).toMatchObject({
    code: '23514',
    constraint: 'crawl_request_state_matches_decision',
  });
  // A decline needs its reason, plain text of 1 to 300 characters.
  expect(
    await update(
      "UPDATE crawl_request SET state = 'declined', decided_by_account_id = $2, decided_at = now() WHERE id = $1",
      admin,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_request_state_matches_decision' });
  expect(
    await update(
      "state = 'declined', decided_by_account_id = $2, decided_at = now(), decline_reason = '  '",
      admin,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_request_decline_reason_format' });
  expect(
    await update(
      "state = 'declined', decided_by_account_id = $2, decided_at = now(), decline_reason = repeat('الف', 101)",
      admin,
    ),
  ).toMatchObject({ code: '23514', constraint: 'crawl_request_decline_reason_format' });
  await db.query(
    `UPDATE crawl_request SET state = 'approved', decided_by_account_id = $2, decided_at = now() WHERE id = $1`,
    [id, admin],
  );
  expect(await update(`UPDATE crawl_request SET fulfilled_at = now() WHERE id = $1`)).toMatchObject({
    code: '23514',
    constraint: 'crawl_request_state_matches_decision',
  });
});

test('the superadmin approves and declines through the function, which records who and when and repeats safely (CS-71 #2, #3)', async () => {
  const { modelId, otherModelId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  const buyer = await account('ali_1403');
  const first = await request(modelId);
  const second = await request(otherModelId);
  const decide = async (id: number, seen: string, chosen: string, because: string | null, by = admin) => {
    const { rows } = await db.query<{ outcome: string }>(
      `SELECT decide_crawl_request($1, $2, $3, $4, $5) AS outcome`,
      [id, seen, chosen, because, by],
    );
    return rows[0]?.outcome;
  };

  expect(await decide(first, 'pending', 'approved', null)).toBe('changed');
  expect(await decide(first, 'pending', 'approved', null)).toBe('unchanged');
  // A person who saw it pending cannot decline what another already approved.
  expect(await decide(first, 'pending', 'declined', 'دیر شد')).toBe('stale');
  expect(await decide(999_999, 'pending', 'approved', null)).toBe('stale');
  const { rows } = await db.query<{ state: string; decided_by_account_id: number; decided_at: Date | null }>(
    `SELECT state, decided_by_account_id::int, decided_at FROM crawl_request WHERE id = $1`,
    [first],
  );
  expect(rows[0]).toMatchObject({ state: 'approved', decided_by_account_id: admin });
  expect(rows[0]?.decided_at).toBeInstanceOf(Date);

  expect(await decide(second, 'pending', 'declined', 'این مدل خارج از بازار تهران است')).toBe('changed');
  // Changed minds are recorded, not overwritten: declined, then approved.
  expect(await decide(second, 'declined', 'approved', null)).toBe('changed');
  const { rows: log } = await db.query<{ decision: string; from_state: string; reason: string | null }>(
    `SELECT decision, from_state, reason FROM crawl_request_decision WHERE crawl_request_id = $1 ORDER BY id`,
    [second],
  );
  expect(log).toEqual([
    { decision: 'declined', from_state: 'pending', reason: 'این مدل خارج از بازار تهران است' },
    { decision: 'approved', from_state: 'declined', reason: null },
  ]);
  // The approval cleared the decline's reason from the request.
  const { rows: cleared } = await db.query<{ decline_reason: string | null }>(
    `SELECT decline_reason FROM crawl_request WHERE id = $1`,
    [second],
  );
  expect(cleared[0]?.decline_reason).toBeNull();

  // A buyer is never the one who decides, and a decline needs its reason.
  expect(
    await failure(`SELECT decide_crawl_request($1, 'approved', 'declined', 'x', $2)`, [second, buyer]),
  ).toMatchObject({
    code: '23514',
    constraint: 'crawl_request_decision_by_superadmin',
  });
  expect(
    await failure(`SELECT decide_crawl_request($1, 'approved', 'fulfilled', NULL, $2)`, [second, admin]),
  ).toMatchObject({
    code: '23514',
    constraint: 'crawl_request_decision_valid',
  });
  expect(
    await failure(`SELECT decide_crawl_request($1, 'approved', 'declined', NULL, $2)`, [second, admin]),
  ).toBeDefined();

  // A fulfilled request (CS-53 sets it after the crawl read it) is no one's to change here.
  await db.query(
    `UPDATE crawl_request SET state = 'fulfilled', fulfilled_at = clock_timestamp() WHERE id = $1`,
    [first],
  );
  expect(await decide(first, 'fulfilled', 'declined', 'x')).toBe('stale');
});

test('decisions are append-only outside a purge, and the app roles are limited to their part (CS-71)', async () => {
  const { modelId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  const buyer = await account('ali_1403');
  const file = await searchFile(buyer);
  const id = await request(modelId);
  await link(id, file);
  await db.query(`SELECT decide_crawl_request($1, 'pending', 'approved', NULL, $2)`, [id, admin]);
  expect(await failure(`DELETE FROM crawl_request_decision`)).toBeDefined();
  expect(await failure(`UPDATE crawl_request_decision SET reason = 'x'`)).toBeDefined();

  // The web role asks and reads; it never decides, changes or deletes a request, nor records a decision.
  await db.exec('SET LOCAL ROLE carshenas_web');
  await db.query(`SELECT id, state, decline_reason FROM crawl_request`);
  await db.query(`SELECT crawl_request_id, search_file_id FROM crawl_request_file`);
  expect(await failure(`UPDATE crawl_request SET state = 'approved'`)).toMatchObject({ code: '42501' });
  expect(await failure(`DELETE FROM crawl_request`)).toMatchObject({ code: '42501' });
  expect(
    await failure("INSERT INTO crawl_request (model_id, state) VALUES ($1, 'approved')", [modelId]),
  ).toMatchObject({ code: '42501' });
  expect(
    await failure("SELECT decide_crawl_request($1, 'approved', 'declined', 'x', $2)", [id, admin]),
  ).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT * FROM crawl_request_decision`)).toMatchObject({ code: '42501' });
  await db.exec('RESET ROLE');

  // The superadmin section reads everything and decides only through the function.
  await db.exec('SET LOCAL ROLE carshenas_admin');
  await db.query(`SELECT * FROM crawl_request`);
  await db.query(`SELECT * FROM crawl_request_file`);
  await db.query(`SELECT * FROM crawl_request_decision`);
  expect(await failure(`UPDATE crawl_request SET state = 'pending'`)).toMatchObject({ code: '42501' });
  expect(
    await failure(
      "INSERT INTO crawl_request_decision (crawl_request_id, decision, from_state, decided_by_account_id) VALUES ($1, 'declined', 'approved', $2)",
      [id, admin],
    ),
  ).toMatchObject({ code: '42501' });
  await db.query("SELECT decide_crawl_request($1, 'approved', 'declined', 'ظرفیت', $2)", [id, admin]);
  await db.exec('RESET ROLE');
});

test('deleting a file or an account takes its links and leaves the request for the others (CS-71)', async () => {
  const { modelId } = await catalogue();
  const buyer = await account('ali_1403');
  const other = await account('sara_1402');
  const mine = await searchFile(buyer);
  const theirs = await searchFile(other);
  const id = await request(modelId);
  await link(id, mine);
  await link(id, theirs);
  await db.query(`DELETE FROM search_file WHERE id = $1`, [mine]);
  await db.query(`DELETE FROM account WHERE id = $1`, [other]);
  const { rows } = await db.query<{ links: number; requests: number }>(
    `SELECT (SELECT count(*) FROM crawl_request_file)::int AS links, (SELECT count(*) FROM crawl_request)::int AS requests`,
  );
  expect(rows[0]).toEqual({ links: 0, requests: 1 });
});

test('a model read in depth is the one a source key of the latest measurement names (CS-71)', async () => {
  const { modelId, otherModelId } = await catalogue();
  const makeId = await returningId('SELECT make_id AS id FROM model WHERE id = $1', [modelId]);
  await db.query(
    `INSERT INTO catalogue_source_key (source_id, source_model_key, level, make_id, model_id) VALUES ('divar', 'Peugeot 206', 'model', $1, $2)`,
    [makeId, modelId],
  );
  await db.exec(`
    INSERT INTO freshness_measurement (source_id, source_model_key, measured_at, new_listings, left_market, active_listings, seen_within_48h)
    VALUES ('divar', 'Peugeot 206', '2026-10-01 05:00+00', 1, 0, 5, 5);`);
  const { rows } = await db.query<{ model_id: number }>(`SELECT model_id::int FROM tracked_model_scope`);
  expect(rows).toEqual([{ model_id: modelId }]);
  expect(otherModelId).not.toBe(modelId);
});
