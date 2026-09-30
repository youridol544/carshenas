import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// The worker screen's data for its browser tests (CS-41): what the worker writes, seeded as the migration role into
// the database the app under test uses, as fixtures/sources.ts does for the sources screen. One call makes a crawled
// source stopped on a block (a worker never reads it), with a lane, runs, requests (one refused, which stops it as the
// crawler's would), a catalogue model tracked by its key, listings, freshness measurements and a value the parser could
// not read; a job queue of its own with a failed job and one waiting to run again; and a worker process's heartbeat.
// Afterwards everything goes, in one purge of the test's own rows (fetches, runs, price events, measurements and job
// changes are append-only outside one).

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_MIGRATE_URL is not set: the worker screen tests need the database the app uses.',
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

const persianNumber = new Intl.NumberFormat('fa-IR', { useGrouping: false });

export type Pipeline = {
  sourceId: string;
  sourceNameFa: string;
  modelKey: string;
  modelNameFa: string;
  queue: string;
  failedJobId: string;
  waitingJobId: string;
  traceId: string;
  errorMessage: string;
  waitingErrorMessage: string;
  refusedUrl: string;
  unreadText: string;
  process: { instanceId: string; name: string; version: string };
};

async function one<T>(client: pg.Client, text: string, values: unknown[]): Promise<T> {
  const { rows } = await client.query<Record<string, T>>(text, values);
  const row = rows[0];
  if (row === undefined) throw new Error(`no row: ${text}`);
  return Object.values(row)[0] as T;
}

