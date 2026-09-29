// The wire check (ADR-0021 point 1, moved here from CS-44's lab): what each provider package puts on the wire to
// Metis's native routes, and how each route's refusal, truncation and empty answer come back, with no network. It is
// the gate before any upgrade of the AI SDK, with the live run (scripts/live.ts): pinned versions, one lockfile.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { z } from 'zod';
import { createAi } from './ai.ts';
import { anthropic, deepseek, google, openai, type ModelChoice } from './metis.ts';
import type { RegistryEntry } from './task.ts';
import {
  listingCondition,
  PEUGEOT_FACTS,
  sample,
  type ListingCondition,
  type Sample,
} from './test-support/listing-condition.ts';
import {
  anthropicReply,
  deepseekReply,
  forbidNetwork,
  geminiReply,
  openaiReply,
  stubFetch,
  type Reply,
  type SentRequest,
} from './test-support/network.ts';
import { recordingLogger } from './test-support/recording-logger.ts';

forbidNetwork();

const peugeot = sample('peugeot-206-jalali');
const valid = JSON.stringify(PEUGEOT_FACTS);
const cut = valid.slice(0, 40);

async function callThrough(model: ModelChoice, reply: Reply) {
  const network = stubFetch(reply);
  const entry: RegistryEntry<Sample, ListingCondition> = {
    task: listingCondition,
    model,
    settings: { maxOutputTokens: 2048, timeoutMs: 5_000, maxReasks: 1 },
  };
  const ai = createAi({
    apiKey: 'tpsg-wire-check',
    registry: { 'listing.condition': entry },
    logger: recordingLogger(),
    fetch: network.fetch,
  });
  const result = await ai.call('listing.condition', peugeot);
  const [request] = network.requests;
  assert.ok(request, 'one request was sent');
  return { result, request, requests: network.requests };
}

type Route = {
  readonly name: string;
  readonly model: ModelChoice;
  readonly url: string;
  readonly keyHeader: string;
  readonly reply: (text: string | null, finish?: string) => Reply;
  readonly structured: (request: SentRequest) => void;
  readonly refusal?: Reply;
  readonly truncated: Reply;
  readonly empty: Reply;
};

const ROUTES: Route[] = [
  {
    name: 'OpenAI Chat Completions',
    model: openai('gpt-5.6-luna', { reasoningEffort: 'low' }),
    url: 'https://api.metisai.ir/openai/v1/chat/completions',
    keyHeader: 'authorization',
    reply: openaiReply,
    structured({ body }) {
      const format = body.response_format as {
        type: string;
        json_schema: { strict: boolean; schema: object };
      };
      assert.equal(format.type, 'json_schema');
      assert.equal(format.json_schema.strict, true);
      assert.equal(body.max_completion_tokens, 2048);
      assert.equal(body.reasoning_effort, 'low');
    },
    refusal: openaiReply(null, 'stop', 'I cannot help with that request.'),
    truncated: openaiReply(cut, 'length'),
    empty: openaiReply(''),
  },
  {
    name: 'Anthropic Messages',
    model: anthropic('claude-haiku-4-5'),
    url: 'https://api.metisai.ir/anthropic/v1/messages',
    keyHeader: 'x-api-key',
    reply: anthropicReply,
    structured({ body, headers }) {
      const config = body.output_config as { format: { type: string; schema: object } };
      assert.equal(config.format.type, 'json_schema');
      assert.equal(body.tools, undefined, 'no JSON tool in place of structured output');
      assert.ok(!(headers.get('anthropic-beta') ?? '').includes('structured-outputs'), 'no beta header');
      assert.equal(body.max_tokens, 2048);
    },
    refusal: anthropicReply(null, 'refusal'),
    truncated: anthropicReply(cut, 'max_tokens'),
    empty: anthropicReply(null),
  },
  {
    name: 'Gemini generateContent',
    model: google('gemini-3.1-flash-lite'),
    url: 'https://api.metisai.ir/v1beta/models/gemini-3.1-flash-lite:generateContent',
    keyHeader: 'x-goog-api-key',
    reply: geminiReply,
    structured({ body }) {
      const config = body.generationConfig as Record<string, unknown>;
      assert.equal(config.responseMimeType, 'application/json');
      assert.equal(typeof config.responseJsonSchema, 'object');
      assert.equal(config.maxOutputTokens, 2048);
    },
    refusal: geminiReply(null, 'SAFETY'),
    truncated: geminiReply(cut, 'MAX_TOKENS'),
    empty: geminiReply(null),
  },
  {
    name: 'DeepSeek in JSON mode',
    model: deepseek('deepseek-v4-flash'),
    url: 'https://api.metisai.ir/deepseek/v1/chat/completions',
    keyHeader: 'authorization',
    reply: deepseekReply,
    structured({ body }) {
      assert.deepEqual(body.response_format, { type: 'json_object' });
      const messages = body.messages as { role: string; content: string }[];
      assert.ok(
        messages.some((message) => message.role === 'system' && message.content.includes('"paint_evidence"')),
        'the schema goes in a system message',
      );
    },
    truncated: deepseekReply(cut, 'length'),
    empty: deepseekReply(''),
  },
];

