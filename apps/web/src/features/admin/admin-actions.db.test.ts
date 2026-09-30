import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { changeSourceStateAction } from '@/features/admin/admin-actions';
import type { ChangeSourceStateState } from '@/features/admin/admin-types';
import { loadSources, RECENT_CHANGES } from '@/features/admin/server/admin-queries';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { adminDatabase } from '@/server/db/admin-database';
import { recordedLines } from '@/server/observability/recording-logger';

// The sources screen's action and reads end to end (CS-40) against the scratch database `pnpm db:check` migrated,
// through the section's own pool, as carshenas_admin. Only the request is in memory: its headers, the signed-in
// account requireSuperadmin() answers with, and the router refresh.

const test_ = vi.hoisted(() => {
  class NotFound extends Error {}
  return {
    NotFound,
    headers: new Headers(),
    account: undefined as { id: number; username: string; role: 'buyer' | 'superadmin' } | undefined,
    refresh: vi.fn(),
  };
});

vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(test_.headers) }));
vi.mock('next/cache', () => ({ refresh: test_.refresh }));
vi.mock('@/server/auth/current-account', () => ({
  requireSuperadmin: () => {
    if (test_.account?.role !== 'superadmin') throw new test_.NotFound('not found');
    return Promise.resolve(test_.account);
  },
}));

const owner = ownerDatabase();
const IDLE: ChangeSourceStateState = { status: 'idle' };
let superadmin: { id: number; username: string };

beforeAll(async () => {
  await assertScratchDatabase(owner);
  superadmin = await createAccount(owner, 'superadmin');
});

afterAll(async () => {
  await Promise.all([owner.destroy(), adminDatabase().destroy()]);
});

beforeEach(() => {
  recordedLines.length = 0;
  test_.refresh.mockClear();
  test_.account = { ...superadmin, role: 'superadmin' };
  for (const name of [...test_.headers.keys()]) test_.headers.delete(name);
  test_.headers.set('sec-fetch-site', 'same-origin');
});

/** A crawled source of this test's own, so tests never share one. */
async function createSource(
  crawlState: 'enabled' | 'paused' = 'enabled',
  accessMethod: 'crawl' | 'official_api' = 'crawl',
): Promise<string> {
  const id = `a_${randomBytes(5).toString('hex')}`;
  await owner
    .insertInto('source')
    .values({
      id,
      origin: 'external',
      access_method: accessMethod,
      name_fa: 'منبع آزمایشی',
      base_url: 'https://test.example',
      listing_visibility: 'public',
      crawl_state: accessMethod === 'crawl' ? crawlState : 'paused',
      min_request_interval_ms: accessMethod === 'crawl' ? 3_000 : null,
      daily_request_budget: accessMethod === 'crawl' ? 12_000 : null,
    })
    .execute();
  return id;
}

