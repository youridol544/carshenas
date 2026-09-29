// Calls models through Metis with one structured-output task and records, per call, whether the answer is valid
// against the schema, how long it took, what it used and what it cost at Metis's list price. Also calls TypeSafe's
// jev on the same texts, two embedding endpoints, and the error answers. Runs one call at a time.
//
//   node probe.mjs                  every target, RUNS=2 runs of each sample
//   RUNS=1 ONLY=openai,jev node probe.mjs
import {
  listingJsonSchema,
  JEV_QUESTIONS,
  PROMPT_VERSION,
  SAMPLES,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_WITH_SCHEMA,
  fieldMatches,
  parseListing,
} from './listing.mjs';
import { listPriceUsd, loadCatalogue, median, METIS, metisKey, timedJson, writeResults } from './lib.mjs';

const key = metisKey();
const RUNS = Number(process.env.RUNS ?? 2);
const ONLY = process.env.ONLY?.split(',');
const bearer = { authorization: `Bearer ${key}` };
const openAiFormat = { type: 'json_schema', json_schema: { name: 'listing_facts', strict: true, schema: listingJsonSchema } };

// Each target builds its request and reads the text, usage, model and stop reason back from its own format.
const TARGETS = [
  {
    id: 'openai',
    route: '/openai/v1/chat/completions',
    format: 'OpenAI Chat Completions, response_format json_schema strict',
    model: 'gpt-5.6-luna',
    catalogueId: 'gpt-5.6-luna',
    runs: RUNS,
    request: (text) => ({
      url: `${METIS}/openai/v1/chat/completions`,
      headers: bearer,
      body: {
        model: 'gpt-5.6-luna',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: openAiFormat,
        reasoning_effort: 'low',
        max_completion_tokens: 4096,
      },
    }),
    read: readChatCompletion,
  },
  {
    id: 'anthropic',
    route: '/anthropic/v1/messages',
    format: 'Anthropic Messages, output_config.format json_schema',
    model: 'claude-haiku-4-5',
    catalogueId: 'claude-haiku-4.5',
    runs: RUNS,
    request: (text, auth) => ({
      url: `${METIS}/anthropic/v1/messages`,
      headers: { ...(auth === 'bearer' ? bearer : { 'x-api-key': key }), 'anthropic-version': '2023-06-01' },
      body: {
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
        output_config: { format: { type: 'json_schema', schema: listingJsonSchema } },
      },
    }),
    read: (json) => ({
      text: json?.content?.find((block) => block.type === 'text')?.text,
      inputTokens: json?.usage?.input_tokens,
      outputTokens: json?.usage?.output_tokens,
      model: json?.model,
      stop: json?.stop_reason,
    }),
  },
  {
    id: 'gemini',
    route: '/v1beta/models/{model}:generateContent',
    format: 'Gemini generateContent, responseMimeType application/json with responseJsonSchema',
    model: 'gemini-3.1-flash-lite',
    catalogueId: 'gemini-3.1-flash-lite',
    runs: RUNS,
    request: (text) => ({
      url: `${METIS}/v1beta/models/gemini-3.1-flash-lite:generateContent`,
      headers: { 'x-goog-api-key': key },
      body: {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: listingJsonSchema,
          maxOutputTokens: 4096,
        },
      },
    }),
    read: (json) => ({
      text: json?.candidates?.[0]?.content?.parts
        ?.filter((part) => typeof part.text === 'string' && !part.thought)
        .map((part) => part.text)
        .join(''),
      inputTokens: json?.usageMetadata?.promptTokenCount,
      // Thinking is billed as output.
      outputTokens: (json?.usageMetadata?.candidatesTokenCount ?? 0) + (json?.usageMetadata?.thoughtsTokenCount ?? 0),
      model: json?.modelVersion,
      stop: json?.candidates?.[0]?.finishReason,
    }),
  },
  {
    id: 'deepseek',
    route: '/deepseek/v1/chat/completions',
    format: 'OpenAI Chat Completions on the DeepSeek route, response_format json_schema strict',
    model: 'deepseek-v4-flash',
    catalogueId: 'deepseek-v4-flash',
    runs: RUNS,
    // DeepSeek's own JSON mode, with the schema in the prompt, when json_schema is refused.
    fallback: 'json_object',
    request: (text, variant) => ({
      url: `${METIS}/deepseek/v1/chat/completions`,
      headers: bearer,
      body: {
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: variant === 'json_object' ? SYSTEM_PROMPT_WITH_SCHEMA : SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: variant === 'json_object' ? { type: 'json_object' } : openAiFormat,
        max_tokens: 2048,
      },
    }),
    read: readChatCompletion,
  },
  {
    id: 'metis-gpt',
    route: '/api/v1/wrapper/metis/chat/completions',
    format: 'OpenAI Chat Completions; no structured-output parameter, the schema is in the prompt',
    model: 'metis-gpt',
    catalogueId: 'metis-gpt',
    runs: RUNS,
    request: (text) => ({
      url: `${METIS}/api/v1/wrapper/metis/chat/completions`,
      headers: bearer,
      body: {
        model: 'metis-gpt',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_WITH_SCHEMA },
          { role: 'user', content: text },
        ],
        // The model refuses max_tokens ("Use 'max_completion_tokens' instead"), as OpenAI's reasoning models do.
        max_completion_tokens: 4096,
      },
    }),
    read: readChatCompletion,
  },
  openAiFormatWrapper({
    id: 'anthropic-openai-format',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    catalogueId: 'claude-haiku-4.5',
    documented: true,
  }),
  openAiFormatWrapper({
    id: 'google-openai-format',
    provider: 'google',
    model: 'gemini-3.1-flash-lite',
    catalogueId: 'gemini-3.1-flash-lite',
    documented: false,
  }),
  // Gemma 3 27B served by Sotoon, an Iranian cloud, as /api/v1/meta lists it; not in the priced catalogue.
  openAiFormatWrapper({
    id: 'sotoon-gemma',
    provider: 'sotoon',
    model: 'google/gemma3-27b',
    catalogueId: null,
    documented: false,
    runs: RUNS,
  }),
];

