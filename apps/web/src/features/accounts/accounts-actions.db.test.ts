import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { signInAction, signOutAction, signUpAction } from '@/features/accounts/accounts-actions';
import type { SignInState } from '@/features/accounts/accounts-types';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import type { env as serverEnv } from '@/server/env';
import { recordedLines } from '@/server/observability/recording-logger';

// The accounts' actions end to end against the scratch database `pnpm db:check` migrated, through the app's own pool,
// with the request's headers and cookies in memory. What CS-39's criterion 7 asks: the typed username, the password,
// the session and device tokens and the client address never reach a log line, and no answer carries a password.

const test_ = vi.hoisted(() => {
  class Redirected extends Error {
    constructor(readonly location: string) {
      super(`redirected to ${location}`);
    }
  }
  return {
    Redirected,
    authKey: Buffer.alloc(32, 5),
    headers: new Headers(),
    cookies: new Map<string, string>(),
  };
});

vi.mock('@/server/env', async (importOriginal) => {
  const { env } = await importOriginal<{ env: typeof serverEnv }>();
  return {
    env: Object.defineProperty(Object.create(env) as typeof serverEnv, 'authKey', { value: test_.authKey }),
  };
});
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(test_.headers),
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = test_.cookies.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: (name: string, value: string) => {
        if (value === '') test_.cookies.delete(name);
        else test_.cookies.set(name, value);
      },
    }),
}));
vi.mock('next/navigation', () => ({
  redirect: (location: string) => {
    throw new test_.Redirected(location);
  },
}));

const ADDRESS = '10.20.30.40';
const owner = ownerDatabase();

beforeAll(async () => {
  await assertScratchDatabase(owner);
});

afterAll(async () => {
  await owner.destroy();
});

beforeEach(() => {
  recordedLines.length = 0;
  test_.cookies.clear();
  for (const name of [...test_.headers.keys()]) test_.headers.delete(name);
  test_.headers.set('sec-fetch-site', 'same-origin');
  test_.headers.set('host', '127.0.0.1:3000');
  test_.headers.set('x-forwarded-proto', 'http');
  test_.headers.set('x-forwarded-for', ADDRESS);
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function redirectOf(action: Promise<unknown>): Promise<string> {
  const error: unknown = await action.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof test_.Redirected)) throw new Error('expected a redirect', { cause: error });
  return error.location;
}

test('signing up, in and out logs outcomes and account ids, never a name, a password, a token or an address', async () => {
  const typedUsername = `Private_${randomBytes(4).toString('hex')}`;
  const username = typedUsername.toLowerCase();
  const password = `private words ${randomBytes(4).toString('hex')}`;
  const seenTokens: string[] = [];

  expect(
    await redirectOf(
      signUpAction({ status: 'idle' }, form({ username: typedUsername, password, next: '/' })),
    ),
  ).toBe('/');
  const { id } = await owner
    .selectFrom('account')
    .select('id')
    .where('username', '=', username)
    .executeTakeFirstOrThrow();
  seenTokens.push(...test_.cookies.values());
  expect(test_.cookies.get('session')).toMatch(/^[A-Za-z0-9_-]{43}$/);

  expect(await redirectOf(signOutAction(form({ next: '/account' })))).toBe('/');
  expect(test_.cookies.has('session')).toBe(false);

  const wrong: SignInState = await signInAction(
    { status: 'idle' },
    form({ username: typedUsername, password: 'not the password', next: '' }),
  );
  expect(wrong).toMatchObject({
    status: 'rejected',
    username,
    failure: { kind: 'wrong', failuresInARow: 1 },
  });
  expect(JSON.stringify(wrong)).not.toContain('not the password');

  expect(
    await redirectOf(signInAction({ status: 'idle' }, form({ username, password, next: '/account' }))),
  ).toBe('/account');
  seenTokens.push(...test_.cookies.values());

  expect(recordedLines.map((line) => [line.message, line.fields.outcome, line.fields.accountId])).toEqual([
    ['sign-up attempt', 'created', id],
    ['signed out', undefined, id],
    ['sign-in attempt', 'wrong', id],
    ['sign-in attempt', 'signed_in', id],
  ]);
  const logged = JSON.stringify(recordedLines);
  for (const secret of [typedUsername, username, password, 'not the password', ADDRESS, ...seenTokens]) {
    expect(logged).not.toContain(secret);
  }
});

test('a sign-up refused for its password answers with the stored name and the problems, never the password', async () => {
  const state = await signUpAction(
    { status: 'idle' },
    form({ username: `Name_${randomBytes(4).toString('hex')}`, password: '12345678', next: '' }),
  );
  expect(state).toMatchObject({ status: 'rejected', passwordError: 'common' });
  expect(JSON.stringify(state)).not.toContain('12345678');
  expect(JSON.stringify(recordedLines)).not.toContain('12345678');
});

test('an action sent from another site is refused before anything is read or written', async () => {
  test_.headers.set('sec-fetch-site', 'cross-site');
  const username = `cross_${randomBytes(4).toString('hex')}`;
  await expect(
    signUpAction({ status: 'idle' }, form({ username, password: 'blue tiger eats rice', next: '' })),
  ).rejects.toThrow(/outside this site/);
  const made = await owner.selectFrom('account').select('id').where('username', '=', username).execute();
  expect(made).toHaveLength(0);
  expect(recordedLines).toEqual([]);
});
