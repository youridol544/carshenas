// Shared by the CS-42 lab scripts: the Metis key from the repository's .env, timed JSON requests that never record
// what was sent, list prices from Metis's published catalogue, and result files.
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const METIS = 'https://api.metisai.ir';
export const CATALOGUE_URL = 'https://www.metisai.ir/models.json';

/** The key, or a clear stop. It is only ever placed in request headers, never in output. */
export function metisKey() {
  const key = process.env.METIS_API_KEY;
  if (!key) {
    console.error('METIS_API_KEY is missing: add it to the repository .env, which git ignores.');
    process.exit(1);
  }
  return key;
}

// Response headers worth keeping: rate limits, retries, request ids, cost or credit, and who answered. Cookies are
// never kept.
const KEPT_HEADER = /ratelimit|rate-limit|retry-after|request-id|x-request|cost|credit|balance|usage|quota|server|via|x-cache|cf-ray|model|processing|upstream/i;

export function keptHeaders(headers) {
  const kept = {};
  for (const [name, value] of headers) {
    if (name === 'set-cookie') continue;
    if (KEPT_HEADER.test(name)) kept[name] = value;
  }
  return kept;
}

/** One request, timed from send to the last byte of the answer. The request itself is not returned. */
export async function timedJson(url, { method = 'POST', headers = {}, body } = {}) {
  const started = performance.now();
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    return { status: 0, latencyMs: Math.round(performance.now() - started), error: String(error?.cause ?? error) };
  }
  const text = await response.text();
  const latencyMs = Math.round(performance.now() - started);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return {
    status: response.status,
    latencyMs,
    headers: keptHeaders(response.headers),
    ...(json === undefined ? { text: text.slice(0, 800) } : { json }),
  };
}

/** Metis's published catalogue: prices in US dollars per million tokens (or per call), keyed by Metis's model id. */
export async function loadCatalogue() {
  const response = await fetch(CATALOGUE_URL, { signal: AbortSignal.timeout(60_000) });
  const models = await response.json();
  const byId = new Map();
  for (const model of models) {
    if (!byId.has(model.metis_model_id)) byId.set(model.metis_model_id, model);
  }
  return { lastModified: response.headers.get('last-modified'), fetchedAt: new Date().toISOString(), byId };
}

/** List price in US dollars for the tokens one call used; reasoning tokens are billed as output. */
export function listPriceUsd(model, inputTokens, outputTokens) {
  if (!model || typeof model.input_price !== 'number' || typeof model.output_price !== 'number') return null;
  return (inputTokens * model.input_price + outputTokens * model.output_price) / 1_000_000;
}

export function median(values) {
  const sorted = values.filter((value) => typeof value === 'number').sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function writeResults(name, results) {
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  const file = fileURLToPath(new URL(`./results-${name}-${stamp}.json`, import.meta.url));
  writeFileSync(file, JSON.stringify(results, null, 2) + '\n');
  return file;
}