/** Metis's OpenAI-format route to another provider: json_schema first, then the schema in the prompt. */
function openAiFormatWrapper({ id, provider, model, catalogueId, documented, runs = 1 }) {
  return {
    id,
    route: `/api/v1/wrapper/${provider}/chat/completions`,
    format: `OpenAI Chat Completions to a ${provider} model${documented ? '' : ' (route not documented)'}, response_format json_schema strict`,
    model,
    catalogueId,
    runs,
    fallback: 'prompt-json',
    request: (text, variant) => ({
      url: `${METIS}/api/v1/wrapper/${provider}/chat/completions`,
      headers: bearer,
      body: {
        model,
        messages: [
          { role: 'system', content: variant === 'prompt-json' ? SYSTEM_PROMPT_WITH_SCHEMA : SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        ...(variant === 'prompt-json' ? {} : { response_format: openAiFormat }),
        max_tokens: 4096,
      },
    }),
    read: readChatCompletion,
  };
}

function readChatCompletion(json) {
  return {
    text: json?.choices?.[0]?.message?.content,
    inputTokens: json?.usage?.prompt_tokens,
    outputTokens: json?.usage?.completion_tokens,
    reasoningTokens: json?.usage?.completion_tokens_details?.reasoning_tokens,
    model: json?.model,
    stop: json?.choices?.[0]?.finish_reason,
    usageExtra: pickUnusualUsage(json?.usage),
  };
}

// Any usage field beyond the standard token counts (a cost or credit figure would appear here).
function pickUnusualUsage(usage) {
  if (!usage || typeof usage !== 'object') return undefined;
  const standard = new Set([
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
    'prompt_tokens_details',
    'completion_tokens_details',
  ]);
  const extra = Object.fromEntries(Object.entries(usage).filter(([name]) => !standard.has(name)));
  return Object.keys(extra).length ? extra : undefined;
}

const catalogue = await loadCatalogue();
const results = {
  ranAt: new Date().toISOString(),
  promptVersion: PROMPT_VERSION,
  runsPerSample: RUNS,
  catalogue: { lastModified: catalogue.lastModified, fetchedAt: catalogue.fetchedAt },
  structured: {},
  jev: [],
  embeddings: [],
  errors: [],
};

for (const target of TARGETS) {
  if (ONLY && !ONLY.includes(target.id)) continue;
  const price = catalogue.byId.get(target.catalogueId);
  const calls = [];
  let variant; // the auth or response-format variant that worked for this target
  for (const sample of SAMPLES) {
    for (let run = 1; run <= target.runs; run += 1) {
      let answer = await timedJson(...asArgs(target.request(sample.text, variant)));
      // One retry with the documented alternative, recorded, when the first form is refused.
      if (variant === undefined && target.id === 'anthropic' && (answer.status === 401 || answer.status === 403)) {
        variant = 'bearer';
        answer = await timedJson(...asArgs(target.request(sample.text, variant)));
      }
      if (variant === undefined && target.fallback && answer.status === 400) {
        calls.push(summarise(target, sample, run, answer, price, 'json_schema refused'));
        variant = target.fallback;
        answer = await timedJson(...asArgs(target.request(sample.text, variant)));
      }
      if (variant === undefined) variant = null;
      calls.push(summarise(target, sample, run, answer, price, variant ?? undefined, calls.length === 0));
      const last = calls.at(-1);
      console.log(
        `${target.id.padEnd(24)} ${sample.id.padEnd(28)} run ${run}  ${String(last.status).padEnd(3)} ${String(last.latencyMs).padStart(6)} ms  ${last.valid ? 'valid  ' : 'INVALID'} ${last.matches ? `${last.matches.right}/${last.matches.of}` : '   '}  ${last.costUsd === null ? '' : `$${last.costUsd.toFixed(6)}`}${last.error ? `  ${String(last.error).slice(0, 90)}` : ''}`,
      );
    }
  }
  results.structured[target.id] = {
    route: target.route,
    format: target.format,
    model: target.model,
    variant: variant ?? null,
    listPrice: price ? { input: price.input_price, output: price.output_price, unit: price.price_unit } : null,
    calls,
    summary: summariseTarget(calls),
  };
}

// TypeSafe System One (jev): probabilities for the same listings.
if (!ONLY || ONLY.includes('jev')) {
  for (const sample of SAMPLES) {
    for (let run = 1; run <= RUNS; run += 1) {
      const answer = await timedJson(`${METIS}/typesafe/v1/systemone`, {
        headers: bearer,
        body: { state: sample.text, model: 'jev-latest', questions: JEV_QUESTIONS },
      });
      const answers = answer.json?.answers;
      const verdict = answers ? jevVerdict(answers, sample.jev) : null;
      results.jev.push({
        sample: sample.id,
        run,
        status: answer.status,
        latencyMs: answer.latencyMs,
        model: answer.json?.model,
        usage: answer.json?.usage,
        answers,
        verdict,
        ...(answers ? {} : { body: answer.json ?? answer.text ?? answer.error }),
        ...(run === 1 && sample === SAMPLES[0] ? { headers: answer.headers } : {}),
      });
      console.log(
        `${'jev'.padEnd(24)} ${sample.id.padEnd(28)} run ${run}  ${answer.status} ${String(answer.latencyMs).padStart(6)} ms  ${verdict ? `${verdict.right}/${verdict.of} as expected` : JSON.stringify(answer.json ?? answer.text).slice(0, 120)}`,
      );
    }
  }
}

// Embeddings: the OpenAI-compatible route (OpenAI models only) and Metis's own route (any provider).
if (!ONLY || ONLY.includes('embeddings')) {
  const texts = ['پژو ۲۰۶ تیپ ۵ مدل ۱۳۹۸ بی‌رنگ', 'تویوتا کمری هیبرید ۲۰۱۶ دو لکه رنگ'];
  const embeddingCalls = [
    {
      id: 'openai-route',
      url: `${METIS}/openai/v1/embeddings`,
      body: { model: 'text-embedding-3-small', input: texts },
    },
    {
      id: 'metis-route',
      url: `${METIS}/api/v1/embeddings`,
      body: { model: { name: 'jina', model: 'jina-embeddings-v3' }, input: texts },
    },
  ];
  for (const call of embeddingCalls) {
    const answer = await timedJson(call.url, { headers: bearer, body: call.body });
    const vectors = answer.json?.data;
    results.embeddings.push({
      id: call.id,
      path: new URL(call.url).pathname,
      model: answer.json?.model ?? call.body.model,
      status: answer.status,
      latencyMs: answer.latencyMs,
      vectors: vectors?.length ?? 0,
      dimensions: vectors?.[0]?.embedding?.length ?? null,
      usage: answer.json?.usage,
      ...(vectors ? {} : { body: answer.json ?? answer.text ?? answer.error }),
    });
    console.log(
      `${'embeddings'.padEnd(24)} ${call.id.padEnd(28)}        ${answer.status} ${String(answer.latencyMs).padStart(6)} ms  ${vectors ? `${vectors.length} vectors of ${vectors[0]?.embedding?.length}` : JSON.stringify(answer.json ?? answer.text).slice(0, 120)}`,
    );
  }
}

// What failure looks like: an unknown model, no key, a wrong key. None of these is billed.
if (!ONLY || ONLY.includes('errors')) {
  const minimal = { messages: [{ role: 'user', content: 'سلام' }], max_completion_tokens: 16 };
  const errorCalls = [
    { id: 'unknown model', headers: bearer, body: { ...minimal, model: 'no-such-model' } },
    { id: 'no key', headers: {}, body: { ...minimal, model: 'gpt-5.6-luna' } },
    { id: 'wrong key', headers: { authorization: 'Bearer tpsg-not-a-real-key' }, body: { ...minimal, model: 'gpt-5.6-luna' } },
  ];
  for (const call of errorCalls) {
    const answer = await timedJson(`${METIS}/openai/v1/chat/completions`, { headers: call.headers, body: call.body });
    results.errors.push({ id: call.id, status: answer.status, latencyMs: answer.latencyMs, body: answer.json ?? answer.text ?? answer.error });
    console.log(`${'errors'.padEnd(24)} ${call.id.padEnd(28)}        ${answer.status}  ${JSON.stringify(answer.json ?? answer.text).slice(0, 140)}`);
  }
}

console.log(`\nwrote ${writeResults('probe', results)}`);

function asArgs({ url, headers, body }) {
  return [url, { headers, body }];
}

function summarise(target, sample, run, answer, price, variant, keepHeaders = false) {
  const read = answer.json ? target.read(answer.json) : {};
  const parsed = answer.status === 200 ? parseListing(read.text) : { valid: false };
  const costUsd =
    typeof read.inputTokens === 'number' && typeof read.outputTokens === 'number'
      ? listPriceUsd(price, read.inputTokens, read.outputTokens)
      : null;
  return {
    sample: sample.id,
    run,
    ...(variant ? { variant } : {}),
    status: answer.status,
    latencyMs: answer.latencyMs,
    model: read.model,
    stop: read.stop,
    inputTokens: read.inputTokens,
    outputTokens: read.outputTokens,
    reasoningTokens: read.reasoningTokens,
    usageExtra: read.usageExtra,
    costUsd,
    valid: parsed.valid,
    fenced: parsed.fenced,
    matches: parsed.valid ? fieldMatches(parsed.data, sample.expected) : null,
    answer: parsed.data,
    error: parsed.valid ? undefined : (parsed.error ?? errorText(answer)),
    ...(keepHeaders ? { headers: answer.headers } : {}),
  };
}

function errorText(answer) {
  if (answer.error) return answer.error;
  const body = answer.json ?? answer.text;
  return typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300);
}

function summariseTarget(calls) {
  const answered = calls.filter((call) => call.status === 200);
  const valid = answered.filter((call) => call.valid);
  const matched = valid.map((call) => call.matches.right);
  return {
    calls: calls.length,
    answered: answered.length,
    valid: valid.length,
    medianLatencyMs: median(answered.map((call) => call.latencyMs)),
    maxLatencyMs: answered.length ? Math.max(...answered.map((call) => call.latencyMs)) : null,
    medianInputTokens: median(answered.map((call) => call.inputTokens)),
    medianOutputTokens: median(answered.map((call) => call.outputTokens)),
    medianCostUsd: median(answered.map((call) => call.costUsd)),
    costPerThousandCallsUsd: (() => {
      const cost = median(answered.map((call) => call.costUsd));
      return cost === null ? null : Number((cost * 1000).toFixed(4));
    })(),
    fieldsRight: matched.length ? `${matched.reduce((sum, value) => sum + value, 0)}/${valid.length * 9}` : null,
    modelsAnswering: [...new Set(answered.map((call) => call.model))],
  };
}

function jevVerdict(answers, expected) {
  const checks = {
    paint: answers.paint?.choice === expected.paint,
    price_negotiable: answers.price_negotiable?.noul > 0.5 === expected.price_negotiable,
    states_price: answers.states_price?.noul > 0.5 === expected.states_price,
    jalali_year: answers.jalali_year?.noul > 0.5 === expected.jalali_year,
  };
  const wrong = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  return { right: 4 - wrong.length, of: 4, wrong };
}
