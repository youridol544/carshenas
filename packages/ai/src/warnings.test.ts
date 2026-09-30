// The SDK's own warnings go through the layer's logger. The hook is process-wide and the first layer created installs
// it, so this test has a file, and a process, of its own.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAi } from './ai.ts';
import { deepseek } from './metis.ts';
import type { RegistryEntry } from './task.ts';
import {
  listingCondition,
  PEUGEOT_FACTS,
  sample,
  type ListingCondition,
  type Sample,
} from './test-support/listing-condition.ts';
import { deepseekReply, forbidNetwork, stubFetch } from './test-support/network.ts';
import { recordingLogger } from './test-support/recording-logger.ts';

forbidNetwork();

test("a warning from the SDK is a line of the layer's log, not text on the process's warning stream", async () => {
  const logger = recordingLogger();
  const stream: string[] = [];
  const onWarning = (warning: Error) => stream.push(warning.message);
  process.on('warning', onWarning);
  // DeepSeek's route takes JSON mode only, so the SDK warns that the schema goes in a compatibility mode.
  const entry: RegistryEntry<Sample, ListingCondition> = {
    task: listingCondition,
    model: deepseek('deepseek-v4-flash'),
    settings: { maxOutputTokens: 1024, timeoutMs: 5_000, maxReasks: 1 },
  };
  const ai = createAi({
    apiKey: 'tpsg-warning-check',
    registry: { 'listing.condition': entry },
    logger,
    fetch: stubFetch(deepseekReply(JSON.stringify(PEUGEOT_FACTS))).fetch,
  });

  const result = await ai.call('listing.condition', sample('peugeot-206-jalali'));
  await new Promise((resolve) => setImmediate(resolve));
  process.off('warning', onWarning);

  assert.equal(result.outcome, 'ok');
  const lines = logger.lines.filter((line) => line.message === 'model call warning');
  assert.ok(lines.length > 0, 'the warning was logged');
  assert.equal(lines[0]?.level, 'warn');
  assert.equal(lines[0].fields.component, 'ai');
  assert.equal((lines[0].fields.warning as { type?: string }).type, 'compatibility');
  assert.deepEqual(stream, [], 'nothing went to the warning stream');
});
