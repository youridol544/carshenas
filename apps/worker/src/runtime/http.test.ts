import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { startStubSource, type StubAnswer } from '../test-support/stub-source.ts';
import { SourceBlockedError, SourceThrottledError, SourceUnavailableError } from './errors.ts';
import { AnswerTooLargeError, createSourceFetch, parseRetryAfter, type SourceFetch } from './http.ts';
import type { LaneClient } from './job.ts';

// The HTTP edge against a local stub: which answers the lane is told are the source's problems, and what the
// crawler sends. The lane itself is a stand-in here; the lanes' database tests use the real one.

const USER_AGENT = 'CarshenasTest/1.0 (+test@example.com)';
const stubs: { close(): Promise<void> }[] = [];

after(async () => {
  await Promise.all(stubs.map((stub) => stub.close()));
});

/** A lane that only lends its signal, with a request timeout of `timeoutMs`. */
function directLane(timeoutMs = 2_000): LaneClient {
  return {
    sourceId: 'stub',
    request: (send) => send({ signal: AbortSignal.timeout(timeoutMs), startedAt: new Date() }),
  };
}

async function stubFetch(script: readonly StubAnswer[], timeoutMs?: number) {
  const stub = await startStubSource(script);
  stubs.push(stub);
  const fetchFromSource: SourceFetch = createSourceFetch(directLane(timeoutMs), () => USER_AGENT);
  return { stub, fetchFromSource };
}

test('an ordinary answer, a 404 included, comes back read in full with the crawler named', async () => {
  const { stub, fetchFromSource } = await stubFetch([
    { status: 200, body: '{"listings":[1,2]}' },
    { status: 404, body: '{"error":"gone"}' },
  ]);
  const ok = await fetchFromSource(`${stub.url}/v8/postlist`, {
    method: 'POST',
    body: '{}',
    headers: { 'user-agent': 'SomethingElse/1.0', 'content-type': 'application/json' },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body, '{"listings":[1,2]}');
  assert.ok(ok.startedAt instanceof Date);
  const gone = await fetchFromSource(`${stub.url}/v8/posts/abc`);
  assert.equal(gone.status, 404);
  // The crawler's name is not the job's to change (ADR-0008 point 5).
  assert.deepEqual(
    stub.requests.map((request) => [request.method, request.path, request.headers['user-agent']]),
    [
      ['POST', '/v8/postlist', USER_AGENT],
      ['GET', '/v8/posts/abc', USER_AGENT],
    ],
  );
});

test('a redirect is returned, not followed: every hop would be another request to pace', async () => {
  const { stub, fetchFromSource } = await stubFetch([{ status: 302, headers: { location: '/login' } }]);
  const answer = await fetchFromSource(`${stub.url}/v/abc`);
  assert.equal(answer.status, 302);
  assert.equal(answer.headers.get('location'), '/login');
  assert.equal(stub.requests.length, 1);
});

test('401 and 403 are blocks', async () => {
  const { stub, fetchFromSource } = await stubFetch([{ status: 403 }, { status: 401 }]);
  for (const status of [403, 401]) {
    await assert.rejects(fetchFromSource(stub.url), (error: unknown) => {
      assert.ok(error instanceof SourceBlockedError);
      assert.equal(error.reason, 'blocked');
      assert.equal(error.status, status);
      return true;
    });
  }
});

test('a 429 asks us to slow down, with its Retry-After', async () => {
  const { stub, fetchFromSource } = await stubFetch([{ status: 429, headers: { 'retry-after': '120' } }]);
  await assert.rejects(fetchFromSource(stub.url), (error: unknown) => {
    assert.ok(error instanceof SourceThrottledError);
    assert.equal(error.retryAfterMs, 120_000);
    return true;
  });
});

test('408, 5xx, a dropped connection and a timeout mean the source is struggling', async () => {
  const { stub, fetchFromSource } = await stubFetch([
    { status: 503, headers: { 'retry-after': '30' } },
    { status: 500 },
    { status: 408 },
    { status: 200, hangUp: true },
  ]);
  const expectations: [number | undefined, number | undefined][] = [
    [503, 30_000],
    [500, undefined],
    [408, undefined],
    [undefined, undefined],
  ];
  for (const [status, retryAfterMs] of expectations) {
    await assert.rejects(fetchFromSource(stub.url), (error: unknown) => {
      assert.ok(error instanceof SourceUnavailableError, String(error));
      assert.equal(error.status, status);
      assert.equal(error.retryAfterMs, retryAfterMs);
      return true;
    });
  }
  const slow = await stubFetch([{ status: 200, delayMs: 1_000 }], 100);
  await assert.rejects(slow.fetchFromSource(slow.stub.url), (error: unknown) => {
    assert.ok(error instanceof SourceUnavailableError);
    assert.equal(error.message, 'the source did not answer in time');
    return true;
  });
});

test('an answer the source adapter recognises as a challenge or an empty list is a block', async () => {
  const { stub, fetchFromSource } = await stubFetch([{ status: 200, body: '{"listings":[]}' }]);
  await assert.rejects(
    fetchFromSource(stub.url, {
      detectBlock: (answer) => (answer.body === '{"listings":[]}' ? 'blocked' : undefined),
    }),
    (error: unknown) => error instanceof SourceBlockedError && error.status === 200,
  );
});

test('an answer larger than the limit fails the job, not the source', async () => {
  const { stub, fetchFromSource } = await stubFetch([{ status: 200, body: 'x'.repeat(10_000) }]);
  await assert.rejects(fetchFromSource(stub.url, { maxBytes: 1_000 }), AnswerTooLargeError);
});

test('Retry-After is read as seconds or an HTTP date', () => {
  const now = Date.parse('2026-09-29T08:00:00Z');
  assert.equal(parseRetryAfter('90', now), 90_000);
  assert.equal(parseRetryAfter('Tue, 29 Sep 2026 08:05:00 GMT', now), 300_000);
  assert.equal(parseRetryAfter('Tue, 29 Sep 2026 07:00:00 GMT', now), 0);
  assert.equal(parseRetryAfter('soon', now), undefined);
  assert.equal(parseRetryAfter(null, now), undefined);
});
