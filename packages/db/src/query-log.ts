import type { LogEvent } from 'kysely';
import type { Logger } from '@carshenas/observability/logger';

/** A statement slower than this is a warning in every environment: the query or its index needs a look. */
export const SLOW_QUERY_MS = 500;

export type QueryLogSettings = {
  /** CARSHENAS_LOG_SQL=1: a debug line for every statement. */
  logSql: boolean;
  /** Bind parameters on those lines: development only, because parameters can hold personal data. */
  logParameters: boolean;
};

/**
 * Kysely's log hook for a process. A slow statement is a warning; with `logSql`, every statement is a debug line.
 * A failed statement is only debug: whether it is an error is the caller's decision, and a violated constraint is
 * an expected result. The settings are read on every statement, so a test or a flag can change them at run time.
 */
export function createQueryLog(log: Logger, settings: () => QueryLogSettings): (event: LogEvent) => void {
  return (event) => {
    const { logSql, logParameters } = settings();
    const { sql, parameters } = event.query;
    const durationMs = Math.round(event.queryDurationMillis * 10) / 10;
    const detail = { durationMs, sql, ...(logParameters && { parameters }) };
    if (event.level === 'error') {
      log.debug('statement failed', { ...detail, err: event.error });
    } else if (event.queryDurationMillis >= SLOW_QUERY_MS) {
      log.warn('slow statement', detail);
    } else if (logSql) {
      log.debug('statement', detail);
    }
  };
}
