import type { LogFormat, LogLevelSetting } from '@carshenas/observability/logger';

// The only file that reads process.env (as src/server/env.ts is in the web app). Each value is read when first used,
// so a test that needs no database runs without its settings. Locally the scripts load the repository's .env
// (example.env shows every variable); production sets them in the environment.

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `${name} is not set: copy it from example.env into .env (then pnpm db:roles for a new role), or set it in the environment.`,
    );
  }
  return value;
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

/** An optional setting from a closed list; a value outside it stops the worker with a message saying which. */
function oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (isOneOf(value, allowed)) return value;
  throw new Error(`${name} must be one of ${allowed.join(', ')}; it is ${JSON.stringify(value)}.`);
}

/** An optional TCP port. */
function port(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${name} must be a port number from 1 to 65535; it is ${JSON.stringify(value)}.`);
  }
  return parsed;
}

const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const satisfies readonly LogLevelSetting[];
const LOG_FORMATS = ['json', 'pretty'] as const satisfies readonly LogFormat[];

export const env = {
  /** The worker's own role, carshenas_worker (db/bootstrap/10-roles.sql): WORKER_DATABASE_URL. */
  get databaseUrl() {
    return required('WORKER_DATABASE_URL');
  },
  /** The migration role's connection string: only the integration tests use it, to set up rows. */
  get migrateDatabaseUrl() {
    return required('DATABASE_MIGRATE_URL');
  },
  get isDevelopment() {
    return process.env.NODE_ENV === 'development';
  },
  get isTest() {
    return process.env.NODE_ENV === 'test';
  },
  /** CARSHENAS_LOG_SQL=1: a debug line per SQL statement, with its parameters in development only. */
  get logSql() {
    return process.env.CARSHENAS_LOG_SQL === '1';
  },
  /** LOG_LEVEL: `debug` in development, nothing in tests, `info` otherwise. */
  get logLevel(): LogLevelSetting {
    const fallback = this.isTest ? 'silent' : this.isDevelopment ? 'debug' : 'info';
    return oneOf('LOG_LEVEL', LOG_LEVELS, fallback);
  },
  /** LOG_FORMAT: readable lines in development, one JSON object per line everywhere else. */
  get logFormat(): LogFormat {
    return oneOf('LOG_FORMAT', LOG_FORMATS, this.isDevelopment ? 'pretty' : 'json');
  },
  /** The deployed build on every log line: CARSHENAS_RELEASE, or the commit (release.ts). */
  get release() {
    return process.env.CARSHENAS_RELEASE;
  },
  /** CARSHENAS_ENVIRONMENT names a deployment (`production`, `staging`); NODE_ENV, or `development`, by default. */
  get environment() {
    return process.env.CARSHENAS_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  },
  /** Whether finished spans go to an OpenTelemetry collector: when the standard endpoint variable is set. */
  get exportTraces() {
    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    return endpoint !== undefined && endpoint !== '' && process.env.OTEL_SDK_DISABLED !== 'true';
  },
  /** WORKER_HEALTH_PORT: the loopback port of the health endpoint, 3101 by default. */
  get healthPort() {
    return port('WORKER_HEALTH_PORT', 3101);
  },
  /**
   * CRAWLER_USER_AGENT: how the crawler names itself to every source, with a contact address (ADR-0008 point 5).
   * Required once a job sends a request.
   */
  get crawlerUserAgent() {
    return required('CRAWLER_USER_AGENT');
  },
  /**
   * METIS_API_KEY: the one key to every language model (ADR-0019 point 1). Read at start; the AI layer refuses to
   * start without it, and is started only when a registered job calls models (models.ts).
   */
  get metisApiKey() {
    const value = process.env.METIS_API_KEY;
    return value === '' ? undefined : value;
  },
  /**
   * EXTRACTION_SCHEDULED=1 runs extraction.read every five minutes (CS-52). Off unless set: the job spends Metis credit,
   * up to its daily cap, on every listing text it has not read, so credit stays for tasks until the owner switches it
   * on (2026-10-02). The job stays registered, so the AI layer and the queue are unchanged.
   */
  get extractionScheduled() {
    return process.env.EXTRACTION_SCHEDULED === '1';
  },
  /**
   * METIS_PRICING_URL: where the price list is read, Metis's own endpoint when unset. Only the worker-process test sets
   * it, to an address that answers nothing, so a test never reaches the internet.
   */
  get metisPricingUrl() {
    const value = process.env.METIS_PRICING_URL;
    return value === '' ? undefined : value;
  },
};
