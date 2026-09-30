// Shared by the live scripts: the key from the environment (the package script loads the repository's git-ignored
// .env), a fetch that times each exchange and keeps the headers worth reading, and the results files. No script
// prints or writes the key: the SDK puts it only in request headers, and the recorder keeps header names only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function metisKey(): string | undefined {
  return process.env.METIS_API_KEY;
}

/** Response headers worth keeping: request ids, the provider's own processing time, rate limits, the edge. */
const KEPT_HEADER =
  /request-id|x-request|processing-ms|server-timing|ratelimit|retry-after|cf-ray|metis|cost|credit/i;
const KEY_HEADERS = ['authorization', 'x-api-key', 'x-goog-api-key'];

export type Exchange = {
  readonly url: string;
  readonly status: number;
  /** Which header carried the key: never its value. */
  readonly keyIn: string[];
  readonly headers: Record<string, string>;
  /** From the request to the response headers, and to the end of the body, in milliseconds. */
  readonly headersMs: number;
  readonly totalMs: number;
  /** The raw answer, when the recorder was asked to keep it. */
  readonly body?: string;
  /** The request parameters a check looks at (never the prompt), when the recorder was given `sent`. */
  readonly sent?: Record<string, unknown>;
};

export type RecordingFetch = {
  readonly fetch: typeof globalThis.fetch;
  readonly exchanges: Exchange[];
};

/**
 * A fetch that records each exchange. `rewrite` may change the JSON body before it is sent, for the checks that
 * need a parameter the SDK does not send (Metis's `cache`, Gemini's `responseFormat`).
 */
export function recordingFetch(
  options: {
    keepBodies?: boolean;
    rewrite?: (body: Record<string, unknown>) => Record<string, unknown>;
    sent?: (body: Record<string, unknown>) => Record<string, unknown>;
  } = {},
): RecordingFetch {
  const exchanges: Exchange[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    let body = init?.body;
    let sent: Record<string, unknown> | undefined;
    if (typeof body === 'string' && (options.rewrite || options.sent)) {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const rewritten = options.rewrite ? options.rewrite(parsed) : parsed;
      body = JSON.stringify(rewritten);
      sent = options.sent?.(rewritten);
    }
    const requestHeaders = new Headers(init?.headers);
    const started = performance.now();
    const response = await globalThis.fetch(input, { ...init, ...(body === undefined ? {} : { body }) });
    const headersMs = Math.round(performance.now() - started);
    const text = await response.clone().text();
    const headers: Record<string, string> = {};
    for (const [name, value] of response.headers) if (KEPT_HEADER.test(name)) headers[name] = value;
    exchanges.push({
      url: `${url.origin}${url.pathname}`,
      status: response.status,
      keyIn: KEY_HEADERS.filter((name) => requestHeaders.has(name)),
      headers,
      headersMs,
      totalMs: Math.round(performance.now() - started),
      ...(options.keepBodies || !response.ok
        ? { body: text.slice(0, options.keepBodies ? 50_000 : 1_000) }
        : {}),
      ...(sent ? { sent } : {}),
    });
    return response;
  };
  return { fetch, exchanges };
}

/** The provider's own processing time, where its answer says it: OpenAI's header, Gemini's server-timing. */
export function providerMs(headers: Record<string, string>): number | undefined {
  const openai = headers['openai-processing-ms'];
  if (openai !== undefined) return Number(openai);
  const timing = /dur=([\d.]+)/.exec(headers['server-timing'] ?? '');
  return timing?.[1] === undefined ? undefined : Number(timing[1]);
}

/** The value below which `share` of the values fall (nearest rank). */
export function percentile(values: readonly number[], share: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1)];
}

export function writeResults(name: string, results: unknown): string {
  const folder = fileURLToPath(new URL('../results/', import.meta.url));
  mkdirSync(folder, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  const file = `${folder}${name}-${stamp}.json`;
  writeFileSync(file, `${JSON.stringify(results, null, 2)}\n`);
  return file;
}