export async function seedPipeline(): Promise<Pipeline> {
  const number = randomInt(100_000, 1_000_000);
  const tag = String(number);
  const pipeline: Pipeline = {
    sourceId: `e2e_${tag}`,
    sourceNameFa: `منبع آزمایشی ${persianNumber.format(number)}`,
    modelKey: `E2E Model ${tag}`,
    modelNameFa: `مدل آزمایشی ${persianNumber.format(number)}`,
    queue: `e2e.${tag}`,
    failedJobId: randomUUID(),
    waitingJobId: randomUUID(),
    traceId: randomBytes(16).toString('hex'),
    errorMessage: `snapshot.price is undefined ${tag}`,
    waitingErrorMessage: `the source answered 504 ${tag}`,
    refusedUrl: `https://test.example/post/refused-${tag}`,
    unreadText: `حدود ${persianNumber.format(number)} کیلومتر`,
    process: {
      instanceId: randomUUID(),
      name: `e2e-host-${tag}:${tag}`,
      version: `e2e-release-${tag}`,
    },
  };
  const { sourceId } = pipeline;
  // One transaction: a crawl run needs an enabled source (crawl_run_policy_guard), and the refused request stops it
  // before anyone else can see it enabled, so no worker ever reads it.
  await withOwner(async (client) => {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, crawl_state,
                           min_request_interval_ms, daily_request_budget)
       VALUES ($1, 'external', 'crawl', $2, 'https://test.example', 'public', 'enabled', 3000, 12000)`,
      [sourceId, pipeline.sourceNameFa],
    );
    const policyId = await one<number>(
      client,
      `INSERT INTO source_policy_check (source_id, checked_at, checked_by, terms_summary, verdict, photos_allowed)
       VALUES ($1, now(), 'the browser tests', 'A test source: nothing is read from a real site.', 'allowed', false)
       RETURNING id`,
      [sourceId],
    );
    await client.query(
      `INSERT INTO crawl_lane (source_id, budget_day, budget_spent)
       VALUES ($1, (now() AT TIME ZONE 'Asia/Tehran')::date, 4210)`,
      [sourceId],
    );
    const run = async (kind: string, status: string, minutesAgo: number, seconds: number) =>
      one<number>(
        client,
        `INSERT INTO crawl_run (source_id, policy_check_id, kind, status, started_at, finished_at, counts)
         VALUES ($1, $2, $3, $4, now() - make_interval(mins => $5), now() - make_interval(mins => $5) + make_interval(secs => $6),
                 '{"snapshotsStored": 1}')
         RETURNING id`,
        [sourceId, policyId, kind, status, minutesAgo, seconds],
      );
    const detail = await run('detail', 'succeeded', 10, 4);
    await run('sweep', 'failed', 20, 2);
    const fetch = async (outcome: string, status: number, minutesAgo: number, url: string) =>
      one<number>(
        client,
        `INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome, duration_ms)
         VALUES ($1, $2, $3, now() - make_interval(mins => $4), $5, $6, 120) RETURNING id`,
        [sourceId, detail, url, minutesAgo, status, outcome],
      );
    const ok = await fetch('ok', 200, 10, `https://test.example/post/ok-${tag}`);
    // A refused request: fetch_log_stops_on_block stops the source, as the crawler's own would.
    await fetch('blocked', 403, 9, pipeline.refusedUrl);

    const makeId = await one<number>(
      client,
      `INSERT INTO make (slug, name_en) VALUES ($1, 'E2E make') RETURNING id`,
      [`e2e-${tag}`],
    );
    const modelId = await one<number>(
      client,
      `INSERT INTO model (make_id, slug, name_en, name_fa) VALUES ($1, $2, $3, $4) RETURNING id`,
      [makeId, `e2e-${tag}`, pipeline.modelKey, pipeline.modelNameFa],
    );
    await client.query(
      `INSERT INTO catalogue_source_key (source_id, source_model_key, level, make_id, model_id)
       VALUES ($1, $2, 'model', $3, $4)`,
      [sourceId, pipeline.modelKey, makeId, modelId],
    );
    const listing = async (key: string, createdMinutesAgo: number, goneMinutesAgo: number | null) =>
      one<number>(
        client,
        `INSERT INTO listing (source_id, source_listing_key, url, origin, status, listed_at, created_at, last_seen_at,
                              delisted_at, source_model_key, make_id, model_id, catalogue_match)
         VALUES ($1, $2, $3, 'external', $4, now() - make_interval(mins => $5 + 60), now() - make_interval(mins => $5),
                 now() - make_interval(mins => coalesce($6, 30)), now() - make_interval(mins => $6), $7, $8, $9, 'model')
         RETURNING id`,
        [
          sourceId,
          key,
          `https://test.example/post/${key}`,
          goneMinutesAgo === null ? 'active' : 'gone',
          createdMinutesAgo,
          goneMinutesAgo,
          pipeline.modelKey,
          makeId,
          modelId,
        ],
      );
    const fresh = await listing(`a-${tag}`, 10, null);
    await listing(`b-${tag}`, 3 * 24 * 60, null);
    await listing(`c-${tag}`, 3 * 24 * 60, 20);
    for (const [minutesAgo, price] of [
      [8, 1_300_000_000],
      [5, 1_250_000_000],
    ] as const) {
      await client.query(
        `INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, fetch_log_id)
         VALUES ($1, now() - make_interval(mins => $2), 'asking', $3, $4)`,
        [fresh, minutesAgo, price, ok],
      );
    }
    await client.query(
      `INSERT INTO listing_unparsed_value (listing_id, field, raw_text) VALUES ($1, 'mileage_km', $2)`,
      [fresh, pipeline.unreadText],
    );
    for (const [hoursAgo, added, gone, age] of [
      [2, 30, 1, 40],
      [1, 32, 2, 35],
      [0, 35, 1, 30],
    ] as const) {
      const at = `date_trunc('hour', now()) - make_interval(hours => ${String(hoursAgo)})`;
      await client.query(
        `INSERT INTO freshness_measurement (source_id, source_model_key, measured_at, new_listings, left_market,
                                           active_listings, seen_within_48h, last_seen_age_p50_minutes)
         VALUES ($1, NULL, ${at}, $2, $3, 2, 2, $4), ($1, $5, ${at}, $2, $3, 2, 2, $4)`,
        [sourceId, added, gone, age, pipeline.modelKey],
      );
    }

    await client.query(
      `INSERT INTO pgboss.queue (name, policy, retry_limit, retry_delay, retry_backoff, expire_seconds,
                                 retention_seconds, deletion_seconds, partition, table_name)
       VALUES ($1, 'standard', 2, 0, false, 900, 1209600, 604800, false, 'job_common')`,
      [pipeline.queue],
    );
    const error = JSON.stringify({
      type: 'TypeError',
      message: pipeline.errorMessage,
      traceId: pipeline.traceId,
    });
    const waitingError = JSON.stringify({
      type: 'SourceUnavailableError',
      message: pipeline.waitingErrorMessage,
      traceId: pipeline.traceId,
    });
    await client.query(
      `INSERT INTO pgboss.job (id, name, state, data, retry_count, retry_limit, started_on, completed_on, output)
       VALUES ($1, $3, 'failed', '{"kind": "e2e.parse"}', 2, 2, now() - interval '2 minutes',
               now() - interval '1 minute', $4),
              ($2, $3, 'retry', '{"kind": "e2e.parse"}', 1, 2, now() - interval '3 minutes', NULL, $5)`,
      [pipeline.failedJobId, pipeline.waitingJobId, pipeline.queue, error, waitingError],
    );

    await client.query(
      `INSERT INTO worker_heartbeat (instance_id, hostname, pid, version, started_at, beat_at)
       VALUES ($1, $2, $3, $4, now() - interval '2 hours', now())`,
      [pipeline.process.instanceId, `e2e-host-${tag}`, number, pipeline.process.version],
    );
    await client.query('COMMIT');
  });
  return pipeline;
}

