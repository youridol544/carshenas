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

// The published catalogue is 1 MB, so only its counts and the rows the research note quotes are kept.
const NOTE_MODELS = [
  'gpt-5.6-luna',
  'gpt-5.4-nano',
  'gpt-5.4-mini',
  'gpt-5.6-terra',
  'claude-haiku-4.5',
  'claude-sonnet-4',
  'claude-sonnet-5',
  'claude-opus-4.5',
  'claude-opus-5',
  'claude-fable-5',
  'claude-3-7-sonnet',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'mimo-v2.5',
  'mimo-v2.5-pro',
  'metis-gpt',
  'metis-gpt-mini',
  'grok-4-fast',
  'text-embedding-3-small',
  'text-embedding-3-large',
  'embed-multilingual-v3.0',
  'embed-v4.0',
  'gemini-embedding-001',
  'jina-embeddings-v3',
];
const ROW_FIELDS = [
  'company_name',
  'metis_model_id',
  'metis_category',
  'input_price',
  'output_price',
  'cached_input_price',
  'cached_write_price_5m',
  'cached_write_price_1h',
  'price_unit',
  'context_length',
  'input_modalities',
  'output_modalities',
  'supported_parameters',
  'release_date',
];

const catalogue = await loadCatalogue();
const count = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map())]);
const languageModels = catalogue.models.filter((model) => model.metis_category === 'مدل های LLM');
results.catalogue = {
  url: CATALOGUE_URL,
  lastModified: catalogue.lastModified,
  fetchedAt: catalogue.fetchedAt,
  entries: catalogue.models.length,
  distinctIds: catalogue.byId.size,
  byCategory: count(catalogue.models.map((model) => model.metis_category)),
  languageModelsByCompany: count(languageModels.map((model) => model.company_name)),
  rows: NOTE_MODELS.map((id) => {
    const model = catalogue.byId.get(id);
    return model ? Object.fromEntries(ROW_FIELDS.map((field) => [field, model[field] ?? null])) : { metis_model_id: id, missing: true };
  }),
};
console.log(
  `catalogue (${CATALOGUE_URL}): ${catalogue.models.length} entries, ${catalogue.byId.size} distinct ids, ${languageModels.length} language models, last modified ${catalogue.lastModified}`,
);

console.log(`wrote ${writeResults('catalogue', results)}`);

function modelIds(json) {
  if (!json || typeof json !== 'object') return null;
  if (Array.isArray(json.data)) return json.data.map((model) => model.id ?? model.name).sort();
  if (Array.isArray(json.models)) return json.models.map((model) => model.name ?? model.id).sort();
  const lists = Object.values(json).filter(Array.isArray);
  if (lists.length) return lists.flat().map((entry) => (entry.name && entry.model ? `${entry.name}:${entry.model}` : entry.id ?? entry.name)).sort();
  return null;
}
