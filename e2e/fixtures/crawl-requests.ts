import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// Crawl requests for the browser tests (CS-71): what a test cannot do through the page. A buyer asks and the
// superadmin decides by clicking; what the page does not offer is made here, as the migration role, in the database the
// app under test uses: a catalogue model of the test's own (so the file is about a car that is surely not read in depth
// and surely has few matches, whatever the index holds), a buyer's file about it, and a look at what the database
// holds. A test that makes these removes them.

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_MIGRATE_URL is not set: the crawl request tests need the database the app uses.',
    );
  }
  return url;
}

async function withOwner<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export type TestModel = {
  makeSlug: string;
  modelSlug: string;
  /** The model's key in a search: `make.model`. */
  key: string;
  /** What the pages call the car. */
  nameFa: string;
  makeId: number;
  modelId: number;
};

/** A make and a model of the test's own, with Persian names the pages show. */
export async function seedModel(label: string): Promise<TestModel> {
  const token = randomBytes(4).toString('hex');
  const makeSlug = `m${token}`;
  const modelSlug = `x${token}`;
  // Letters only: a digit in a name would be shown in Persian digits. Unique, so parallel tests never share a name.
  const letters = Array.from(randomBytes(6), (byte) => 'ghijkmnpqrstuvwxyz'[byte % 18]).join('');
  const nameFa = `مدل آزمایشی ${label} ${letters}`;
  return withOwner(async (client) => {
    const make = await client.query<{ id: number }>(
      `INSERT INTO make (slug, name_en, name_fa) VALUES ($1, $2, $3) RETURNING id::int`,
      [makeSlug, `E2E make ${token}`, 'برند آزمایشی'],
    );
    const model = await client.query<{ id: number }>(
      `INSERT INTO model (make_id, slug, name_en, name_fa) VALUES ($1, $2, $3, $4) RETURNING id::int`,
      [make.rows[0]?.id, modelSlug, `E2E model ${token}`, nameFa],
    );
    return {
      makeSlug,
      modelSlug,
      key: `${makeSlug}.${modelSlug}`,
      nameFa,
      makeId: make.rows[0]?.id ?? 0,
      modelId: model.rows[0]?.id ?? 0,
    };
  });
}

/** A watching file of the buyer that asks for the model (and a word nothing says, so it finds no cars). Returns its id. */
export async function seedFileFor(username: string, model: TestModel, name: string): Promise<number> {
  return seedFileWithSearch(username, name, { model: [model.key] });
}

/** A watching file of the buyer with this search: the filters, and a word of the test's own unless one is given. */
export async function seedFileWithSearch(
  username: string,
  name: string,
  filters: Record<string, string[]>,
  words?: string,
): Promise<number> {
  const search = { v: 1, q: words ?? `کلمه${randomBytes(4).toString('hex')}`, filters };
  return withOwner(async (client) => {
    const result = await client.query<{ id: number }>(
      `INSERT INTO search_file (account_id, name, search)
       SELECT id, $2, $3::jsonb FROM account WHERE username = $1 RETURNING id::int`,
      [username, name, JSON.stringify(search)],
    );
    const id = result.rows[0]?.id;
    if (id === undefined) throw new Error(`no account ${username}`);
    return id;
  });
}

/** What the database holds of the model's request: its state, its decision, and how many files and buyers depend on it. */
export async function requestOf(model: TestModel): Promise<{
  state: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  reason: string | null;
  files: number;
  buyers: number;
} | null> {
  return withOwner(async (client) => {
    const result = await client.query(
      `SELECT r.state, who.username AS decided_by, r.decided_at, r.decline_reason,
              (SELECT count(*)::int FROM crawl_request_file l WHERE l.crawl_request_id = r.id) AS files,
              (SELECT count(DISTINCT f.account_id)::int FROM crawl_request_file l
                 JOIN search_file f ON f.id = l.search_file_id WHERE l.crawl_request_id = r.id) AS buyers
       FROM crawl_request r LEFT JOIN account who ON who.id = r.decided_by_account_id
       WHERE r.model_id = $1`,
      [model.modelId],
    );
    const row = result.rows[0] as
      | {
          state: string;
          decided_by: string | null;
          decided_at: Date | null;
          decline_reason: string | null;
          files: number;
          buyers: number;
        }
      | undefined;
    return row === undefined
      ? null
      : {
          state: row.state,
          decidedBy: row.decided_by,
          decidedAt: row.decided_at,
          reason: row.decline_reason,
          files: row.files,
          buyers: row.buyers,
        };
  });
}

/** The crawl-request notices a buyer has received, as the database holds them. */
export async function noticesOf(username: string): Promise<{ eventKey: string }[]> {
  return withOwner(async (client) => {
    const result = await client.query<{ event_key: string }>(
      `SELECT n.event_key FROM notification n JOIN account a ON a.id = n.account_id
       WHERE a.username = $1 AND n.kind = 'crawl_request_decided' ORDER BY n.id`,
      [username],
    );
    return result.rows.map((row) => ({ eventKey: row.event_key }));
  });
}

