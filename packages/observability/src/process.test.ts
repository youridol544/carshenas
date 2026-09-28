import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Run by plain Node, the way the crawler worker will run: no Next.js, no bundler, TypeScript stripped by Node.
const fixture = fileURLToPath(new URL('fixtures/crash-on-purpose.ts', import.meta.url));

function runWorker(failure: 'exception' | 'rejection') {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', fixture, failure],
    { encoding: 'utf8', timeout: 15_000 },
  );
  const lines = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { status: result.status, lines, stderr: result.stderr };
}

test('an uncaught exception writes one fatal line with the error and exits with 1', () => {
  const { status, lines, stderr } = runWorker('exception');
  assert.equal(status, 1);
  assert.equal(stderr, '');
  assert.deepEqual(
    lines.map((line) => [line.level, line.msg]),
    [
      ['info', 'worker started'],
      ['fatal', 'uncaught exception, exiting'],
    ],
  );
  const err = lines[1]?.err as { type: string; message: string; stack: string };
  assert.equal(err.type, 'TypeError');
  assert.equal(err.message, 'snapshot.price is undefined');
  assert.match(err.stack, /crash-on-purpose\.ts:\d+:\d+/);
  assert.equal(lines[1]?.service, 'carshenas-worker');
});

test('an unhandled rejection writes one fatal line with the reason and exits with 1', () => {
  const { status, lines } = runWorker('rejection');
  assert.equal(status, 1);
  const last = lines.at(-1);
  assert.equal(last?.level, 'fatal');
  assert.equal(last.msg, 'unhandled promise rejection, exiting');
  assert.equal((last.err as { message: string }).message, 'the source answered 429');
});
