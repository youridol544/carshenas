import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompiledQuery, type LogEvent } from 'kysely';
import type { LogFields, Logger } from '@carshenas/observability/logger';
import { createQueryLog, SLOW_QUERY_MS, type QueryLogSettings } from './query-log.ts';

type Line = { level: string; message: string; fields: LogFields | undefined };

function recordingLogger(lines: Line[]): Logger {
  const record =
    (level: string) =>
    (message: string, fields?: LogFields): void => {
      lines.push({ level, message, fields });
    };
  const logger: Logger = {
    trace: record('trace'),
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    fatal: record('fatal'),
    child: () => logger,
    isLevelEnabled: () => true,
    flush: () => Promise.resolve(),
  };
  return logger;
}

const SQL = 'select "id" from "listing" where "phone" = $1';
const PARAMETERS = ['09121234567'];

function event(durationMs: number, error?: Error): LogEvent {
  const query = CompiledQuery.raw(SQL, PARAMETERS);
  return error
    ? { level: 'error', error, query, queryDurationMillis: durationMs }
    : { level: 'query', query, queryDurationMillis: durationMs };
}

function setup(settings: QueryLogSettings): { lines: Line[]; log: (event: LogEvent) => void } {
  const lines: Line[] = [];
  return { lines, log: createQueryLog(recordingLogger(lines), () => settings) };
}

test('a slow statement is a warning with its duration and SQL, never its parameters', () => {
  const { lines, log } = setup({ logSql: false, logParameters: false });
  log(event(SLOW_QUERY_MS + 12.34));
  assert.deepEqual(lines, [
    { level: 'warn', message: 'slow statement', fields: { durationMs: 512.3, sql: SQL } },
  ]);
});

test('a failed statement is only debug: whether it is an error is for the caller to decide', () => {
  const { lines, log } = setup({ logSql: false, logParameters: false });
  const violation = new Error('duplicate key value violates unique constraint');
  log(event(3, violation));
  assert.deepEqual(lines, [
    { level: 'debug', message: 'statement failed', fields: { durationMs: 3, sql: SQL, err: violation } },
  ]);
});

test('an ordinary statement writes a line only when every statement is logged', () => {
  const quiet = setup({ logSql: false, logParameters: false });
  quiet.log(event(2));
  assert.deepEqual(quiet.lines, []);
  const verbose = setup({ logSql: true, logParameters: false });
  verbose.log(event(2));
  assert.deepEqual(verbose.lines, [
    { level: 'debug', message: 'statement', fields: { durationMs: 2, sql: SQL } },
  ]);
});

test('parameters are written only when the settings allow them', () => {
  const { lines, log } = setup({ logSql: true, logParameters: true });
  log(event(2));
  assert.deepEqual(lines[0]?.fields, { durationMs: 2, sql: SQL, parameters: PARAMETERS });
});

test('the settings are read for every statement, so they can change while the process runs', () => {
  const lines: Line[] = [];
  let settings: QueryLogSettings = { logSql: false, logParameters: false };
  const log = createQueryLog(recordingLogger(lines), () => settings);
  log(event(2));
  settings = { logSql: true, logParameters: false };
  log(event(2));
  assert.equal(lines.length, 1);
});
