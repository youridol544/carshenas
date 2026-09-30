// What the AI SDK's OpenTelemetry spans carry for a call through the layer (ADR-0021 point 2.5): the model, the
// finish reason and the tokens, and no prompt, listing text, answer or response body. The SDK records the prompt and
// the answer by default (CS-44); the layer switches both off on every call.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { createAi } from './ai.ts';
import { openai } from './metis.ts';
import type { RegistryEntry } from './task.ts';
import {
  listingCondition,
  PEUGEOT_FACTS,
  sample,
  type ListingCondition,
  type Sample,
} from './test-support/listing-condition.ts';
import { forbidNetwork, openaiReply, stubFetch } from './test-support/network.ts';
import { recordingLogger } from './test-support/recording-logger.ts';

forbidNetwork();

test('spans keep the model, the finish reason and the tokens, and no text', async () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
  const entry: RegistryEntry<Sample, ListingCondition> = {
    task: listingCondition,
    model: openai('gpt-5.6-luna'),
    settings: { maxOutputTokens: 1024, timeoutMs: 5_000, maxReasks: 1 },
  };
  const ai = createAi({
    apiKey: 'tpsg-telemetry-check',
    registry: { 'listing.condition': entry },
    logger: recordingLogger(),
    fetch: stubFetch(openaiReply(JSON.stringify(PEUGEOT_FACTS))).fetch,
    tracer: provider.getTracer('carshenas-ai-test'),
  });
  const listing = sample('peugeot-206-jalali');

  const result = await ai.call('listing.condition', listing);
  await provider.forceFlush();

  assert.equal(result.outcome, 'ok');
  const spans = exporter.getFinishedSpans();
  assert.ok(spans.length > 0, 'the call made spans');
  const values = spans.flatMap((span) => Object.values(span.attributes).map(String));
  // The answer's text is in the response body too, so its absence also shows that the body is not recorded.
  for (const text of [
    listing.text,
    PEUGEOT_FACTS.price_evidence,
    listingCondition.instructions.slice(0, 40),
  ]) {
    assert.ok(!values.some((value) => value.includes(text)), `a span attribute holds ${text.slice(0, 30)}`);
  }
  const attributes = Object.assign({}, ...spans.map((span) => span.attributes)) as Record<string, unknown>;
  assert.equal(attributes['gen_ai.request.model'], 'gpt-5.6-luna');
  assert.equal(attributes['gen_ai.response.model'], 'gpt-5.6-luna-2026-07-09');
  assert.equal(
    attributes['gen_ai.response.id'],
    'chatcmpl-stub',
    "the provider's response id, not its content",
  );
  assert.equal(attributes['gen_ai.usage.input_tokens'], 700);
  assert.equal(attributes['gen_ai.usage.output_tokens'], 93);
});
