import 'server-only';
import { parseAuthKey } from '@carshenas/accounts/keyed-hash';
import type { LogFormat, LogLevelSetting } from '@carshenas/observability/logger';
import { readExposure, type Exposure } from '@/lib/exposure';

// The only file that reads process.env (ADR-0004). Each value is read when first used, not at import, so a page
// that needs no database renders without DATABASE_URL and `next build` never needs one. Local values come from the
// repository's .env (example.env), which next.config.ts loads; production sets them in the environment.

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `${name} is not set: copy example.env to .env (scripts/init.sh does it) or set it in the environment.`,
    );
  }
  return value;
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

/** An optional setting from a closed list; a value outside it stops the server with a message saying which. */
function oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (isOneOf(value, allowed)) return value;
  throw new Error(`${name} must be one of ${allowed.join(', ')}; it is ${JSON.stringify(value)}.`);
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

let authKey: Buffer | undefined;

export const env = {
  /** Connection string for the web app's role, carshenas_web (db/bootstrap/10-roles.sql). */
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  /** Connection string for the superadmin section's role, carshenas_admin (ADR-0023): read by its pages alone. */
  get adminDatabaseUrl() {
    return required('ADMIN_DATABASE_URL');
  },
  get isDevelopment() {
    return process.env.NODE_ENV === 'development';
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
  /** CARSHENAS_LOG_SQL=1: a debug line per SQL statement, with its parameters in development only (database.ts). */
  get logSql() {
    return process.env.CARSHENAS_LOG_SQL === '1';
  },
  /** LOG_LEVEL: `debug` in development, nothing in unit tests, `info` otherwise. */
  get logLevel(): LogLevelSetting {
    const fallback = process.env.NODE_ENV === 'test' ? 'silent' : this.isDevelopment ? 'debug' : 'info';
    return oneOf('LOG_LEVEL', LOG_LEVELS, fallback);
  },
  /** LOG_FORMAT: readable lines in development, one JSON object per line everywhere else. */
  get logFormat(): LogFormat {
    return oneOf('LOG_FORMAT', LOG_FORMATS, this.isDevelopment ? 'pretty' : 'json');
  },
  /** The deployed build, on every log line. next.config.ts fixes it at build time from CARSHENAS_RELEASE or git. */
  get release() {
    return process.env.CARSHENAS_RELEASE ?? 'unknown';
  },
  /** CARSHENAS_ENVIRONMENT names a deployment (`production`, `staging`); NODE_ENV by default. */
  get environment() {
    return process.env.CARSHENAS_ENVIRONMENT ?? process.env.NODE_ENV;
  },
  /**
   * Whether finished spans go to an OpenTelemetry collector: yes when the standard endpoint variable is set, which
   * the exporter itself reads with the rest of the OTEL_EXPORTER_OTLP_* settings (docs/runbooks/logs-and-errors.md).
   */
  get exportTraces() {
    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    return endpoint !== undefined && endpoint !== '' && process.env.OTEL_SDK_DISABLED !== 'true';
  },
  /** CARSHENAS_DIAGNOSTICS=1 opens the routes that fail on purpose, to check error reporting on a deployment. */
  get diagnosticsEnabled() {
    return process.env.CARSHENAS_DIAGNOSTICS === '1';
  },
  /**
   * CARSHENAS_UNLISTED (1, true, 0 or false): whether every response says noindex and robots.txt closes the site. On in a
   * production build unless set to 0 (ADR-0017 point 10, CS-119); the security headers follow NODE_ENV (src/lib/exposure.ts).
   */
  get exposure(): Exposure {
    return readExposure(process.env);
  },
  /**
   * CARSHENAS_AUTH_KEY: at least 32 random bytes in base64, keying the sign-in throttle's hashes and signing device
   * cookies (ADR-0020 point 8). Parsed once; a missing or short key stops the first request that signs anyone in.
   */
  get authKey(): Buffer {
    return (authKey ??= parseAuthKey(required('CARSHENAS_AUTH_KEY')));
  },
  /** Failed sign-ins one client address may make in an hour (ADR-0020 point 8); the browser tests raise it. */
  get signInAddressLimit() {
    return positiveInteger('CARSHENAS_SIGN_IN_ADDRESS_LIMIT', 100);
  },
  /** Sign-up attempts one client address may make in an hour. */
  get signUpAddressLimit() {
    return positiveInteger('CARSHENAS_SIGN_UP_ADDRESS_LIMIT', 20);
  },
  /** Username availability checks one client address may make in an hour. */
  get usernameCheckAddressLimit() {
    return positiveInteger('CARSHENAS_USERNAME_CHECK_ADDRESS_LIMIT', 120);
  },
  /**
   * SEARCH_UNDERSTANDING_AI: the master switch of the language model's part of plain-Farsi search (CS-62), OFF unless it
   * is `1` or `true`. Off, the search box understands a sentence with code alone, which needs no key and no network; on,
   * a model reads only what code cannot settle, within the spending cap and the visitor limit below. Credit on the
   * Metis account is for work a person starts, never for what a visitor's typing consumes unasked, so no file in the
   * repository turns it on: the owner (or the person running the demo) sets it in the server's environment.
   */
  get searchUnderstandingAi(): boolean {
    const value = process.env.SEARCH_UNDERSTANDING_AI?.trim().toLowerCase();
    if (value === undefined || value === '' || value === '0' || value === 'false') return false;
    if (value === '1' || value === 'true') return true;
    throw new Error(`SEARCH_UNDERSTANDING_AI must be 1, true, 0 or false; it is ${JSON.stringify(value)}.`);
  },
  /** SEARCH_UNDERSTANDING_DAILY_CAP_USD: what the model may cost in one Tehran day for all visitors together (US$1). */
  get searchUnderstandingDailyCapUsd() {
    return positiveNumber('SEARCH_UNDERSTANDING_DAILY_CAP_USD', 1);
  },
  /** SEARCH_UNDERSTANDING_VISITOR_LIMIT: questions put to the model by one client address in an hour (40). */
  get searchUnderstandingVisitorLimit() {
    return positiveInteger('SEARCH_UNDERSTANDING_VISITOR_LIMIT', 40);
  },
  /** SEARCH_UNDERSTANDING_CONCURRENCY: questions with the model at once in this process; more are answered by code (4). */
  get searchUnderstandingConcurrency() {
    return positiveInteger('SEARCH_UNDERSTANDING_CONCURRENCY', 4);
  },
  /** METIS_API_KEY: the one key to every language model (ADR-0019 point 1); absent, the model is unavailable here. */
  get metisApiKey() {
    const value = process.env.METIS_API_KEY;
    return value === undefined || value === '' ? undefined : value;
  },
  /** METIS_PRICING_URL: where the price list is read, Metis's own endpoint when unset; only tests set it. */
  get metisPricingUrl() {
    const value = process.env.METIS_PRICING_URL;
    return value === undefined || value === '' ? undefined : value;
  },
};

/** An optional number above zero, decimals allowed (a US dollar cap); anything else stops with a message saying which. */
function positiveNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  throw new Error(`${name} must be a number above zero; it is ${JSON.stringify(value)}.`);
}

/** An optional whole number above zero; anything else stops the server with a message saying which. */
function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  throw new Error(`${name} must be a whole number above zero; it is ${JSON.stringify(value)}.`);
}
