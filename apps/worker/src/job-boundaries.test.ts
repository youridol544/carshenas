import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';

// What a job may import (ADR-0018 point 1, .claude/rules/worker.md), proved against the worker's own lint config:
// a job placed in src/jobs/ that reaches for the queue library, the driver, the pool or the runtime's internals fails
// `pnpm lint`, and one that uses only its contract passes.

const WORKER_ROOT = path.resolve(import.meta.dirname, '..');

async function lintJob(name: string, source: string): Promise<string[]> {
  // A real file, because typed lint rules read it through the TypeScript project.
  const file = path.join(WORKER_ROOT, 'src', 'jobs', `${name}.ts`);
  writeFileSync(file, source);
  try {
    const [result] = await new ESLint({ cwd: WORKER_ROOT }).lintFiles([file]);
    return (result?.messages ?? []).map((message) => `${message.ruleId ?? 'parse'}: ${message.message}`);
  } finally {
    rmSync(file, { force: true });
  }
}

test('a job that imports the queue, the driver, the pool or the runtime fails lint', async () => {
  const messages = await lintJob(
    'lint-sample-bad',
    [
      "import { PgBoss } from 'pg-boss';",
      "import pg from 'pg';",
      "import { createWorkerDatabase } from '../db/database.ts';",
      "import { createRuntime } from '../runtime/runtime.ts';",
      "import { createLaneClient } from '../runtime/lane-client.ts';",
      'export const reached = [PgBoss, pg, createWorkerDatabase, createRuntime, createLaneClient];',
      '',
    ].join('\n'),
  );
  const restricted = messages.filter((message) => message.startsWith('no-restricted-imports'));
  assert.equal(restricted.length, 5, messages.join('\n'));
});

test('a job that uses only its contract passes lint', async () => {
  const messages = await lintJob(
    'lint-sample-good',
    [
      "import * as z from 'zod';",
      "import { SourceBlockedError } from '../runtime/errors.ts';",
      "import type { SourceResponse } from '../runtime/http.ts';",
      "import { defineLaneJob } from '../runtime/job.ts';",
      '',
      'export const readListing = defineLaneJob({',
      "  name: 'crawl.lint-sample',",
      '  payload: z.object({ sourceId: z.string(), url: z.string() }),',
      '  source: (payload) => payload.sourceId,',
      '  async run(payload, context) {',
      '    const answer: SourceResponse = await context.fetch(payload.url, {',
      "      detectBlock: (response) => (response.body === '' ? 'blocked' : undefined),",
      '    });',
      "    if (answer.status === 451) throw new SourceBlockedError('the source refused', { reason: 'blocked' });",
      "    context.count('listings');",
      '  },',
      '});',
      '',
    ].join('\n'),
  );
  assert.deepEqual(messages, []);
});
