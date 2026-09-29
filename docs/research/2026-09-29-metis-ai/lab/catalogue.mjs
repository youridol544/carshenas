// What Metis serves right now, from its own listing endpoints, next to its published catalogue (models.json).
// Only GET requests: nothing here is billed.
import { CATALOGUE_URL, loadCatalogue, METIS, metisKey, timedJson, writeResults } from './lib.mjs';

const key = metisKey();
const bearer = { authorization: `Bearer ${key}` };

const endpoints = [
  { name: 'openai-models', url: `${METIS}/openai/v1/models`, headers: bearer },
  { name: 'metis-meta', url: `${METIS}/api/v1/meta`, headers: bearer },
  {
    name: 'anthropic-models',
    url: `${METIS}/anthropic/v1/models`,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  },
  { name: 'gemini-models', url: `${METIS}/v1beta/models`, headers: { 'x-goog-api-key': key } },
  { name: 'deepseek-models', url: `${METIS}/deepseek/v1/models`, headers: bearer },
];

const results = { ranAt: new Date().toISOString(), endpoints: {} };

for (const endpoint of endpoints) {
  const answer = await timedJson(endpoint.url, { method: 'GET', headers: endpoint.headers });
  const ids = modelIds(answer.json);
  results.endpoints[endpoint.name] = {
    path: new URL(endpoint.url).pathname,
    status: answer.status,
    latencyMs: answer.latencyMs,
    headers: answer.headers,
    count: ids?.length ?? null,
    ids,
    ...(ids ? {} : { body: answer.json ?? answer.text ?? answer.error }),
  };
  console.log(`${endpoint.name.padEnd(18)} ${answer.status} ${String(answer.latencyMs).padStart(5)} ms  ${ids ? `${ids.length} models` : 'no model list'}`);
}

// The native meta endpoint groups models by what they do; modelIds() flattened the groups, so keep them too.
const metaAnswer = await timedJson(`${METIS}/api/v1/meta`, { method: 'GET', headers: bearer });
if (metaAnswer.status === 200 && metaAnswer.json && typeof metaAnswer.json === 'object') {
  results.metaGroups = Object.fromEntries(
    Object.entries(metaAnswer.json).map(([group, list]) => [
      group,
      Array.isArray(list) ? list.map((entry) => `${entry.name}:${entry.model}`) : list,
    ]),
  );
  for (const [group, list] of Object.entries(results.metaGroups)) {
    console.log(`  meta ${group}: ${Array.isArray(list) ? list.length : typeof list}`);
  }
}

const catalogue = await loadCatalogue();
results.catalogue = { url: CATALOGUE_URL, lastModified: catalogue.lastModified, entries: catalogue.byId.size };
console.log(`catalogue (${CATALOGUE_URL}): ${catalogue.byId.size} distinct ids, last modified ${catalogue.lastModified}`);

console.log(`wrote ${writeResults('catalogue', results)}`);

function modelIds(json) {
  if (!json || typeof json !== 'object') return null;
  if (Array.isArray(json.data)) return json.data.map((model) => model.id ?? model.name).sort();
  if (Array.isArray(json.models)) return json.models.map((model) => model.name ?? model.id).sort();
  const lists = Object.values(json).filter(Array.isArray);
  if (lists.length) return lists.flat().map((entry) => (entry.name && entry.model ? `${entry.name}:${entry.model}` : entry.id ?? entry.name)).sort();
  return null;
}
