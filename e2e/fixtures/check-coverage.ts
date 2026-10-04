import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// The cars the check-a-link coverage tests (CS-115) paste links for: catalogue models of their own that Carshenas does not
// read in depth, with names the catalogue's matcher reads from a link's title. The matcher reads the catalogue's names
// once and keeps them for five minutes, so the models are made here, in the global setup, before the app is first asked
// (fixtures/global-setup.ts), and one per test and project: the tests of the two projects run side by side and a request,
// a decision or an approval of one must never be seen by another. Everything is removed when the run ends.

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') throw new Error('DATABASE_MIGRATE_URL is not set');
  return url;
}

async function withClient<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export const PROJECTS = ['mobile', 'desktop', 'iphone'] as const;
/** One model per scenario and project: the tests that change a model's request never share it. */
export const SCENARIOS = ['view', 'signedin', 'visitor', 'declined', 'approved', 'admin', 'layout'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export type CoverageModel = {
  readonly makeId: number;
  readonly modelId: number;
  /** `make.model`: what a search and the lexicon call the model. */
  readonly key: string;
  /** What the pages call the car. */
  readonly nameFa: string;
  /** The title of an ad for it, as Divar writes an address: dashes for spaces. */
  readonly slug: string;
};

export type CoverageMake = {
  readonly makeId: number;
  readonly nameFa: string;
  /** A title that names the make and no model. */
  readonly slug: string;
  readonly models: readonly { readonly modelId: number; readonly key: string; readonly name: string }[];
};

export type CoverageSeed = {
  readonly models: Readonly<Record<string, CoverageModel>>;
  readonly makes: Readonly<Record<string, CoverageMake>>;
};

/** Letters only, so no digit in a name is shown in Persian digits; unique, so parallel tests never share a name. */
function letters(length: number): string {
  return Array.from(randomBytes(length), (byte) => 'ghijkmnpqrstuvwxyz'[byte % 18]).join('');
}

export async function seedCoverage(): Promise<CoverageSeed> {
  return withClient(async (client) => {
    const models: Record<string, CoverageModel> = {};
    const makes: Record<string, CoverageMake> = {};
    for (const project of PROJECTS) {
      for (const scenario of SCENARIOS) {
        const token = randomBytes(4).toString('hex');
        const makeSlug = `ce${token}`;
        const modelSlug = `cx${token}`;
        const nameFa = `مدل آزمایشی ${letters(7)}`;
        const make = await client.query<{ id: number }>(
          `INSERT INTO make (slug, name_en, name_fa) VALUES ($1, $2, $3) RETURNING id::int`,
          [makeSlug, `E2E coverage make ${token}`, `برند آزمایشی ${letters(7)}`],
        );
        const makeId = make.rows[0]?.id ?? 0;
        const model = await client.query<{ id: number }>(
          `INSERT INTO model (make_id, slug, name_en, name_fa) VALUES ($1, $2, $3, $4) RETURNING id::int`,
          [makeId, modelSlug, `E2E coverage model ${token}`, nameFa],
        );
        models[`${project}:${scenario}`] = {
          makeId,
          modelId: model.rows[0]?.id ?? 0,
          key: `${makeSlug}.${modelSlug}`,
          nameFa,
          slug: nameFa.replaceAll(' ', '-'),
        };
      }
      // A make named in Persian whose models have only Latin names: the title names the make and no model.
      const token = randomBytes(4).toString('hex');
      const makeSlug = `cm${token}`;
      const nameFa = `برند آزمایشی ${letters(7)}`;
      const make = await client.query<{ id: number }>(
        `INSERT INTO make (slug, name_en, name_fa) VALUES ($1, $2, $3) RETURNING id::int`,
        [makeSlug, `E2E chooser make ${token}`, nameFa],
      );
      const makeId = make.rows[0]?.id ?? 0;
      const chosen: { modelId: number; key: string; name: string }[] = [];
      for (const word of ['Alpha', 'Beta']) {
        const slug = `${word.toLowerCase()}${token}`;
        const model = await client.query<{ id: number }>(
          `INSERT INTO model (make_id, slug, name_en) VALUES ($1, $2, $3) RETURNING id::int`,
          [makeId, slug, `${word} ${token}`],
        );
        chosen.push({
          modelId: model.rows[0]?.id ?? 0,
          key: `${makeSlug}.${slug}`,
          name: `${word} ${token}`,
        });
      }
      makes[`${project}:chooser`] = {
        makeId,
        nameFa,
        slug: `${nameFa.replaceAll(' ', '-')}-مدل-95`,
        models: chosen,
      };
    }
    return { models, makes };
  });
}

/** The seed the global setup made, handed over through the environment like the other fixtures'. */
export function coverageSeed(): CoverageSeed {
  const text = process.env.E2E_COVERAGE_SEED;
  if (text === undefined)
    throw new Error('E2E_COVERAGE_SEED is not set: the global setup seeds the coverage models.');
  return JSON.parse(text) as CoverageSeed;
}

export function coverageModel(project: string, scenario: Scenario): CoverageModel {
  const found = coverageSeed().models[`${project}:${scenario}`];
  if (found === undefined) throw new Error(`no coverage model for ${project}:${scenario}`);
  return found;
}

export function coverageMake(project: string): CoverageMake {
  const found = coverageSeed().makes[`${project}:chooser`];
  if (found === undefined) throw new Error(`no coverage make for ${project}`);
  return found;
}

export async function removeCoverage(seed: CoverageSeed): Promise<void> {
  const modelIds = [
    ...Object.values(seed.models).map((model) => model.modelId),
    ...Object.values(seed.makes).flatMap((make) => make.models.map((model) => model.modelId)),
  ];
  const makeIds = [
    ...Object.values(seed.models).map((model) => model.makeId),
    ...Object.values(seed.makes).map((make) => make.makeId),
  ];
  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL carshenas.purge = 'on'`);
      await client.query(`DELETE FROM model_demand WHERE model_id = ANY($1::bigint[])`, [modelIds]);
      // A tracked row made by an approval points at its request: the tracked rows go first.
      await client.query(`DELETE FROM tracked_model_change WHERE model_id = ANY($1::bigint[])`, [modelIds]);
      await client.query(`DELETE FROM tracked_model WHERE model_id = ANY($1::bigint[])`, [modelIds]);
      await client.query(`DELETE FROM crawl_request WHERE model_id = ANY($1::bigint[])`, [modelIds]);
      await client.query(`DELETE FROM model WHERE id = ANY($1::bigint[])`, [modelIds]);
      await client.query(`DELETE FROM make WHERE id = ANY($1::bigint[])`, [makeIds]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export type RequestState = {
  readonly id: number;
  readonly state: string;
  readonly reason: string | null;
  readonly files: number;
  readonly buyers: number;
} | null;

/** What the database holds of the model's whole-model request: its state, and how many files and buyers depend on it. */
export async function requestOfModel(modelId: number): Promise<RequestState> {
  return withClient(async (client) => {
    const result = await client.query<{
      id: number;
      state: string;
      decline_reason: string | null;
      files: number;
      buyers: number;
    }>(
      `SELECT r.id::int, r.state, r.decline_reason,
              (SELECT count(*)::int FROM crawl_request_file l WHERE l.crawl_request_id = r.id) AS files,
              (SELECT count(DISTINCT f.account_id)::int FROM crawl_request_file l
                 JOIN search_file f ON f.id = l.search_file_id WHERE l.crawl_request_id = r.id) AS buyers
       FROM crawl_request r WHERE r.model_id = $1 AND r.trim_id IS NULL`,
      [modelId],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : { id: row.id, state: row.state, reason: row.decline_reason, files: row.files, buyers: row.buyers };
  });
}

/** The superadmin's decision, as the function the section calls records it (the decider is any superadmin; one is made if none). */
export async function decideRequest(
  requestId: number,
  decision: 'approved' | 'declined',
  reason: string | null,
): Promise<void> {
  await withClient(async (client) => {
    let admin = await client.query<{ id: number }>(
      `SELECT id::int FROM account WHERE role = 'superadmin' LIMIT 1`,
    );
    if (admin.rows[0] === undefined) {
      admin = await client.query<{ id: number }>(
        `INSERT INTO account (username, password_hash, role) VALUES ($1, $2, 'superadmin') RETURNING id::int`,
        [
          `e2e_cover_decider_${randomBytes(3).toString('hex')}`,
          '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g',
        ],
      );
    }
    await client.query(`SELECT decide_crawl_request($1, 'pending', $2, $3, $4)`, [
      requestId,
      decision,
      reason,
      admin.rows[0]?.id,
    ]);
  });
}

/** How many links were pasted for the model today (model_demand, kind paste). */
export async function pastedFor(modelId: number): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ n: number }>(
      `SELECT coalesce(sum(request_count), 0)::int AS n FROM model_demand
       WHERE model_id = $1 AND kind = 'paste' AND demand_date = (now() AT TIME ZONE 'Asia/Tehran')::date`,
      [modelId],
    );
    return rows[0]?.n ?? 0;
  });
}

/** A buyer's search files whose search names the model (the file an ask from a link makes). */
export async function filesForModel(
  username: string,
  modelKey: string,
): Promise<{ id: number; name: string }[]> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ id: number; name: string }>(
      `SELECT f.id::int, f.name FROM search_file f JOIN account a ON a.id = f.account_id
       WHERE a.username = $1 AND f.search -> 'filters' -> 'model' ? $2`,
      [username, modelKey],
    );
    return rows;
  });
}

/** Removes the accounts and their files (the tests' own buyers). */
export async function removeAccounts(usernames: readonly string[]): Promise<void> {
  await withClient(async (client) => {
    await client.query(`DELETE FROM account WHERE username = ANY($1::text[])`, [usernames]);
  });
}
