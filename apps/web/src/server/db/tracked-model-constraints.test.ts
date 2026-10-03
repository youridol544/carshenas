// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createMigratedDatabase } from '@/server/db/schema-test-database';

// Tracked models (CS-53, ADR-0037): what the schema itself enforces and what its functions do, proved by what
// PostgreSQL rejects (SQLSTATE and constraint name) and by the rows left behind. Each test runs in a transaction that
// is rolled back, on a database migrated from db/migrations.

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

async function change(
  modelId: number,
  trimId: number | null,
  action: string,
  priority: string | null,
  by: number,
): Promise<string | undefined> {
  const { rows } = await db.query<{ outcome: string }>(
    `SELECT change_tracked_model($1, $2, $3, $4, $5) AS outcome`,
    [modelId, trimId, action, priority, by],
  );
  return rows[0]?.outcome;
}

async function request(modelId: number, trimId: number | null = null): Promise<number> {
  return returningId(`INSERT INTO crawl_request (model_id, trim_id) VALUES ($1, $2) RETURNING id`, [
    modelId,
    trimId,
  ]);
}

async function decide(id: number, seen: string, chosen: string, because: string | null, by: number) {
  const { rows } = await db.query<{ outcome: string }>(
    `SELECT decide_crawl_request($1, $2, $3, $4, $5) AS outcome`,
    [id, seen, chosen, because, by],
  );
  return rows[0]?.outcome;
}

type TrackedRow = {
  state: string;
  priority: string;
  origin: string;
  created_by_account_id: number | null;
  crawl_request_id: number | null;
};

async function tracked(modelId: number, trimId: number | null = null): Promise<TrackedRow | undefined> {
  const { rows } = await db.query<TrackedRow>(
    `SELECT state, priority, origin, created_by_account_id::int, crawl_request_id::int
     FROM tracked_model WHERE model_id = $1 AND trim_id IS NOT DISTINCT FROM $2`,
    [modelId, trimId],
  );
  return rows[0];
}

async function actions(modelId: number): Promise<string[]> {
  const { rows } = await db.query<{ action: string }>(
    `SELECT action FROM tracked_model_change WHERE model_id = $1 ORDER BY id`,
    [modelId],
  );
  return rows.map((row) => row.action);
}

