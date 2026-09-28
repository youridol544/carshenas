import 'server-only';
import { errorFingerprint } from '@carshenas/observability/errors';
import { mapStackFrames, type SourceMapLookup } from '@carshenas/observability/stack';
import {
  browserErrorReportSchema,
  type BrowserErrorReportBody,
} from '@/server/observability/browser-error-schema';
import { browserSourceMaps } from '@/server/observability/browser-source-maps';
import { logger } from '@/server/observability/logger';

// POST /api/client-errors: a browser error, from instrumentation-client.ts or an error screen, written to the same
// log as the server's (ADR-0016). The route is open to the internet, so the intake refuses what is not a report
// from our own pages, reads at most 16 KiB, and logs at most 30 reports a minute per server process; a report of a
// bug already logged in the current minute is counted instead. Accepted or dropped, the answer is the same 204, so
// the sender learns nothing.

type ReportedError = BrowserErrorReportBody['error'];

export type BrowserErrorIntakeOptions = {
  /** Milliseconds from a monotonic clock. */
  now?: () => number;
  maxPerWindow?: number;
  windowMs?: number;
  maxBodyBytes?: number;
  /** Finds browser source maps for the stacks; the build's maps by default. */
  sourceMaps?: (stacks: readonly string[]) => Promise<SourceMapLookup>;
};

type Window = { startedAt: number; logged: number; repeated: number; overLimit: number; seen: Set<string> };

const MAX_USER_AGENT = 300;
const NO_CONTENT = () => new Response(null, { status: 204 });

async function readBody(request: Request, limit: number): Promise<string | undefined> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) return undefined;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function stacksOf(error: ReportedError): string[] {
  return [
    ...(error.stack === undefined ? [] : [error.stack]),
    ...(error.cause ? stacksOf(error.cause) : []),
    ...(error.errors ?? []).flatMap(stacksOf),
  ];
}

function symbolicate(error: ReportedError, lookup: SourceMapLookup): ReportedError {
  return {
    ...error,
    stack: error.stack === undefined ? undefined : mapStackFrames(error.stack, lookup),
    cause: error.cause && symbolicate(error.cause, lookup),
    errors: error.errors?.map((member) => symbolicate(member, lookup)),
  };
}

export function createBrowserErrorIntake(options: BrowserErrorIntakeOptions = {}) {
  const {
    now = () => performance.now(),
    maxPerWindow = 30,
    windowMs = 60_000,
    maxBodyBytes = 16 * 1024,
    sourceMaps = browserSourceMaps,
  } = options;
  const log = logger.child({ source: 'browser' });
  let window: Window = { startedAt: now(), logged: 0, repeated: 0, overLimit: 0, seen: new Set() };

  /** Whether this report may be logged now; counts it otherwise. */
  function admit(fingerprint: string): boolean {
    const time = now();
    if (time - window.startedAt >= windowMs) {
      if (window.repeated > 0 || window.overLimit > 0) {
        log.warn('browser error reports dropped', {
          repeated: window.repeated,
          overLimit: window.overLimit,
          windowSeconds: windowMs / 1000,
        });
      }
      window = { startedAt: time, logged: 0, repeated: 0, overLimit: 0, seen: new Set() };
    }
    if (window.seen.has(fingerprint)) {
      window.repeated += 1;
      return false;
    }
    if (window.logged >= maxPerWindow) {
      window.overLimit += 1;
      return false;
    }
    window.seen.add(fingerprint);
    window.logged += 1;
    return true;
  }

  return async function receive(request: Request): Promise<Response> {
    // Browsers say where a request comes from; a report from another site is not ours to log.
    const site = request.headers.get('sec-fetch-site');
    if (site !== null && site !== 'same-origin') return new Response(null, { status: 403 });
    const body = await readBody(request, maxBodyBytes);
    if (body === undefined) return new Response(null, { status: 413 });
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      return new Response(null, { status: 400 });
    }
    const parsed = browserErrorReportSchema.safeParse(input);
    if (!parsed.success) return new Response(null, { status: 400 });
    const report = parsed.data;
    if (!admit(errorFingerprint(report.error))) return NO_CONTENT();

    const lookup = await sourceMaps(stacksOf(report.error));
    const page = new URL(report.path, 'http://localhost');
    log.error('browser error', {
      kind: report.kind,
      reference: report.reference,
      'url.path': page.pathname,
      'url.query': page.search === '' ? undefined : page.search.slice(1),
      'user_agent.original': request.headers.get('user-agent')?.slice(0, MAX_USER_AGENT),
      err: symbolicate(report.error, lookup),
    });
    return NO_CONTENT();
  };
}

export const receiveBrowserErrorReport = createBrowserErrorIntake();
