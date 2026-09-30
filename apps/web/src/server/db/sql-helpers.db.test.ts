import { sql } from 'kysely';
import { afterAll, expect, test } from 'vitest';
import { database } from '@/server/db/database';
import {
  averageSecondsBetween,
  databaseNow,
  inLiterals,
  isoDateText,
  rollup,
  secondsAgo,
  secondsFromNow,
  tehranToday,
} from '@/server/db/sql-helpers';

// The sql fragments' types are assertions (the database skill's kysely.md): each is proved here against the real
// server, through the app's own pool.

afterAll(async () => {
  await database().destroy();
});

test('now() and whole seconds either side of it come back as Dates from the database clock', async () => {
  const { rows } = await sql<{ now: Date; later: Date; earlier: Date }>`
    SELECT ${databaseNow()} AS now, ${secondsFromNow(90)} AS later, ${secondsAgo(3600)} AS earlier`.execute(
    database(),
  );
  const [row] = rows;
  if (row === undefined) throw new Error('no row');
  expect(row.now).toBeInstanceOf(Date);
  expect(row.later.getTime() - row.now.getTime()).toBe(90_000);
  expect(row.now.getTime() - row.earlier.getTime()).toBe(3_600_000);
});

test('today in Tehran is the date of now() at Asia/Tehran, and averages of seconds between instants are numbers', async () => {
  const { rows } = await sql<{ today: Date; expected: Date }>`
    SELECT ${tehranToday()} AS today, (now() AT TIME ZONE 'Asia/Tehran')::date AS expected`.execute(
    database(),
  );
  expect(rows[0]?.today).toEqual(rows[0]?.expected);

  const averages = await sql<{ seconds: number | null }>`
    SELECT ${averageSecondsBetween('started', 'finished')} AS seconds
    FROM (VALUES (timestamptz '2026-09-30 10:00:00Z', timestamptz '2026-09-30 10:00:03Z'),
                 (timestamptz '2026-09-30 11:00:00Z', timestamptz '2026-09-30 11:00:05Z'),
                 (timestamptz '2026-09-30 12:00:00Z', NULL)) AS run (started, finished)`.execute(database());
  expect(averages.rows[0]?.seconds).toBe(4);
});

test('an IN list of literals is written into the SQL text, and filters as IN does', async () => {
  const query = sql<{ outcome: string }>`
    SELECT outcome FROM (VALUES ('ok'), ('blocked'), ('challenge')) AS answer (outcome)
    WHERE ${inLiterals('outcome', ['blocked', 'challenge'])} ORDER BY outcome`;
  expect(query.compile(database()).sql).toContain(`"outcome" IN ('blocked', 'challenge')`);
  expect(query.compile(database()).parameters).toEqual([]);
  const { rows } = await query.execute(database());
  expect(rows.map((row) => row.outcome)).toEqual(['blocked', 'challenge']);
});

test('a rollup adds one row for all rows together, with its column null', async () => {
  const { rows } = await sql<{ source: string | null; listings: number }>`
    SELECT source, count(*)::integer AS listings
    FROM (VALUES ('bama'), ('divar'), ('divar')) AS row (source)
    GROUP BY ${rollup('source')} ORDER BY source NULLS LAST`.execute(database());
  expect(rows).toEqual([
    { source: 'bama', listings: 1 },
    { source: 'divar', listings: 2 },
    { source: null, listings: 3 },
  ]);
});

test('a date reads as its ISO day, whatever the session time zone', async () => {
  const { rows } = await sql<{ day: string }>`
    SELECT ${isoDateText('day')} AS day FROM (VALUES (date '2026-09-30')) AS row (day)`.execute(database());
  expect(rows).toEqual([{ day: '2026-09-30' }]);
});
