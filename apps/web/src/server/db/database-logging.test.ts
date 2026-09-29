// @vitest-environment node
import { CompiledQuery, type LogEvent } from 'kysely';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SLOW_QUERY_MS } from '@carshenas/db/query-log';
import { logQuery } from '@/server/db/database';
import { recordedLines } from '@/server/observability/recording-logger';

vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger() };
});

beforeEach(() => {
  recordedLines.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const SQL = 'select "id" from "listing" where "phone" = $1';
const PARAMETERS = ['09121234567'];

function event(durationMs: number, error?: Error): LogEvent {
  const query = CompiledQuery.raw(SQL, PARAMETERS);
  return error
    ? { level: 'error', error, query, queryDurationMillis: durationMs }
    : { level: 'query', query, queryDurationMillis: durationMs };
}

test('a slow statement is a warning with its duration and SQL, never its parameters', () => {
  logQuery(event(SLOW_QUERY_MS + 12.34));
  expect(recordedLines).toEqual([
    {
      level: 'warn',
      message: 'slow statement',
      fields: { component: 'db', durationMs: 512.3, sql: SQL },
    },
  ]);
});

test('a failed statement is only debug: whether it is an error is for the caller to decide', () => {
  const violation = new Error('duplicate key value violates unique constraint');
  logQuery(event(3, violation));
  expect(recordedLines).toEqual([
    {
      level: 'debug',
      message: 'statement failed',
      fields: { component: 'db', durationMs: 3, sql: SQL, err: violation },
    },
  ]);
});

test('an ordinary statement writes nothing unless CARSHENAS_LOG_SQL is set', () => {
  logQuery(event(2));
  expect(recordedLines).toEqual([]);
  vi.stubEnv('CARSHENAS_LOG_SQL', '1');
  logQuery(event(2));
  expect(recordedLines).toEqual([
    { level: 'debug', message: 'statement', fields: { component: 'db', durationMs: 2, sql: SQL } },
  ]);
});

test('parameters are written only in development, with CARSHENAS_LOG_SQL set', () => {
  vi.stubEnv('CARSHENAS_LOG_SQL', '1');
  vi.stubEnv('NODE_ENV', 'development');
  logQuery(event(2));
  expect(recordedLines[0]?.fields).toMatchObject({ parameters: PARAMETERS });
});