/** The worker process stops beating: its last beat moves back, as if it died that many seconds ago (a minute). */
export async function silenceProcess(instanceId: string, seconds = 60): Promise<void> {
  await withOwner((client) =>
    client.query(
      `UPDATE worker_heartbeat SET beat_at = greatest(started_at, now() - make_interval(secs => $2))
       WHERE instance_id = $1`,
      [instanceId, seconds],
    ),
  );
}

/** Removes everything seedPipeline made, and the job changes recorded on its queue, in one purge. */
export async function removePipeline(pipeline: Pipeline): Promise<void> {
  await withOwner(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL carshenas.purge = 'on'`);
      const { sourceId } = pipeline;
      await client.query(`DELETE FROM worker_heartbeat WHERE instance_id = $1`, [
        pipeline.process.instanceId,
      ]);
      await client.query(`DELETE FROM job_state_change WHERE queue = $1`, [pipeline.queue]);
      await client.query(`DELETE FROM pgboss.job WHERE name = $1`, [pipeline.queue]);
      await client.query(`DELETE FROM pgboss.queue WHERE name = $1`, [pipeline.queue]);
      await client.query(`DELETE FROM freshness_measurement WHERE source_id = $1`, [sourceId]);
      // Listings take their price events, unparsed values and fetches with them; runs, then the rest.
      await client.query(`DELETE FROM listing WHERE source_id = $1`, [sourceId]);
      await client.query(`DELETE FROM crawl_run WHERE source_id = $1`, [sourceId]);
      await client.query(`DELETE FROM catalogue_source_key WHERE source_id = $1`, [sourceId]);
      await client.query(`DELETE FROM model WHERE name_en = $1`, [pipeline.modelKey]);
      await client.query(`DELETE FROM make WHERE slug = $1`, [`e2e-${sourceId.slice(4)}`]);
      await client.query(`DELETE FROM source_state_change WHERE source_id = $1`, [sourceId]);
      await client.query(`DELETE FROM crawl_lane WHERE source_id = $1`, [sourceId]);
      await client.query(`DELETE FROM source_policy_check WHERE source_id = $1`, [sourceId]);
      await client.query(`DELETE FROM source WHERE id = $1`, [sourceId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

/** A failure that arrives after the page was opened: a job of the pipeline's queue failing now. */
export async function addFailure(pipeline: Pipeline, message: string): Promise<void> {
  await withOwner((client) =>
    client.query(
      `INSERT INTO pgboss.job (name, state, data, retry_count, retry_limit, started_on, completed_on, output)
       VALUES ($1, 'failed', '{"kind": "e2e.parse"}', 2, 2, now(), now(), $2)`,
      [pipeline.queue, JSON.stringify({ type: 'TypeError', message, traceId: pipeline.traceId })],
    ),
  );
}
