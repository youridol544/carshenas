// What Metis serves today (CS-46): the model lists of its four native routes, its own meta endpoint and its live
// price list, so a shortlist names only models Metis serves, at the price it lists. GET requests only: nothing here is
// billed. Run from an Iranian network: pnpm --filter @carshenas/ai models. The key goes only into request headers.
import { METIS_BASE_URL } from '../src/metis.ts';
import { loadMetisPrices } from '../src/pricing.ts';
import { metisKey, writeResults } from './support.ts';

const key = metisKey();
if (!key) throw new Error('METIS_API_KEY is not set: the package script reads it from the repository .env');

const LISTS = [
  { route: 'openai', url: `${METIS_BASE_URL}/openai/v1/models`, headers: { authorization: `Bearer ${key}` } },
  {
    route: 'anthropic',
    url: `${METIS_BASE_URL}/anthropic/v1/models?limit=1000`,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  },
  {
    route: 'google',
    url: `${METIS_BASE_URL}/v1beta/models?pageSize=1000`,
    headers: { 'x-goog-api-key': key },
  },
  {
    route: 'deepseek',
    url: `${METIS_BASE_URL}/deepseek/v1/models`,
    headers: { authorization: `Bearer ${key}` },
  },
  { route: 'meta', url: `${METIS_BASE_URL}/api/v1/meta`, headers: { authorization: `Bearer ${key}` } },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Model ids from any of the list shapes: OpenAI's `data`, Gemini's `models`, Metis's groups of `{name, model}`. */
function idsOf(body: unknown): string[] {
  if (!isRecord(body)) return [];
  const pick = (entry: unknown): string | undefined => {
    if (!isRecord(entry)) return undefined;
    if (typeof entry.name === 'string' && typeof entry.model === 'string')
      return `${entry.name}:${entry.model}`;
    if (typeof entry.id === 'string') return entry.id;
    return typeof entry.name === 'string' ? entry.name.replace(/^models\//, '') : undefined;
  };
  const lists = Array.isArray(body.data)
    ? [body.data]
    : Array.isArray(body.models)
      ? [body.models]
      : Object.values(body).filter(Array.isArray);
  return lists
    .flat()
    .map(pick)
    .filter((id): id is string => id !== undefined)
    .sort();
}

/** Metis's own groups (chat, embedding, rerank …) with their entries, as the meta endpoint names them. */
function metaGroups(body: unknown): Record<string, string[]> {
  if (!isRecord(body)) return {};
  return Object.fromEntries(
    Object.entries(body)
      .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
      .map(([group, list]) => [
        group,
        list
          .filter(isRecord)
          .map((entry) => `${String(entry.name)}:${String(entry.model)}`)
          .sort(),
      ]),
  );
}

const lists: Record<string, unknown> = {};
for (const list of LISTS) {
  const started = performance.now();
  const response = await fetch(list.url, { headers: list.headers, signal: AbortSignal.timeout(30_000) });
  const body: unknown = await response.json().catch(() => undefined);
  const ids = idsOf(body);
  lists[list.route] = {
    path: new URL(list.url).pathname,
    status: response.status,
    latencyMs: Math.round(performance.now() - started),
    count: ids.length,
    ids,
    ...(list.route === 'meta' ? { groups: metaGroups(body) } : {}),
  };
  console.log(`${list.route.padEnd(10)} ${response.status} ${String(ids.length).padStart(4)} models`);
}

const prices = await loadMetisPrices();
console.log(`pricing    ${Object.keys(prices).length} models priced`);

const file = writeResults('metis-models', { ranAt: new Date().toISOString(), lists, prices });
console.log(`wrote ${file}`);