/** Removes the model's request, files and the model itself, and the accounts' files, so the screens stay readable. */
export async function removeModel(model: TestModel, usernames: readonly string[]): Promise<void> {
  await withOwner(async (client) => {
    await client.query(
      `DELETE FROM search_file WHERE account_id IN (SELECT id FROM account WHERE username = ANY($1::text[]))`,
      [usernames],
    );
    // Decisions are append-only outside a purge; the request goes with its model in the test's own transaction.
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL carshenas.purge = 'on'`);
      // What a test of the tracked models (CS-53) leaves: its listings, tracked rows and their change record.
      await client.query(`DELETE FROM listing WHERE model_id = $1`, [model.modelId]);
      await client.query(`DELETE FROM model_spec_change WHERE model_id = $1`, [model.modelId]);
      await client.query(`DELETE FROM model_spec WHERE model_id = $1`, [model.modelId]);
      await client.query(`DELETE FROM tracked_model_change WHERE model_id = $1`, [model.modelId]);
      await client.query(`DELETE FROM tracked_model WHERE model_id = $1`, [model.modelId]);
      await client.query(`DELETE FROM crawl_request WHERE model_id = $1`, [model.modelId]);
      await client.query(`DELETE FROM trim WHERE model_id = $1`, [model.modelId]);
      await client.query(`DELETE FROM model WHERE id = $1`, [model.modelId]);
      await client.query(`DELETE FROM make WHERE id = $1`, [model.makeId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

/** Removes a buyer's files (a test that made files without a model of its own). */
export async function removeFilesOfBuyer(username: string): Promise<void> {
  await withOwner(async (client) => {
    await client.query(
      `DELETE FROM search_file WHERE account_id = (SELECT id FROM account WHERE username = $1)`,
      [username],
    );
  });
}

const STAND_IN_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';

/** A buyer made without the sign-up page (no one signs in as them): for a test that needs another buyer's file. */
export async function seedBuyer(username: string): Promise<void> {
  await withOwner(async (client) => {
    await client.query(`INSERT INTO account (username, password_hash, role) VALUES ($1, $2, 'buyer')`, [
      username,
      STAND_IN_HASH,
    ]);
  });
}

/** Removes accounts made by seedBuyer, with their files. */
export async function removeBuyers(usernames: readonly string[]): Promise<void> {
  await withOwner(async (client) => {
    await client.query(`DELETE FROM account WHERE username = ANY($1::text[])`, [usernames]);
  });
}

/** The request of a model for these files, made as two asks make it; returns its id. */
export async function seedRequest(model: TestModel, fileIds: readonly number[]): Promise<number> {
  return withOwner(async (client) => {
    const made = await client.query<{ id: number }>(
      `INSERT INTO crawl_request (model_id) VALUES ($1) RETURNING id::int`,
      [model.modelId],
    );
    const id = made.rows[0]?.id ?? 0;
    for (const fileId of fileIds) {
      await client.query(
        `INSERT INTO crawl_request_file (crawl_request_id, search_file_id) VALUES ($1, $2)`,
        [id, fileId],
      );
    }
    return id;
  });
}

/**
 * Records a decision as the superadmin's function does and tells the buyer as the section's action does, for a test that
 * looks at what the buyer sees. The decider is any superadmin the database has (one is made when there is none).
 */
export async function decideAndNotify(
  requestId: number,
  decision: 'approved' | 'declined',
  buyer: string,
  fileId: number,
  carName: string,
  reason: string | null,
): Promise<void> {
  await withOwner(async (client) => {
    let admin = await client.query<{ id: number }>(
      `SELECT id::int FROM account WHERE role = 'superadmin' LIMIT 1`,
    );
    if (admin.rows[0] === undefined) {
      admin = await client.query<{ id: number }>(
        `INSERT INTO account (username, password_hash, role) VALUES ($1, $2, 'superadmin') RETURNING id::int`,
        [`e2e_decider_${randomBytes(3).toString('hex')}`, STAND_IN_HASH],
      );
    }
    await client.query(`SELECT decide_crawl_request($1, 'pending', $2, $3, $4)`, [
      requestId,
      decision,
      reason,
      admin.rows[0]?.id,
    ]);
    const latest = await client.query<{ id: number }>(
      `SELECT id::int FROM crawl_request_decision WHERE crawl_request_id = $1 ORDER BY id DESC LIMIT 1`,
      [requestId],
    );
    const decisionId = latest.rows[0]?.id ?? 0;
    const payload = {
      requestId,
      decisionId,
      decision,
      carName,
      fileId,
      ...(reason === null ? {} : { reason }),
    };
    await client.query(
      `SELECT create_notification((SELECT id FROM account WHERE username = $1), 'crawl_request_decided', $2, $3::jsonb)`,
      [buyer, `crawl_request:${String(requestId)}:${String(decisionId)}`, JSON.stringify(payload)],
    );
  });
}
