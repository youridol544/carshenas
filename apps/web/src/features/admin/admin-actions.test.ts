// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { changeSourceStateAction } from '@/features/admin/admin-actions';
import { changeSourceState } from '@/features/admin/server/source-mutations';
import { captureError } from '@/server/observability/logger';

// What the source state action answers when the database does not (CS-40): the failure is reported once, with the
// source and the choice, the form hears that the change did not come through, and the page shows the source as it now
// is. The end-to-end paths run against a real database in admin-actions.db.test.ts.

const request = vi.hoisted(() => ({
  headers: new Headers({ 'sec-fetch-site': 'same-origin' }),
  refresh: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(request.headers) }));
vi.mock('next/cache', () => ({ refresh: request.refresh }));
vi.mock('@/server/auth/current-account', () => ({
  requireSuperadmin: () => Promise.resolve({ id: 7, username: 'pedram', role: 'superadmin' }),
}));
vi.mock('@/features/admin/server/source-mutations', () => ({ changeSourceState: vi.fn() }));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

function pause(): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    sourceId: 'divar',
    seenState: 'enabled',
    seenStoppedAt: '',
    chosen: 'paused',
  })) {
    data.set(name, value);
  }
  return data;
}

beforeEach(() => {
  request.refresh.mockClear();
});

test('a database that does not answer is reported once and answered as failed, and the page shows the source again', async () => {
  const lost = new Error('Connection terminated unexpectedly');
  vi.mocked(changeSourceState).mockRejectedValueOnce(lost);
  const state = await changeSourceStateAction({ status: 'idle' }, pause());
  expect(state).toMatchObject({ status: 'failed', chosen: 'paused' });
  expect(captureError).toHaveBeenCalledExactlyOnceWith(lost, {
    message: 'source state change failed',
    fields: { sourceId: 'divar', chosen: 'paused', accountId: 7 },
  });
  expect(request.refresh).toHaveBeenCalledOnce();
});

test('an answer from the database goes to the form as it came, with one refresh', async () => {
  vi.mocked(changeSourceState).mockResolvedValueOnce('stale');
  expect(await changeSourceStateAction({ status: 'idle' }, pause())).toMatchObject({
    status: 'stale',
    chosen: 'paused',
  });
  expect(captureError).not.toHaveBeenCalled();
  expect(request.refresh).toHaveBeenCalledOnce();
});
