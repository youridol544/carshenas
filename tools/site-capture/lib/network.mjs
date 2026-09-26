import { describeUrl, headerNames, pathPattern, shapeOf } from './redact.mjs';

const BODY_LIMIT = 3_000_000;
const STATIC_TYPES = new Set(['image', 'font', 'stylesheet', 'script', 'media', 'manifest', 'texttrack']);

/** Records every request of a page. Bodies are read for stylesheets, scripts and API-like responses. */
export function recordNetwork(page, { keepRaw = false } = {}) {
  const entries = [];
  const stylesheets = [];
  const scripts = [];
  const raw = [];
  const pending = new Set();

  page.on('response', (response) => {
    const work = (async () => {
      const request = response.request();
      const type = request.resourceType();
      const headers = response.headers();
      const mime = (headers['content-type'] ?? '').split(';')[0].trim();
      const entry = {
        method: request.method(),
        url: request.url(),
        type,
        status: response.status(),
        mime,
        requestHeaderNames: headerNames(request.headers()),
        responseHeaderNames: headerNames(headers),
        fromServiceWorker: response.fromServiceWorker(),
        postData: undefined,
        body: undefined,
        size: Number(headers['content-length'] ?? 0) || undefined,
      };
      entries.push(entry);

      const apiLike = type === 'xhr' || type === 'fetch' || /json|graphql/.test(mime);
      if (apiLike && request.postData()) entry.postData = request.postData().slice(0, BODY_LIMIT);
      if (!(apiLike || type === 'stylesheet' || type === 'script')) return;
      if (response.status() >= 300 && response.status() < 400) return;
      let buffer;
      try {
        buffer = await response.body();
      } catch {
        return;
      }
      entry.size ??= buffer.length;
      if (buffer.length > BODY_LIMIT) return;
      const text = buffer.toString('utf8');
      if (type === 'stylesheet') stylesheets.push({ url: request.url(), text });
      else if (type === 'script') scripts.push({ url: request.url(), text });
      else {
        entry.body = text;
        if (keepRaw)
          raw.push({
            url: request.url(),
            method: request.method(),
            status: response.status(),
            mime,
            body: text,
          });
      }
    })();
    pending.add(work);
    work.finally(() => pending.delete(work));
  });

  const failures = [];
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? '';
    if (!reason.includes('ERR_ABORTED'))
      failures.push({ method: request.method(), url: describeUrl(request.url()).display, reason });
  });

  return { entries, stylesheets, scripts, raw, failures, settle: () => Promise.allSettled([...pending]) };
}

function parseJson(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function graphqlOperations(postData) {
  const parsed = parseJson(postData);
  const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  return list
    .filter(
      (item) =>
        item && (typeof item.query === 'string' || item.operationName || item.extensions?.persistedQuery),
    )
    .map((item) => ({
      operationName:
        item.operationName ??
        item.query?.match(/\b(?:query|mutation|subscription)\s+(\w+)/)?.[1] ??
        '(anonymous)',
      kind:
        item.query?.trim().match(/^(query|mutation|subscription)\b/)?.[1] ??
        (item.query ? 'query' : 'persisted'),
      persisted: Boolean(item.extensions?.persistedQuery),
      variables: item.variables ? shapeOf(item.variables) : undefined,
    }));
}

/** Groups API-like traffic into endpoints with shapes. Output is safe to commit: names, types, patterns. */
export function summarizeApi(entries, pageUrl) {
  const pageHost = new URL(pageUrl).host;
  const registrable = (host) => host.split('.').slice(-2).join('.');
  const firstParty = (host) => registrable(host) === registrable(pageHost);

  const hosts = new Map();
  for (const entry of entries) {
    const { host } = describeUrl(entry.url);
    if (!host) continue;
    const record = hosts.get(host) ?? {
      host,
      firstParty: firstParty(host),
      requests: 0,
      types: new Set(),
      bytes: 0,
    };
    record.requests++;
    record.types.add(entry.type);
    record.bytes += entry.size ?? 0;
    hosts.set(host, record);
  }

  const endpoints = new Map();
  for (const entry of entries) {
    const apiLike =
      (entry.type === 'xhr' || entry.type === 'fetch' || /json|graphql/.test(entry.mime)) &&
      !STATIC_TYPES.has(entry.type);
    if (!apiLike) continue;
    const url = describeUrl(entry.url);
    const operations = graphqlOperations(entry.postData);
    const isGraphql = operations.length > 0 || /graphql/i.test(url.path);
    const keys =
      isGraphql && operations.length ? operations.map((op) => `${op.kind} ${op.operationName}`) : [null];
    for (const opKey of keys) {
      const key = `${entry.method} ${url.host}${pathPattern(url.path)}${opKey ? ` :: ${opKey}` : ''}`;
      const record = endpoints.get(key) ?? {
        method: entry.method,
        host: url.host,
        firstParty: firstParty(url.host),
        path: pathPattern(url.path),
        graphql: opKey,
        calls: 0,
        statuses: new Set(),
        query: new Set(),
        mime: entry.mime,
        requestHeaders: new Set(),
        requestShape: undefined,
        responseShape: undefined,
        examplePath: url.path.length < 120 ? pathPattern(url.path) : undefined,
      };
      record.calls++;
      record.statuses.add(entry.status);
      url.query.forEach((name) => record.query.add(name));
      entry.requestHeaderNames
        .filter(
          (name) =>
            name.startsWith('x-') || name === 'authorization' || name === 'content-type' || name === 'accept',
        )
        .forEach((name) => record.requestHeaders.add(name));
      if (record.requestShape === undefined && entry.postData) {
        const body = parseJson(entry.postData);
        if (opKey)
          record.requestShape = operations.find(
            (op) => `${op.kind} ${op.operationName}` === opKey,
          )?.variables;
        else if (body !== undefined) record.requestShape = shapeOf(body);
        else
          record.requestShape = `form or text body (${
            entry.postData
              .split('&')
              .filter((pair) => pair.includes('='))
              .map((pair) => pair.split('=')[0])
              .slice(0, 20)
              .join(', ') || 'opaque'
          })`;
      }
      if (record.responseShape === undefined && entry.body) {
        const body = parseJson(entry.body);
        if (body !== undefined) record.responseShape = shapeOf(body);
      }
      endpoints.set(key, record);
    }
  }

  const byType = new Map();
  for (const entry of entries) {
    const record = byType.get(entry.type) ?? { type: entry.type, requests: 0, bytes: 0 };
    record.requests++;
    record.bytes += entry.size ?? 0;
    byType.set(entry.type, record);
  }

  return {
    totals: {
      requests: entries.length,
      hosts: hosts.size,
      byType: [...byType.values()].sort((a, b) => b.requests - a.requests),
    },
    hosts: [...hosts.values()]
      .map((h) => ({ ...h, types: [...h.types] }))
      .sort((a, b) => b.requests - a.requests),
    endpoints: [...endpoints.values()]
      .map((e) => ({
        ...e,
        statuses: [...e.statuses],
        query: [...e.query].sort(),
        requestHeaders: [...e.requestHeaders].sort(),
      }))
      .sort((a, b) => Number(b.firstParty) - Number(a.firstParty) || b.calls - a.calls),
  };
}
