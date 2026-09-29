// Do the providers' official SDKs work against Metis by changing only the base URL and the key? One structured
// call each, on the first sample, validated with the same zod schema as the probe.
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { listingJsonSchema, SAMPLES, SYSTEM_PROMPT, fieldMatches, parseListing } from './listing.mjs';
import { METIS, metisKey, writeResults } from './lib.mjs';

const key = metisKey();
const sample = SAMPLES[0];
const results = { ranAt: new Date().toISOString(), sample: sample.id, checks: [] };

async function check(name, settings, call) {
  const started = performance.now();
  try {
    const { text, model } = await call();
    const parsed = parseListing(text);
    const entry = {
      sdk: name,
      ...settings,
      ok: parsed.valid,
      latencyMs: Math.round(performance.now() - started),
      model,
      matches: parsed.valid ? fieldMatches(parsed.data, sample.expected) : null,
      ...(parsed.valid ? {} : { error: parsed.error }),
    };
    results.checks.push(entry);
    console.log(`${name.padEnd(30)} ${entry.ok ? 'valid' : 'INVALID'}  ${String(entry.latencyMs).padStart(5)} ms  ${model ?? ''}  ${entry.matches ? `${entry.matches.right}/${entry.matches.of}` : entry.error ?? ''}`);
  } catch (error) {
    const entry = {
      sdk: name,
      ...settings,
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: `${error?.constructor?.name ?? 'Error'} ${error?.status ?? ''}: ${String(error?.message ?? error).slice(0, 300)}`,
    };
    results.checks.push(entry);
    console.log(`${name.padEnd(30)} FAILED ${entry.error}`);
  }
}

// OpenAI's SDK on the OpenAI route.
const openai = new OpenAI({ apiKey: key, baseURL: `${METIS}/openai/v1` });
await check('openai 7.23.0', { baseURL: `${METIS}/openai/v1`, auth: 'apiKey (Bearer)' }, async () => {
  const completion = await openai.chat.completions.create({
    model: 'gpt-5.6-luna',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: sample.text },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'listing_facts', strict: true, schema: listingJsonSchema } },
    reasoning_effort: 'low',
    max_completion_tokens: 4096,
  });
  return { text: completion.choices[0]?.message?.content, model: completion.model };
});

// OpenAI's SDK on the DeepSeek route, in DeepSeek's JSON mode (json_schema is refused there).
const deepseek = new OpenAI({ apiKey: key, baseURL: `${METIS}/deepseek/v1` });
await check('openai 7.23.0 -> deepseek', { baseURL: `${METIS}/deepseek/v1`, auth: 'apiKey (Bearer)' }, async () => {
  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\nAnswer with one JSON object following this JSON Schema:\n${JSON.stringify(listingJsonSchema)}` },
      { role: 'user', content: sample.text },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2048,
  });
  return { text: completion.choices[0]?.message?.content, model: completion.model };
});

// Anthropic's SDK on the Anthropic route: first with apiKey (x-api-key), then with authToken (Bearer), as Claude Code
// sends it.
for (const auth of ['apiKey', 'authToken']) {
  const anthropic = new Anthropic({
    baseURL: `${METIS}/anthropic`,
    ...(auth === 'apiKey' ? { apiKey: key } : { apiKey: null, authToken: key }),
  });
  await check(`@anthropic-ai/sdk 0.129.0 ${auth}`, { baseURL: `${METIS}/anthropic`, auth }, async () => {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: sample.text }],
      output_config: { format: { type: 'json_schema', schema: listingJsonSchema } },
    });
    const text = message.content.find((block) => block.type === 'text')?.text;
    return { text, model: message.model };
  });
}

// Google's SDK on the Gemini route.
const google = new GoogleGenAI({ apiKey: key, httpOptions: { baseUrl: METIS } });
await check('@google/genai 2.24.0', { baseUrl: METIS, auth: 'apiKey (x-goog-api-key)' }, async () => {
  const response = await google.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: sample.text,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseJsonSchema: listingJsonSchema,
      maxOutputTokens: 4096,
    },
  });
  return { text: response.text, model: response.modelVersion };
});

console.log(`\nwrote ${writeResults('sdk', results)}`);
