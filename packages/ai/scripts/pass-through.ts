// The Metis pass-through checks CS-43 listed (CS-45 #7; ADR-0021, the owner's decision of 2026-09-29), made through the
// layer: its providers, its settings and its calls, with a fetch that records each exchange and, where a check needs a
// parameter the SDK does not send, adds it to the request body. Run from an Iranian network; results go to results/.
//
//   pnpm --filter @carshenas/ai pass-through probe          prompt caching per route (the providers' own, Anthropic's
//                                                            cache_control at 5m and 1h, Metis's `cache` parameter),
//                                                            log-probabilities, Gemini's responseFormat, and batch
//   pnpm --filter @carshenas/ai pass-through latency        small calls per route: the time Metis adds to each answer
//   pnpm --filter @carshenas/ai pass-through bill-baseline  8 Claude calls on a long prefix, without cache_control
//   pnpm --filter @carshenas/ai pass-through bill-cached    the same 8 with cache_control: read the Metis dashboard
//                                                            before, between and after the two bill phases
//   pnpm --filter @carshenas/ai pass-through batch-status <openai batch id> <anthropic batch id>
import { createAi } from '../src/ai.ts';
import {
  anthropic,
  deepseek,
  google,
  METIS_BASE_URL,
  modelName,
  openai,
  type ModelChoice,
} from '../src/metis.ts';
import { createMetisPriceBook, METIS_PRICING_URL } from '../src/pricing.ts';
import { defineTask, type RegistryEntry, type TaskSettings } from '../src/task.ts';
import {
  checkGrounding,
  INSTRUCTIONS,
  ListingCondition,
  listingCondition,
  SAMPLES,
  type Sample,
} from '../src/test-support/listing-condition.ts';
import { recordingLogger } from '../src/test-support/recording-logger.ts';
import { metisKey, percentile, providerMs, recordingFetch, writeResults, type Exchange } from './support.ts';

type Body = Record<string, unknown>;

const [command = 'probe', ...rest] = process.argv.slice(2);
const key = metisKey();
const logger = recordingLogger();
const prices = createMetisPriceBook({ logger });
if (!(await prices.refresh())) console.log('Metis prices could not be loaded: costs will be null');

const TERMS = [
  ['«بی‌رنگ»', 'no paintwork at all', 'paint: none'],
  ['«لکه»', 'small spots of paint', 'paint: spots'],
  ['«تکه رنگ»', 'one repainted panel', 'paint: partial'],
  ['«گلگیر رنگ»', 'a repainted fender', 'paint: partial'],
  ['«تمام‌رنگ»', 'the whole body repainted', 'paint: full'],
  ['«مقطوع»', 'a fixed price', 'price_type: fixed'],
  ['«قابل مذاکره»', 'a price open to negotiation', 'price_type: negotiable'],
  ['«توافقی»', 'a price by agreement, with no figure', 'price_type: by_agreement'],
] as const;

/**
 * A stable prefix of about 8,000 tokens: the task's rules, then a glossary long enough to pass every family's caching
 * minimum (4,096 tokens for Claude Haiku 4.5). `variant` makes a prefix no earlier check has cached.
 */
function longTask(variant: string) {
  const glossary = Array.from({ length: 180 }, (_, index) => {
    const [term, meaning, value] = TERMS[index % TERMS.length] ?? TERMS[0];
    return `${index + 1}. ${term} means ${meaning}; report it as ${value}. Entry ${index + 1} of the ${variant} list keeps the stable prefix long enough to be cached.`;
  });
  return defineTask({
    name: 'probe.condition',
    instructions: `${INSTRUCTIONS}\n\nGlossary (${variant}):\n${glossary.join('\n')}`,
    schema: ListingCondition,
    render: (listing: Sample) => listing.text,
    checks: { version: 'grounding-1', run: (facts, listing) => checkGrounding(facts, listing.text) },
  });
}

