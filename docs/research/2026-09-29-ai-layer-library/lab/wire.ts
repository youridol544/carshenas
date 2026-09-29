// What the AI SDK's provider packages put on the wire to Metis's native routes, and how each one reports a refusal, a
// truncated answer and an empty answer, with no network and no key: `fetch` is a stub that records the request and
// answers with a canned reply in the provider's own format. Run with `npm run wire`.
import { networkSeen } from './netwatch.ts';
import { generateChecked } from './reask.ts';
import { checkGrounding, INSTRUCTIONS, ListingFacts, SAMPLES } from './listing.ts';
import { metisRoutes, openaiResponsesModel, summariseRequest } from './providers.ts';
import { writeResults } from './results.ts';

const sample = SAMPLES.find((candidate) => candidate.id === 'peugeot-206-jalali')!;
const zwnj = String.fromCodePoint(0x200c);
const validAnswer = JSON.stringify({
  paint_evidence: ['بی', 'رنگ'].join(zwnj),
  paint: 'none',
  price_evidence: 'کمی قابل مذاکره',
  price_type: 'negotiable',
  instructions_to_ai: false,
});
const cutAnswer = validAnswer.slice(0, 40);

type Case = 'valid' | 'refusal' | 'truncated' | 'empty';

// Canned replies in each provider's own response format.
const openaiChat = (content: string | null, finish: string, refusal?: string) => ({
  id: 'chatcmpl-wire',
  object: 'chat.completion',
  created: 1_790_000_000,
  model: 'gpt-5.6-luna-2026-07-09',
  choices: [{ index: 0, message: { role: 'assistant', content, ...(refusal ? { refusal } : {}) }, finish_reason: finish }],
  usage: {
    prompt_tokens: 700,
    completion_tokens: 93,
    total_tokens: 793,
    prompt_tokens_details: { cached_tokens: 512 },
    completion_tokens_details: { reasoning_tokens: 30 },
  },
});
const anthropicMessage = (text: string | null, stop: string) => ({
  id: 'msg_wire',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-4-5-20251001',
  content: text === null ? [] : [{ type: 'text', text }],
  stop_reason: stop,
  stop_sequence: null,
  usage: { input_tokens: 1368, output_tokens: 119, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
});
const geminiResponse = (text: string | null, finish: string) => ({
  candidates: [{ content: { role: 'model', parts: text === null ? [] : [{ text }] }, finishReason: finish, index: 0 }],
  usageMetadata: { promptTokenCount: 313, candidatesTokenCount: 166, totalTokenCount: 479 },
  modelVersion: 'gemini-3.1-flash-lite',
  responseId: 'wire',
});

const CANNED: Record<string, Partial<Record<Case, unknown>>> = {
  'openai-chat': {
    valid: openaiChat(validAnswer, 'stop'),
    refusal: openaiChat(null, 'stop', 'I cannot help with that request.'),
    truncated: openaiChat(cutAnswer, 'length'),
    empty: openaiChat('', 'stop'),
  },
  anthropic: {
    valid: anthropicMessage(validAnswer, 'end_turn'),
    refusal: anthropicMessage(null, 'refusal'),
    truncated: anthropicMessage(cutAnswer, 'max_tokens'),
    empty: anthropicMessage(null, 'end_turn'),
  },
  gemini: {
    valid: geminiResponse(validAnswer, 'STOP'),
    refusal: geminiResponse(null, 'SAFETY'),
    truncated: geminiResponse(cutAnswer, 'MAX_TOKENS'),
    empty: geminiResponse(null, 'STOP'),
  },
  deepseek: {
    valid: { ...openaiChat(validAnswer, 'stop'), model: 'deepseek-v4-flash' },
    truncated: { ...openaiChat(cutAnswer, 'length'), model: 'deepseek-v4-flash' },
    empty: { ...openaiChat('', 'stop'), model: 'deepseek-v4-flash' },
  },
};

const results: Record<string, unknown> = {
  ranAt: new Date().toISOString(),
  sample: sample.id,
  note: 'No network and no key: fetch is a stub. The requests are what the AI SDK would send to Metis.',
  routes: [] as unknown[],
};

for (const routeId of Object.keys(CANNED)) {
  const route = { requests: [] as unknown[], outcomes: {} as Record<string, unknown> };
  for (const [caseName, reply] of Object.entries(CANNED[routeId]!)) {
    const stub: typeof fetch = async (input, init) => {
      if (caseName === 'valid') route.requests.push(summariseRequest(input, init));
      return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const target = metisRoutes('wire-check-no-key', stub).find((candidate) => candidate.id === routeId)!;
    try {
      const outcome = await generateChecked({
        model: target.model,
        instructions: INSTRUCTIONS,
        input: sample.text,
        schema: ListingFacts,
        check: (facts) => checkGrounding(facts, sample.text),
        maxReasks: 0,
        maxOutputTokens: target.maxOutputTokens,
        ...(target.providerOptions ? { providerOptions: target.providerOptions } : {}),
      });
      const [attempt] = outcome.attempts;
      route.outcomes[caseName] = {
        outcome: outcome.kind,
        finishReason: attempt?.finishReason,
        rawFinishReason: attempt?.rawFinishReason,
        answeringModel: attempt?.answeringModel,
        usage: caseName === 'valid' ? attempt?.usage : undefined,
      };
    } catch (error) {
      route.outcomes[caseName] = { threw: `${(error as Error).name}: ${(error as Error).message}`.slice(0, 300) };
    }
  }
  (results.routes as unknown[]).push({ id: routeId, ...route });
  console.log(
    routeId.padEnd(12),
    JSON.stringify(Object.fromEntries(Object.entries(route.outcomes).map(([name, value]) => [name, (value as { outcome?: string }).outcome ?? value]))),
  );
}

// The provider's default for OpenAI is the Responses API: record where it would go, then stop.
const responsesRequests: unknown[] = [];
const refuse: typeof fetch = async (input, init) => {
  responsesRequests.push(summariseRequest(input, init));
  return new Response(JSON.stringify({ error: { message: 'wire check: not sent' } }), { status: 400 });
};
await generateChecked({
  model: openaiResponsesModel('wire-check-no-key', refuse),
  instructions: INSTRUCTIONS,
  input: sample.text,
  schema: ListingFacts,
  maxReasks: 0,
}).catch((error: Error) => error.name);
results.openaiDefaultModel = responsesRequests;

// Nothing reached the network: every request above went to the stub, and the SDK made none of its own.
results.networkRequestsSeen = networkSeen;
console.log(`network requests seen: ${networkSeen.length}`);

console.log(`\nwrote ${writeResults('wire', results)}`);
