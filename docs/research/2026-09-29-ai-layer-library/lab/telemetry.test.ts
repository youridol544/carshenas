// What the AI SDK's OpenTelemetry integration (@ai-sdk/otel) records for one structured call, with no network: the
// mock model answers, and an in-memory exporter collects the spans. By default the spans carry the prompt and the
// answer, so a listing's text would reach the traces unless recordInputs and recordOutputs are switched off.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OpenTelemetry } from '@ai-sdk/otel';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { generateText, Output } from 'ai';
import type { TelemetryOptions } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { INSTRUCTIONS, ListingFacts, SAMPLES } from './listing.ts';

const listing = SAMPLES[0]!.text;
const answer = JSON.stringify({
  paint_evidence: ['بی', 'رنگ'].join(String.fromCodePoint(0x200c)),
  paint: 'none',
  price_evidence: 'کمی قابل مذاکره',
  price_type: 'negotiable',
  instructions_to_ai: false,
});

async function spansOf(telemetry: Omit<TelemetryOptions, 'integrations'>) {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
  const model = new MockLanguageModelV4({
    modelId: 'mock-model',
    doGenerate: async () => ({
      content: [{ type: 'text', text: answer }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 700, noCache: 188, cacheRead: 512, cacheWrite: 0 },
        outputTokens: { total: 93, text: 63, reasoning: 30 },
      },
      warnings: [],
      response: { modelId: 'mock-model-2026-09-29' },
    }),
  });
  await generateText({
    model,
    instructions: INSTRUCTIONS,
    messages: [{ role: 'user', content: listing }],
    output: Output.object({ schema: ListingFacts }),
    telemetry: { ...telemetry, integrations: new OpenTelemetry({ tracer: provider.getTracer('carshenas-ai') }) },
  });
  await provider.forceFlush();
  return exporter.getFinishedSpans().map((span) => ({ name: span.name, attributes: span.attributes }));
}

const carriesText = (spans: Awaited<ReturnType<typeof spansOf>>, needle: string) =>
  spans.some((span) => Object.values(span.attributes).some((value) => String(value).includes(needle)));

test('by default the spans record the listing and the answer', async () => {
  const spans = await spansOf({ functionId: 'listing-condition' });
  assert.ok(spans.length > 0);
  assert.ok(carriesText(spans, listing), 'the listing text is in a span attribute');
  assert.ok(carriesText(spans, 'کمی قابل مذاکره'), 'the answer is in a span attribute');
});

test('with recordInputs and recordOutputs off, the spans keep the model, tokens and timing but no text', async (t) => {
  const spans = await spansOf({ functionId: 'listing-condition', recordInputs: false, recordOutputs: false });
  assert.ok(!carriesText(spans, listing), 'no listing text');
  assert.ok(!carriesText(spans, 'کمی قابل مذاکره'), 'no answer text');
  assert.ok(!carriesText(spans, INSTRUCTIONS.slice(0, 40)), 'no instructions');
  const attributes = Object.assign({}, ...spans.map((span) => span.attributes)) as Record<string, unknown>;
  assert.equal(attributes['gen_ai.request.model'], 'mock-model');
  assert.equal(attributes['gen_ai.response.model'], 'mock-model-2026-09-29');
  assert.equal(attributes['gen_ai.usage.input_tokens'], 700);
  assert.equal(attributes['gen_ai.usage.output_tokens'], 93);
  for (const span of spans) t.diagnostic(`${span.name}: ${Object.keys(span.attributes).sort().join(', ')}`);
});