/** What the crawler's stop_source() leaves on a source, at an instant with microseconds. */
async function stopOnBlock(sourceId: string, stoppedAt: string): Promise<void> {
  await owner
    .updateTable('source')
    .set({ crawl_state: 'stopped_on_block', stopped_at: stoppedAt, stop_reason: 'blocked' })
    .where('id', '=', sourceId)
    .execute();
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function sourceOnScreen(id: string) {
  const { sources } = await loadSources();
  const source = sources.find((candidate) => candidate.id === id);
  if (source === undefined) throw new Error(`source ${id} is not on the screen`);
  return source;
}

test('a superadmin pauses and resumes a source, and the screen lists each change with who made it and when', async () => {
  const sourceId = await createSource('enabled');
  const before = Date.now();
  expect(
    await changeSourceStateAction(
      IDLE,
      form({ sourceId, seenState: 'enabled', seenStoppedAt: '', chosen: 'paused' }),
    ),
  ).toMatchObject({ status: 'changed', chosen: 'paused' });
  expect(test_.refresh).toHaveBeenCalledOnce();
  expect(
    await changeSourceStateAction(
      IDLE,
      form({ sourceId, seenState: 'paused', seenStoppedAt: '', chosen: 'enabled' }),
    ),
  ).toMatchObject({ status: 'changed', chosen: 'enabled' });

  const source = await sourceOnScreen(sourceId);
  expect(source).toMatchObject({ crawlState: 'enabled', crawled: true, stop: null });
  expect(
    source.changes.map(({ fromState, toState, changedBy }) => ({ fromState, toState, changedBy })),
  ).toEqual([
    { fromState: 'paused', toState: 'enabled', changedBy: superadmin.username },
    { fromState: 'enabled', toState: 'paused', changedBy: superadmin.username },
  ]);
  for (const change of source.changes) {
    expect(Date.parse(change.changedAt)).toBeGreaterThanOrEqual(before - 1_000);
    expect(Date.parse(change.changedAt)).toBeLessThanOrEqual(Date.now() + 1_000);
  }
});

test('resuming a stopped source clears its stop only when the page showed that very stop, and keeps it in the history', async () => {
  const sourceId = await createSource('enabled');
  await stopOnBlock(sourceId, '2026-09-29 13:13:44.123456+00');
  const shown = await sourceOnScreen(sourceId);
  expect(shown.stop).toMatchObject({ stoppedAt: '2026-09-29T13:13:44.123Z', reason: 'blocked' });
  const stoppedAtText = shown.stop?.stoppedAtText ?? '';
  expect(stoppedAtText).toMatch(/^2026-09-29 13:13:44\.123456\+00$/);

  // The same instant as a JavaScript Date sees it, a millisecond short of the stop, clears nothing.
  expect(
    await changeSourceStateAction(
      IDLE,
      form({
        sourceId,
        seenState: 'stopped_on_block',
        seenStoppedAt: '2026-09-29 13:13:44.123+00',
        chosen: 'enabled',
      }),
    ),
  ).toMatchObject({ status: 'stale' });
  expect((await sourceOnScreen(sourceId)).crawlState).toBe('stopped_on_block');

  expect(
    await changeSourceStateAction(
      IDLE,
      form({ sourceId, seenState: 'stopped_on_block', seenStoppedAt: stoppedAtText, chosen: 'enabled' }),
    ),
  ).toMatchObject({ status: 'changed', chosen: 'enabled' });
  const resumed = await sourceOnScreen(sourceId);
  expect(resumed).toMatchObject({ crawlState: 'enabled', stop: null });
  expect(resumed.changes[0]).toMatchObject({
    fromState: 'stopped_on_block',
    toState: 'enabled',
    changedBy: superadmin.username,
    clearedStop: { stoppedAt: '2026-09-29T13:13:44.123Z', reason: 'blocked' },
  });
});

test('a page that no longer shows the source as it is changes nothing, and a repeated press changes nothing either', async () => {
  const sourceId = await createSource('paused');
  // The crawler stopped the source after the page showed it paused.
  await stopOnBlock(sourceId, '2026-09-30 08:00:00.000001+00');
  expect(
    await changeSourceStateAction(
      IDLE,
      form({ sourceId, seenState: 'paused', seenStoppedAt: '', chosen: 'enabled' }),
    ),
  ).toMatchObject({ status: 'stale', chosen: 'enabled' });
  expect(test_.refresh).toHaveBeenCalledOnce();
  const stillStopped = await sourceOnScreen(sourceId);
  expect(stillStopped).toMatchObject({ crawlState: 'stopped_on_block', changes: [] });

  const pausedId = await createSource('paused');
  const press = form({ sourceId: pausedId, seenState: 'enabled', seenStoppedAt: '', chosen: 'paused' });
  expect(await changeSourceStateAction(IDLE, press)).toMatchObject({ status: 'unchanged', chosen: 'paused' });
  expect((await sourceOnScreen(pausedId)).changes).toEqual([]);
});

test('a source that is not crawled stays paused, and a form this section did not render is refused', async () => {
  const partnerId = await createSource('paused', 'official_api');
  expect(
    await changeSourceStateAction(
      IDLE,
      form({ sourceId: partnerId, seenState: 'paused', seenStoppedAt: '', chosen: 'enabled' }),
    ),
  ).toMatchObject({ status: 'not_crawled' });
  expect(await sourceOnScreen(partnerId)).toMatchObject({
    crawled: false,
    crawlState: 'paused',
    changes: [],
  });

  const sourceId = await createSource('enabled');
  expect(
    await changeSourceStateAction(IDLE, form({ sourceId, seenState: 'enabled', chosen: 'stopped_on_block' })),
  ).toMatchObject({ status: 'invalid' });
  expect((await sourceOnScreen(sourceId)).crawlState).toBe('enabled');
});

test('only a superadmin, and only from a page of this site, changes a source', async () => {
  const sourceId = await createSource('enabled');
  const pause = form({ sourceId, seenState: 'enabled', seenStoppedAt: '', chosen: 'paused' });
  test_.headers.set('sec-fetch-site', 'cross-site');
  await expect(changeSourceStateAction(IDLE, pause)).rejects.toThrow(/outside this site/);
  test_.headers.set('sec-fetch-site', 'same-origin');
  test_.account = { id: superadmin.id, username: superadmin.username, role: 'buyer' };
  await expect(changeSourceStateAction(IDLE, pause)).rejects.toBeInstanceOf(test_.NotFound);
  test_.account = { ...superadmin, role: 'superadmin' };
  expect((await sourceOnScreen(sourceId)).crawlState).toBe('enabled');
  expect(test_.refresh).not.toHaveBeenCalled();
});

test('each change is one log line with the source, the choice, the outcome and the account, and nothing else', async () => {
  const sourceId = await createSource('enabled');
  await changeSourceStateAction(
    IDLE,
    form({ sourceId, seenState: 'enabled', seenStoppedAt: '', chosen: 'paused' }),
  );
  const lines = recordedLines.filter((line) => line.message === 'source state change');
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ level: 'info' });
  expect(lines[0]?.fields).toEqual({
    component: 'admin',
    sourceId,
    seenState: 'enabled',
    chosen: 'paused',
    outcome: 'changed',
    accountId: superadmin.id,
  });
});

test("a source's card lists its latest changes, newest first", async () => {
  const sourceId = await createSource('enabled');
  let state: 'enabled' | 'paused' = 'enabled';
  for (let press = 0; press < RECENT_CHANGES + 2; press += 1) {
    const chosen: 'enabled' | 'paused' = state === 'enabled' ? 'paused' : 'enabled';
    await changeSourceStateAction(IDLE, form({ sourceId, seenState: state, seenStoppedAt: '', chosen }));
    state = chosen;
  }
  const { changes } = await sourceOnScreen(sourceId);
  expect(changes).toHaveLength(RECENT_CHANGES);
  expect(changes[0]?.toState).toBe(state);
  const ids = changes.map((change) => change.id);
  expect(ids).toEqual([...ids].sort((a, b) => b - a));
});
