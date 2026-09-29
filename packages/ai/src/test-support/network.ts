// No network in the layer's tests (CS-45 #5): the provider packages build real requests and parse real answers, but
// every request goes to a stub that replays an answer in the provider's own format, and the guard fails the file if
// anything reached the network anyway.
import assert from 'node:assert/strict';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { after } from 'node:test';

/**
 * Makes the global fetch refuse, and watches Node's HTTP clients (undici behind fetch, node:http) for the whole file;
 * at the end the file fails if any request started. Call once at the top of a test file.
 */
export function forbidNetwork(): void {
  const seen: string[] = [];
  const onUndici = (message: unknown) => {
    const { request } = message as { request: { origin?: string; path?: string } };
    seen.push(`${request.origin ?? ''}${request.path ?? ''}`);
  };
  const onHttp = (message: unknown) => {
    const { request } = message as { request: { host?: string; path?: string } };
    seen.push(`${request.host ?? ''}${request.path ?? ''}`);
  };
  subscribe('undici:request:create', onUndici);
  subscribe('http.client.request.start', onHttp);
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('tests do not reach the network: pass a stub fetch'));
  after(() => {
    globalThis.fetch = realFetch;
    unsubscribe('undici:request:create', onUndici);
    unsubscribe('http.client.request.start', onHttp);
    assert.deepEqual(seen, [], 'a test reached the network');
  });
}

/** A request as the stub saw it: where it went, its headers and its JSON body. */
export type SentRequest = {
  readonly url: URL;
  readonly headers: Headers;
  readonly body: Record<string, unknown>;
};

export type Reply = {
  readonly status?: number;
  readonly body: unknown;
  readonly headers?: Record<string, string>;
};

/** A fetch that answers each request with the next reply, and records what was sent. */
export function stubFetch(...replies: (Reply | ((request: SentRequest) => Reply))[]): {
  fetch: typeof globalThis.fetch;
  requests: SentRequest[];
} {
  const requests: SentRequest[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    // As the real fetch: an aborted signal rejects with its reason, before anything is sent.
    if (init?.signal?.aborted) return Promise.reject(init.signal.reason as Error);
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const request: SentRequest = {
      url,
      headers: new Headers(init?.headers),
      body: body as Record<string, unknown>,
    };
    requests.push(request);
    const next = replies[requests.length - 1] ?? replies.at(-1);
    if (!next) return Promise.reject(new Error('the stub has no reply'));
    const reply = typeof next === 'function' ? next(request) : next;
    return Promise.resolve(
      new Response(JSON.stringify(reply.body), {
        status: reply.status ?? 200,
        headers: { 'content-type': 'application/json', ...reply.headers },
      }),
    );
  };
  return { fetch, requests };
}

const USAGE_OPENAI = {
  prompt_tokens: 700,
  completion_tokens: 93,
  total_tokens: 793,
  prompt_tokens_details: { cached_tokens: 512 },
  completion_tokens_details: { reasoning_tokens: 30 },
};

/** Chat Completions, as Metis's /openai/v1 route answers (CS-44's wire check). */
export function openaiReply(content: string | null, finish = 'stop', refusal?: string): Reply {
  return {
    headers: { 'x-request-id': 'req_openai_stub' },
    body: {
      id: 'chatcmpl-stub',
      object: 'chat.completion',
      created: 1_790_000_000,
      model: 'gpt-5.6-luna-2026-07-09',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content, ...(refusal ? { refusal } : {}) },
          finish_reason: finish,
        },
      ],
      usage: USAGE_OPENAI,
    },
  };
}

/** Anthropic Messages, as Metis's /anthropic route answers. */
export function anthropicReply(text: string | null, stop = 'end_turn'): Reply {
  return {
    headers: { 'request-id': 'req_anthropic_stub' },
    body: {
      id: 'msg_stub',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5-20251001',
      content: text === null ? [] : [{ type: 'text', text }],
      stop_reason: stop,
      stop_sequence: null,
      usage: {
        input_tokens: 1368,
        output_tokens: 119,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  };
}

/** Gemini generateContent, as Metis's /v1beta route answers. */
export function geminiReply(text: string | null, finish = 'STOP'): Reply {
  return {
    body: {
      candidates: [
        {
          content: { role: 'model', parts: text === null ? [] : [{ text }] },
          finishReason: finish,
          index: 0,
        },
      ],
      usageMetadata: { promptTokenCount: 313, candidatesTokenCount: 166, totalTokenCount: 479 },
      modelVersion: 'gemini-3.1-flash-lite',
      responseId: 'stub',
    },
  };
}

/** DeepSeek's Chat Completions in JSON mode, as Metis's /deepseek/v1 route answers. */
export function deepseekReply(content: string | null, finish = 'stop'): Reply {
  const reply = openaiReply(content, finish);
  return { body: { ...(reply.body as Record<string, unknown>), model: 'deepseek-flash' } };
}

/** An error body with a status, as Metis passes a provider's refusal of the request on. */
export function errorReply(status: number): Reply {
  return { status, body: { error: { message: `stub error ${status}`, type: 'stub', code: null } } };
}
