import 'server-only';
import { parseAuthKey } from '@carshenas/accounts/keyed-hash';
import type { LogFormat, LogLevelSetting } from '@carshenas/observability/logger';

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
};

/** An optional whole number above zero; anything else stops the server with a message saying which. */
function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  throw new Error(`${name} must be a whole number above zero; it is ${JSON.stringify(value)}.`);
}
