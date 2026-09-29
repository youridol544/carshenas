import { SourceBlockedError, SourceThrottledError, SourceUnavailableError } from './errors.ts';
import type { LaneClient } from './job.ts';

// A request to a source, through its lane (ADR-0008 points 5 and 6, ADR-0018). It names the crawler with its
// User-Agent, follows no redirect by itself (each hop would be another request to pace), reads the whole answer
// while it still holds the lane, so the gap starts when the transfer ends, and turns the source's refusals and
// failures into the errors the lane reacts to. It never retries: the queue does (ADR-0018 point 5).

/** A source's answer, read in full. */
export type SourceResponse = {
  readonly url: string;
  readonly status: number;
  readonly headers: Headers;
  readonly body: string;
  /** When the lane let the request start, by the database's clock: the fetch_log row's requested_at. */
  readonly startedAt: Date;
};

export type SourceFetchInit = {
  readonly method?: 'GET' | 'POST';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /**
   * Recognises an answer that is a refusal although its status is not: a challenge page, or an empty list where
   * listings were expected (Divar can block with an empty 200; CS-33). The source is stopped as for a 403.
   */
  readonly detectBlock?: (response: SourceResponse) => 'blocked' | 'challenge' | undefined;
  /** The largest answer read; MAX_BODY_BYTES by default. */
  readonly maxBytes?: number;
};

export type SourceFetch = (url: string | URL, init?: SourceFetchInit) => Promise<SourceResponse>;

/** A larger answer is not a page we want, and would hold the lane: the job fails. */
export const MAX_BODY_BYTES = 10 * 1024 * 1024;

/** The answer was larger than MAX_BODY_BYTES: the job's own failure, not the source's. */
export class AnswerTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`the answer is larger than ${maxBytes} bytes`);
    this.name = 'AnswerTooLargeError';
  }
}

/** RFC 9110 §10.2.3: a number of seconds or an HTTP date, as milliseconds from `now`; undefined if unreadable. */
export function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^\d+$/.test(text)) return Number(text) * 1_000;
  const at = Date.parse(text);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

async function readBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let text = '';
  let bytes = 0;
  for (;;) {
    const read = await reader.read();
    if (read.done) return text + decoder.decode();
    // Node types a response body's chunks loosely; fetch gives bytes.
    const chunk: unknown = read.value;
    if (!(chunk instanceof Uint8Array))
      throw new TypeError('the answer arrived as something other than bytes');
    bytes += chunk.byteLength;
    if (bytes > maxBytes) {
      // The rest of the answer is never downloaded.
      await reader.cancel();
      throw new AnswerTooLargeError(maxBytes);
    }
    text += decoder.decode(chunk, { stream: true });
  }
}

/** A failure before the answer was read: the source's problem, unless the job itself was stopped. */
function failureOf(error: unknown, signal: AbortSignal): Error {
  if (signal.aborted) {
    const reason: unknown = signal.reason;
    if (reason instanceof DOMException && reason.name === 'TimeoutError') {
      return new SourceUnavailableError('the source did not answer in time', { cause: error });
    }
    // The worker is shutting down or the job was taken back: not the source's doing.
    return error instanceof Error ? error : new Error('the request was aborted', { cause: error });
  }
  return new SourceUnavailableError('the request to the source failed', { cause: error });
}

/** Throws for a refusal or a failure of the source; returns every other answer, a 404 included. */
export function classify(
  answer: SourceResponse,
  detectBlock: SourceFetchInit['detectBlock'],
  now: number,
): SourceResponse {
  const { status, headers } = answer;
  if (status === 401 || status === 403) {
    throw new SourceBlockedError(`the source answered ${status}`, { reason: 'blocked', status });
  }
  if (status === 429) {
    throw new SourceThrottledError('the source answered 429', {
      retryAfterMs: parseRetryAfter(headers.get('retry-after'), now),
    });
  }
  if (status === 408 || status >= 500) {
    throw new SourceUnavailableError(`the source answered ${status}`, {
      status,
      retryAfterMs: status === 503 ? parseRetryAfter(headers.get('retry-after'), now) : undefined,
    });
  }
  const block = detectBlock?.(answer);
  if (block) {
    throw new SourceBlockedError(
      `the source answered ${status} with a ${block === 'challenge' ? 'challenge' : 'block'}`,
      {
        reason: block,
        status,
      },
    );
  }
  return answer;
}

/** A fetch whose every request goes through `lane` and names the crawler as `userAgent()` says. */
export function createSourceFetch(lane: LaneClient, userAgent: () => string): SourceFetch {
  return (url, init = {}) =>
    lane.request(async ({ signal, startedAt }) => {
      // The crawler's name is not the job's to change: set, not appended, whatever case the job wrote it in. Read
      // before the request, so a missing setting fails the job as its own error, never as the source's.
      const headers = new Headers(init.headers);
      headers.set('user-agent', userAgent());
      let answer: SourceResponse;
      try {
        const response = await fetch(url, {
          method: init.method ?? 'GET',
          headers,
          body: init.body,
          redirect: 'manual',
          signal,
        });
        answer = {
          url: response.url || String(url),
          status: response.status,
          headers: response.headers,
          body: await readBody(response, init.maxBytes ?? MAX_BODY_BYTES),
          startedAt,
        };
      } catch (error) {
        if (error instanceof AnswerTooLargeError) throw error;
        throw failureOf(error, signal);
      }
      return classify(answer, init.detectBlock, Date.now());
    });
}