test('a scope is tracked once, a trim stays under its model, and every row says how it came to be (CS-53 #6, #7)', async () => {
  const { modelId, trimId, otherTrimId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  await db.query(`INSERT INTO tracked_model (model_id, origin) VALUES ($1, 'seed')`, [modelId]);
  expect(
    await failure(`INSERT INTO tracked_model (model_id, origin) VALUES ($1, 'seed')`, [modelId]),
  ).toMatchObject({
    code: '23505',
    constraint: 'tracked_model_once_per_scope_unique',
  });
  // A trim is its own scope, and only under its own model.
  await db.query(`INSERT INTO tracked_model (model_id, trim_id, origin) VALUES ($1, $2, 'seed')`, [
    modelId,
    trimId,
  ]);
  expect(
    await failure(`INSERT INTO tracked_model (model_id, trim_id, origin) VALUES ($1, $2, 'seed')`, [
      modelId,
      otherTrimId,
    ]),
  ).toMatchObject({ code: '23503', constraint: 'tracked_model_trim_fk' });
  expect(
    await failure(`INSERT INTO tracked_model (model_id, origin, state) VALUES (999999, 'seed', 'gone')`),
  ).toMatchObject({ code: '23514', constraint: 'tracked_model_state_valid' });
  expect(
    await failure(
      `INSERT INTO tracked_model (model_id, trim_id, origin, priority) VALUES ($1, $2, 'seed', 'urgent')`,
      [modelId, trimId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'tracked_model_priority_valid' });
  // The seed has no person; a person's choice has one; a request's model has the approver and the request.
  const { otherModelId } = await catalogue2(modelId);
  expect(
    await failure(
      `INSERT INTO tracked_model (model_id, origin, created_by_account_id) VALUES ($1, 'seed', $2)`,
      [otherModelId, admin],
    ),
  ).toMatchObject({ code: '23514', constraint: 'tracked_model_origin_matches' });
  expect(
    await failure(`INSERT INTO tracked_model (model_id, origin) VALUES ($1, 'superadmin')`, [otherModelId]),
  ).toMatchObject({ code: '23514', constraint: 'tracked_model_origin_matches' });
  expect(
    await failure(
      `INSERT INTO tracked_model (model_id, origin, created_by_account_id) VALUES ($1, 'request', $2)`,
      [otherModelId, admin],
    ),
  ).toMatchObject({ code: '23514', constraint: 'tracked_model_origin_matches' });
});

// A second model for the origin checks above, whichever the first call made.
async function catalogue2(modelId: number): Promise<{ otherModelId: number }> {
  const makeId = await returningId('SELECT make_id AS id FROM model WHERE id = $1', [modelId]);
  const otherModelId = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, 'pars', 'Pars') RETURNING id`,
    [makeId],
  );
  return { otherModelId };
}

test('the superadmin tracks, pauses, resumes, re-prioritises and untracks through one function that records who and repeats safely (CS-53 #1)', async () => {
  const { modelId, trimId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  const buyer = await account('ali_1403');

  expect(await change(modelId, null, 'track', 'high', admin)).toBe('changed');
  expect(await change(modelId, null, 'track', 'low', admin)).toBe('unchanged');
  expect(await tracked(modelId)).toEqual({
    state: 'tracking',
    priority: 'high',
    origin: 'superadmin',
    created_by_account_id: admin,
    crawl_request_id: null,
  });
  // One of its trims on its own is another row.
  expect(await change(modelId, trimId, 'track', null, admin)).toBe('changed');
  expect((await tracked(modelId, trimId))?.priority).toBe('normal');

  expect(await change(modelId, null, 'pause', null, admin)).toBe('changed');
  expect(await change(modelId, null, 'pause', null, admin)).toBe('unchanged');
  expect((await tracked(modelId))?.state).toBe('paused');
  // A paused model is not read in depth, so the scope view leaves it out, and a buyer may ask for it again.
  const { rows: scope } = await db.query<{ trim_id: number | null }>(
    `SELECT trim_id::int FROM tracked_model_scope WHERE model_id = $1`,
    [modelId],
  );
  expect(scope).toEqual([{ trim_id: trimId }]);
  expect(await change(modelId, null, 'resume', null, admin)).toBe('changed');
  expect(await change(modelId, null, 'set_priority', 'low', admin)).toBe('changed');
  expect(await change(modelId, null, 'set_priority', 'low', admin)).toBe('unchanged');
  expect(await change(modelId, null, 'untrack', null, admin)).toBe('changed');
  expect(await change(modelId, null, 'untrack', null, admin)).toBe('missing');
  expect(await change(modelId, null, 'pause', null, admin)).toBe('missing');
  expect(await tracked(modelId)).toBeUndefined();
  expect(await actions(modelId)).toEqual([
    'tracked',
    'tracked',
    'paused',
    'resumed',
    'priority_changed',
    'untracked',
  ]);

  const { rows } = await db.query<{
    action: string;
    from_value: string | null;
    to_value: string | null;
    by: number;
  }>(
    `SELECT action, from_value, to_value, by_account_id::int AS by FROM tracked_model_change
     WHERE model_id = $1 AND trim_id IS NULL AND action IN ('priority_changed', 'paused') ORDER BY id`,
    [modelId],
  );
  expect(rows).toEqual([
    { action: 'paused', from_value: 'tracking', to_value: 'paused', by: admin },
    { action: 'priority_changed', from_value: 'high', to_value: 'low', by: admin },
  ]);

  // Not a superadmin, not an action, not a priority, not a model: each refused by name.
  expect(
    await failure(`SELECT change_tracked_model($1, NULL, 'track', 'high', $2)`, [modelId, buyer]),
  ).toMatchObject({
    code: '23514',
    constraint: 'tracked_model_change_by_superadmin',
  });
  expect(
    await failure(`SELECT change_tracked_model($1, NULL, 'delete', NULL, $2)`, [modelId, admin]),
  ).toMatchObject({
    code: '23514',
    constraint: 'tracked_model_change_action_valid',
  });
  expect(
    await failure(`SELECT change_tracked_model($1, NULL, 'track', 'urgent', $2)`, [modelId, admin]),
  ).toMatchObject({
    code: '23514',
    constraint: 'tracked_model_priority_valid',
  });
  expect(
    await failure(`SELECT change_tracked_model($1, NULL, 'set_priority', NULL, $2)`, [modelId, admin]),
  ).toMatchObject({ code: '23514', constraint: 'tracked_model_priority_valid' });
  expect(
    await failure(`SELECT change_tracked_model(999999, NULL, 'track', 'high', $1)`, [admin]),
  ).toMatchObject({
    code: '23503',
    constraint: 'tracked_model_model_fk',
  });
});

test('approving a crawl request tracks its model, declining takes back exactly what the approval did (CS-53 #6, #7)', async () => {
  const { modelId, otherModelId, trimId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  const first = await request(modelId);
  const second = await request(otherModelId);

  expect(await decide(first, 'pending', 'approved', null, admin)).toBe('changed');
  expect(await tracked(modelId)).toEqual({
    state: 'tracking',
    priority: 'normal',
    origin: 'request',
    created_by_account_id: admin,
    crawl_request_id: first,
  });
  expect(await actions(modelId)).toEqual(['from_request']);
  // While the request waits to be read the model is neither removed nor paused by hand: declining is how it is taken
  // back, because that is what tells its buyers.
  expect(await change(modelId, null, 'untrack', null, admin)).toBe('blocked');
  expect(await change(modelId, null, 'pause', null, admin)).toBe('blocked');
  expect(await decide(first, 'approved', 'declined', 'ظرفیت پر است', admin)).toBe('changed');
  expect(await tracked(modelId)).toBeUndefined();
  expect(await actions(modelId)).toEqual(['from_request', 'request_withdrawn']);
  // Reconsidered: tracked again, from the request again.
  expect(await decide(first, 'declined', 'approved', null, admin)).toBe('changed');
  expect((await tracked(modelId))?.crawl_request_id).toBe(first);

  // A model the owner tracks already stays the owner's, takes the request it answers, and is held by it: it cannot be
  // paused or removed while the request waits (the stranded request this closes was approved and then never read).
  await change(otherModelId, null, 'track', 'high', admin);
  expect(await decide(second, 'pending', 'approved', null, admin)).toBe('changed');
  expect(await tracked(otherModelId)).toMatchObject({
    origin: 'superadmin',
    priority: 'high',
    crawl_request_id: second,
  });
  expect(await change(otherModelId, null, 'pause', null, admin)).toBe('blocked');
  expect(await change(otherModelId, null, 'untrack', null, admin)).toBe('blocked');
  expect(await change(otherModelId, null, 'set_priority', 'low', admin)).toBe('changed');
  // Declining it detaches the request and leaves the owner's row as it was.
  expect(await decide(second, 'approved', 'declined', 'ظرفیت پر است', admin)).toBe('changed');
  expect(await tracked(otherModelId)).toMatchObject({
    origin: 'superadmin',
    state: 'tracking',
    crawl_request_id: null,
  });
  expect(await change(otherModelId, null, 'pause', null, admin)).toBe('changed');

  // A paused model is resumed by an approval for it, and paused again by declining that approval.
  expect(await decide(second, 'declined', 'approved', null, admin)).toBe('changed');
  expect((await tracked(otherModelId))?.state).toBe('tracking');
  expect(await decide(second, 'approved', 'declined', 'ظرفیت پر است', admin)).toBe('changed');
  expect(await tracked(otherModelId)).toMatchObject({
    state: 'paused',
    origin: 'superadmin',
    crawl_request_id: null,
  });
  expect((await actions(otherModelId)).slice(-3)).toEqual(['paused', 'resumed', 'request_withdrawn']);

  // A request for one trim makes a trim row, held in the same way.
  const trimRequest = await request(modelId, trimId);
  expect(await decide(trimRequest, 'pending', 'approved', null, admin)).toBe('changed');
  expect(await tracked(modelId, trimId)).toMatchObject({ origin: 'request', crawl_request_id: trimRequest });
  // The whole-model row answers a trim request too, so it is held while that one waits.
  expect(await decide(first, 'approved', 'declined', 'x', admin)).toBe('changed');
  await change(modelId, null, 'track', 'normal', admin);
  expect(await change(modelId, null, 'untrack', null, admin)).toBe('blocked');
});

test('an approved request is fulfilled once its tracked model has had a listing read, and not before (CS-53 #7)', async () => {
  const { modelId, trimId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  const id = await request(modelId);
  const fulfil = async () => {
    const { rows } = await db.query<{ n: number }>(`SELECT fulfil_crawl_requests() AS n`);
    return rows[0]?.n;
  };
  expect(await fulfil()).toBe(0);
  await decide(id, 'pending', 'approved', null, admin);
  // Tracked, but nothing of it was read yet: it waits (the crawl may be paused).
  expect(await fulfil()).toBe(0);
  await db.query(
    `INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, model_id, make_id, catalogue_match)
     SELECT 'divar', 'tok1', 'https://divar.ir/v/tok1', 'active', now(), now(), $1, make_id, 'model' FROM model WHERE id = $1`,
    [modelId],
  );
  expect(await fulfil()).toBe(0);
  await db.query(`UPDATE listing SET last_checked_at = now() WHERE source_listing_key = 'tok1'`);
  expect(await fulfil()).toBe(1);
  expect(await fulfil()).toBe(0);
  const { rows } = await db.query<{ state: string; fulfilled_at: Date | null }>(
    `SELECT state, fulfilled_at FROM crawl_request WHERE id = $1`,
    [id],
  );
  expect(rows[0]?.state).toBe('fulfilled');
  expect(rows[0]?.fulfilled_at).toBeInstanceOf(Date);
  // Fulfilled: no one's to decide, and the model it made may now be untracked.
  expect(await decide(id, 'fulfilled', 'declined', 'x', admin)).toBe('stale');
  expect(await change(modelId, null, 'untrack', null, admin)).toBe('changed');

  // A paused model is not read: its request is not fulfilled by it; a trim request needs a listing of that trim.
  const trimRequest = await request(modelId, trimId);
  await decide(trimRequest, 'pending', 'approved', null, admin);
  await change(modelId, trimId, 'pause', null, admin);
  expect(await fulfil()).toBe(0);
  await change(modelId, trimId, 'resume', null, admin);
  expect(await fulfil()).toBe(0);
});

test('the change record is append-only, and the roles are limited to their part (CS-53)', async () => {
  const { modelId } = await catalogue();
  const admin = await account('admin_1', 'superadmin');
  await change(modelId, null, 'track', 'normal', admin);
  expect(await failure(`DELETE FROM tracked_model_change`)).toBeDefined();
  expect(await failure(`UPDATE tracked_model_change SET to_value = 'x'`)).toBeDefined();
  expect(await failure(`TRUNCATE tracked_model_change`)).toBeDefined();
  // Only the seed has no person.
  expect(
    await failure(
      `INSERT INTO tracked_model_change (model_id, action, to_value) VALUES ($1, 'tracked', 'normal')`,
      [modelId],
    ),
  ).toMatchObject({ code: '23514', constraint: 'tracked_model_change_person' });

  // The web role reads only the view; the worker reads the table and fulfils; neither writes it.
  await db.exec('SET LOCAL ROLE carshenas_web');
  await db.query(`SELECT * FROM tracked_model_scope`);
  expect(await failure(`SELECT * FROM tracked_model`)).toMatchObject({ code: '42501' });
  expect(
    await failure(`SELECT change_tracked_model($1, NULL, 'pause', NULL, $2)`, [modelId, admin]),
  ).toMatchObject({
    code: '42501',
  });
  await db.exec('RESET ROLE');
  await db.exec('SET LOCAL ROLE carshenas_worker');
  await db.query(`SELECT * FROM tracked_model`);
  await db.query(`SELECT fulfil_crawl_requests()`);
  expect(await failure(`UPDATE tracked_model SET state = 'paused'`)).toMatchObject({ code: '42501' });
  expect(
    await failure(`SELECT change_tracked_model($1, NULL, 'pause', NULL, $2)`, [modelId, admin]),
  ).toMatchObject({
    code: '42501',
  });
  await db.exec('RESET ROLE');
  // The superadmin's role reads everything and changes only through the function.
  await db.exec('SET LOCAL ROLE carshenas_admin');
  await db.query(`SELECT * FROM tracked_model`);
  await db.query(`SELECT * FROM tracked_model_change`);
  expect(await failure(`UPDATE tracked_model SET state = 'paused'`)).toMatchObject({ code: '42501' });
  expect(await failure(`DELETE FROM tracked_model`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT fulfil_crawl_requests()`)).toMatchObject({ code: '42501' });
  expect(await change(modelId, null, 'pause', null, admin)).toBe('changed');
  await db.exec('RESET ROLE');
});