for (const route of ROUTES) {
  describe(route.name, () => {
    test('sends its native structured-output request to Metis, with the key in its own header only', async () => {
      const { result, request } = await callThrough(route.model, route.reply(valid));
      assert.equal(request.url.href, route.url);
      assert.ok(request.headers.has(route.keyHeader));
      assert.ok(!request.url.searchParams.has('key'), 'the key is never in the URL');
      route.structured(request);
      assert.equal(result.outcome, 'ok');
    });

    const cases: [string, Reply | undefined, string][] = [
      ['a refusal', route.refusal, 'refusal'],
      ['an answer cut at the token limit', route.truncated, 'truncated'],
      ['an answer with no text', route.empty, 'empty'],
    ];
    for (const [name, reply, outcome] of cases) {
      if (!reply) continue;
      test(`reports ${name} as ${outcome}, without a re-ask`, async () => {
        const { result, requests } = await callThrough(route.model, reply);
        assert.equal(result.outcome, outcome);
        assert.equal(requests.length, 1);
      });
    }
  });
}

test('a Claude model the Anthropic package does not know still gets output_config.format, not a JSON tool', async () => {
  const { request } = await callThrough(anthropic('claude-future-9'), anthropicReply(valid));
  assert.equal((request.body.output_config as { format: { type: string } }).format.type, 'json_schema');
  assert.equal(request.body.tools, undefined);
});

const Recorded = z.object({
  status: z.number(),
  headers: z.record(z.string(), z.string()),
  body: z.unknown(),
});

/** One real answer per route, recorded from Metis by `pnpm --filter @carshenas/ai live --record` (2026-09-29). */
function recorded(route: string): Reply {
  const file = new URL(`./test-support/recorded/${route}.json`, import.meta.url);
  return Recorded.parse(JSON.parse(readFileSync(file, 'utf8')));
}

describe("Metis's real answers, replayed", () => {
  for (const [route, model, answering] of [
    ['openai', openai('gpt-5.6-luna', { reasoningEffort: 'low' }), 'gpt-5.6-luna'],
    ['anthropic', anthropic('claude-haiku-4-5'), 'claude-haiku-4-5-20251001'],
    ['google', google('gemini-3.1-flash-lite'), 'gemini-3.1-flash-lite'],
    ['deepseek', deepseek('deepseek-v4-flash'), 'deepseek-flash'],
  ] as const) {
    test(`${route}: read as a valid, grounded answer from the model that answered`, async () => {
      const { result } = await callThrough(model, recorded(route));
      assert.equal(result.outcome, 'ok');
      assert.equal(result.attempts.length, 1);
      assert.equal(result.attempts[0]?.answeringModel, answering);
      assert.ok(result.attempts[0].usage.outputTokens > 0, 'the usage was read');
    });
  }
});