type Check = {
  readonly name: string;
  readonly model: ModelChoice;
  readonly task?: ReturnType<typeof longTask>;
  readonly settings?: Partial<TaskSettings>;
  readonly calls?: number;
  readonly rewrite?: (body: Body) => Body;
  /** The request parameters to record from each exchange. */
  readonly sent?: (body: Body) => Body;
};

/** The usage block of a raw answer, whatever the route calls it, and the parts some checks look for. */
function rawAnswer(exchange: Exchange) {
  if (exchange.body === undefined) return {};
  let body: Body;
  try {
    body = JSON.parse(exchange.body) as Body;
  } catch {
    return { unparsed: exchange.body.slice(0, 300) };
  }
  const choice = Array.isArray(body.choices) ? (body.choices[0] as Body | undefined) : undefined;
  const candidate = Array.isArray(body.candidates) ? (body.candidates[0] as Body | undefined) : undefined;
  return {
    usage: body.usage ?? body.usageMetadata,
    ...(choice && 'logprobs' in choice ? { logprobs: choice.logprobs === null ? null : 'present' } : {}),
    ...(candidate && 'logprobsResult' in candidate ? { logprobsResult: 'present' } : {}),
    ...(exchange.status >= 400 ? { error: body } : {}),
  };
}

async function run(check: Check) {
  const network = recordingFetch({
    keepBodies: true,
    ...(check.rewrite && { rewrite: check.rewrite }),
    ...(check.sent && { sent: check.sent }),
  });
  const entry: RegistryEntry<Sample, ListingCondition> = {
    task: check.task ?? listingCondition,
    model: check.model,
    settings: { maxOutputTokens: 2048, timeoutMs: 90_000, maxReasks: 0, ...check.settings },
  };
  const ai = createAi({
    apiKey: key,
    registry: { [entry.task.name]: entry },
    logger,
    prices,
    fetch: network.fetch,
  });
  const calls = [];
  for (let index = 0; index < (check.calls ?? 2); index += 1) {
    const listing = SAMPLES[index % SAMPLES.length] ?? SAMPLES[0];
    if (!listing) throw new Error('no samples');
    try {
      const result = await ai.call(entry.task.name, listing);
      calls.push({
        outcome: result.outcome,
        answeringModel: result.attempts.at(-1)?.answeringModel,
        usage: result.attempts.at(-1)?.usage,
        latencyMs: result.attempts.at(-1)?.latencyMs,
      });
    } catch (error) {
      calls.push({ outcome: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }
  const exchanges = network.exchanges.map((exchange) => ({
    status: exchange.status,
    totalMs: exchange.totalMs,
    providerMs: providerMs(exchange.headers),
    ...(exchange.sent && { sent: exchange.sent }),
    ...rawAnswer(exchange),
  }));
  const costs = logger.lines
    .filter((line) => line.message === 'model call completed')
    .slice(-calls.length)
    .map((line) => line.fields.costUsd);
  const summary = { check: check.name, model: modelName(check.model), calls, exchanges, costs };
  console.log(
    `${check.name.padEnd(40)} ${calls.map((call) => call.outcome).join(',')}  ` +
      `cache read ${calls.map((call) => ('usage' in call ? call.usage?.cacheReadTokens : '-')).join('/')} ` +
      `write ${calls.map((call) => ('usage' in call ? call.usage?.cacheWriteTokens : '-')).join('/')}`,
  );
  return summary;
}

const withMetisCache = (body: Body): Body => ({ ...body, cache: { ttl: '5m' } });

/** Gemini's responseFormat in place of the responseMimeType and responseJsonSchema the SDK sends. */
function withResponseFormat(mimeType: string) {
  return (body: Body): Body => {
    const config = { ...(body.generationConfig as Body) };
    const schema = config.responseJsonSchema;
    delete config.responseJsonSchema;
    delete config.responseMimeType;
    return { ...body, generationConfig: { ...config, responseFormat: { text: { mimeType, schema } } } };
  };
}

const sentLogprobs = (body: Body): Body => ({
  model: body.model,
  logprobs: body.logprobs,
  top_logprobs: body.top_logprobs,
  reasoning_effort: body.reasoning_effort,
});
const sentResponseFormat = (body: Body): Body => ({
  generationConfig: Object.keys(body.generationConfig as Body),
  responseFormat: ((body.generationConfig as Body).responseFormat as Body | undefined)?.text,
});

function withGeminiLogprobs(body: Body): Body {
  return {
    ...body,
    generationConfig: { ...(body.generationConfig as Body), responseLogprobs: true, logprobs: 3 },
  };
}

async function metis(path: string, init: RequestInit & { anthropic?: boolean } = {}) {
  const headers = new Headers(init.headers);
  if (init.anthropic) {
    headers.set('x-api-key', key ?? '');
    headers.set('anthropic-version', '2023-06-01');
  } else headers.set('authorization', `Bearer ${key ?? ''}`);
  const started = performance.now();
  const response = await fetch(`${METIS_BASE_URL}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let body: unknown = text.slice(0, 2_000);
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    // kept as text
  }
  return { status: response.status, ms: Math.round(performance.now() - started), body };
}

const LUNA = openai('gpt-5.6-luna', { reasoningEffort: 'none' });
const HAIKU = anthropic('claude-haiku-4-5');
const FLASH_LITE = google('gemini-3.1-flash-lite');
const DEEPSEEK = deepseek('deepseek-v4-flash');

const BATCH_PROMPT = 'Answer with the JSON {"ok": true}.';

async function openaiBatch() {
  const line = (id: string) =>
    JSON.stringify({
      custom_id: id,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: LUNA.id,
        reasoning_effort: 'none',
        messages: [{ role: 'user', content: BATCH_PROMPT }],
      },
    });
  const form = new FormData();
  form.set('purpose', 'batch');
  form.set(
    'file',
    new Blob([`${line('r1')}\n${line('r2')}\n`], { type: 'application/jsonl' }),
    'cs45-probe.jsonl',
  );
  const file = await metis('/openai/v1/files', { method: 'POST', body: form });
  const fileId = (file.body as Body | undefined)?.id;
  if (typeof fileId !== 'string') return { file };
  const batch = await metis('/openai/v1/batches', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input_file_id: fileId,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
    }),
  });
  return { file: { status: file.status, id: fileId }, batch };
}

async function anthropicBatch() {
  const request = (id: string) => ({
    custom_id: id,
    params: {
      model: HAIKU.id,
      max_tokens: 50,
      messages: [{ role: 'user', content: BATCH_PROMPT }],
    },
  });
  return metis('/anthropic/v1/messages/batches', {
    method: 'POST',
    anthropic: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requests: [request('r1'), request('r2')] }),
  });
}

async function batchStatus(openaiId: string | undefined, anthropicId: string | undefined) {
  const openaiBatchNow = openaiId ? await metis(`/openai/v1/batches/${openaiId}`) : undefined;
  const outputFile = (openaiBatchNow?.body as Body | undefined)?.output_file_id;
  return {
    openai: openaiBatchNow,
    openaiOutput:
      typeof outputFile === 'string' ? await metis(`/openai/v1/files/${outputFile}/content`) : undefined,
    anthropic: anthropicId
      ? await metis(`/anthropic/v1/messages/batches/${anthropicId}`, { anthropic: true })
      : undefined,
    anthropicResults: anthropicId
      ? await metis(`/anthropic/v1/messages/batches/${anthropicId}/results`, { anthropic: true })
      : undefined,
  };
}

const results: Record<string, unknown> = { ranAt: new Date().toISOString(), command };

switch (command) {
  case 'probe': {
    const caching = [];
    caching.push(await run({ name: 'openai: automatic', model: LUNA, task: longTask('openai-auto') }));
    caching.push(
      await run({
        name: 'openai: prompt cache key',
        model: LUNA,
        task: longTask('openai-key'),
        settings: { promptCache: '5m' },
      }),
    );
    caching.push(
      await run({
        name: "openai: Metis's cache parameter",
        model: LUNA,
        task: longTask('openai-metis'),
        rewrite: withMetisCache,
      }),
    );
    caching.push(
      await run({
        name: 'anthropic: cache_control 5m',
        model: HAIKU,
        task: longTask('anthropic-5m'),
        settings: { promptCache: '5m' },
      }),
    );
    caching.push(
      await run({
        name: 'anthropic: cache_control 1h',
        model: HAIKU,
        task: longTask('anthropic-1h'),
        settings: { promptCache: '1h' },
      }),
    );
    caching.push(
      await run({
        name: "anthropic: Metis's cache parameter",
        model: HAIKU,
        task: longTask('anthropic-metis'),
        rewrite: withMetisCache,
      }),
    );
    caching.push(await run({ name: 'google: implicit', model: FLASH_LITE, task: longTask('google-auto') }));
    caching.push(
      await run({
        name: "google: Metis's cache parameter",
        model: FLASH_LITE,
        task: longTask('google-metis'),
        rewrite: withMetisCache,
      }),
    );
    caching.push(
      await run({ name: 'deepseek: automatic', model: DEEPSEEK, task: longTask('deepseek-auto') }),
    );
    caching.push(
      await run({
        name: "deepseek: Metis's cache parameter",
        model: DEEPSEEK,
        task: longTask('deepseek-metis'),
        rewrite: withMetisCache,
      }),
    );
    results.caching = caching;
    results.logprobs = [
      await run({
        name: 'openai gpt-5.6-luna: logprobs',
        model: openai('gpt-5.6-luna', { reasoningEffort: 'none', logprobs: 3 }),
        calls: 1,
      }),
      await run({
        name: 'openai gpt-5.4-nano: logprobs',
        model: openai('gpt-5.4-nano', { logprobs: 3 }),
        calls: 1,
      }),
      await run({
        name: 'google: responseLogprobs',
        model: FLASH_LITE,
        rewrite: withGeminiLogprobs,
        calls: 1,
      }),
    ];
    results.responseFormat = await run({
      name: 'google: responseFormat',
      model: FLASH_LITE,
      rewrite: withResponseFormat('application/json'),
      calls: 3,
    });
    results.batch = { openai: await openaiBatch(), anthropic: await anthropicBatch() };
    console.log('batch', JSON.stringify(results.batch).slice(0, 600));
    break;
  }
  case 'recheck': {
    // What the probe left open: which log-probability requests were sent as asked, and which value of Gemini's
    // TextResponseFormat.MimeType enum the API takes (it refused "application/json"); the first accepted value stops.
    results.logprobs = [
      await run({
        name: 'openai gpt-5.6-luna, effort none: logprobs',
        model: openai('gpt-5.6-luna', { reasoningEffort: 'none', logprobs: 3 }),
        calls: 1,
        sent: sentLogprobs,
      }),
      await run({
        name: 'openai gpt-5.4-nano, default effort: logprobs',
        model: openai('gpt-5.4-nano', { logprobs: 3 }),
        calls: 1,
        sent: sentLogprobs,
      }),
      await run({
        name: 'openai gpt-5.4-nano, effort none: logprobs',
        model: openai('gpt-5.4-nano', { reasoningEffort: 'none', logprobs: 3 }),
        calls: 1,
        sent: sentLogprobs,
      }),
    ];
    const formats = [];
    for (const mimeType of ['APPLICATION_JSON', 'JSON', 'TEXT_MIME_TYPE_JSON']) {
      const outcome = await run({
        name: `google: responseFormat ${mimeType}`,
        model: FLASH_LITE,
        rewrite: withResponseFormat(mimeType),
        sent: sentResponseFormat,
        calls: 3,
      });
      formats.push(outcome);
      if (outcome.calls.some((call) => call.outcome !== 'error')) break;
    }
    results.responseFormat = formats;
    break;
  }
  case 'latency': {
    const perRoute = [];
    for (const [route, model] of [
      ['openai', openai('gpt-5.6-luna', { reasoningEffort: 'low' })],
      ['anthropic', HAIKU],
      ['google', FLASH_LITE],
      ['deepseek', DEEPSEEK],
    ] as const) {
      const outcome = await run({ name: `latency: ${route}`, model, calls: 15 });
      const totals = outcome.exchanges.map((exchange) => exchange.totalMs);
      const added = outcome.exchanges.flatMap((exchange) =>
        exchange.providerMs === undefined ? [] : [exchange.totalMs - exchange.providerMs],
      );
      perRoute.push({
        route,
        totalMs: { p50: percentile(totals, 0.5), p95: percentile(totals, 0.95), max: Math.max(...totals) },
        addedMs:
          added.length === 0
            ? 'the provider reports no processing time on this route'
            : {
                p50: percentile(added, 0.5),
                p95: percentile(added, 0.95),
                max: Math.max(...added),
                n: added.length,
              },
        outcome,
      });
      console.log(route, JSON.stringify(perRoute.at(-1)?.totalMs), JSON.stringify(perRoute.at(-1)?.addedMs));
    }
    // Requests Metis answers itself: its model list and its price list.
    const local = [];
    for (let index = 0; index < 10; index += 1) local.push((await metis('/openai/v1/models')).ms);
    const pricing = [];
    for (let index = 0; index < 10; index += 1) {
      const started = performance.now();
      await (await fetch(METIS_PRICING_URL)).text();
      pricing.push(Math.round(performance.now() - started));
    }
    results.latency = {
      perRoute,
      metisOwn: {
        models: { p50: percentile(local, 0.5), p95: percentile(local, 0.95), samples: local },
        pricing: { p50: percentile(pricing, 0.5), p95: percentile(pricing, 0.95), samples: pricing },
      },
    };
    console.log('metis own', JSON.stringify(results.latency));
    break;
  }
  case 'bill-baseline':
  case 'bill-cached': {
    const cached = command === 'bill-cached';
    const outcome = await run({
      name: command,
      model: HAIKU,
      task: longTask(`${command}-${new Date().toISOString().slice(0, 16)}`),
      calls: 8,
      settings: { maxOutputTokens: 300, ...(cached ? { promptCache: '5m' as const } : {}) },
    });
    const rates = prices.pricesOf('claude-haiku-4-5');
    const documented = outcome.costs.reduce<number>(
      (sum, cost) => sum + (typeof cost === 'number' ? cost : 0),
      0,
    );
    const undiscounted = outcome.calls.reduce((sum, call) => {
      if (!('usage' in call) || !call.usage || !rates?.input_token || !rates.output_token) return sum;
      const input = call.usage.inputTokens + call.usage.cacheReadTokens + call.usage.cacheWriteTokens;
      return sum + input * rates.input_token + call.usage.outputTokens * rates.output_token;
    }, 0);
    results.bill = {
      outcome,
      expectedUsd: { asDocumented: documented, withoutCacheDiscounts: undiscounted },
    };
    console.log(
      `expected US$ as documented ${documented.toFixed(6)}, without cache discounts ${undiscounted.toFixed(6)}`,
    );
    break;
  }
  case 'batch-status': {
    results.batchStatus = await batchStatus(rest[0], rest[1]);
    console.log(JSON.stringify(results.batchStatus).slice(0, 1500));
    break;
  }
  default:
    throw new Error(`unknown command ${command}: probe, latency, bill-baseline, bill-cached or batch-status`);
}

results.lines = logger.lines
  .filter((line) => line.message === 'model call completed')
  .map((line) => line.fields);
console.log(`wrote ${writeResults(`pass-through-${command}`, results)}`);
