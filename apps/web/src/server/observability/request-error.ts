import 'server-only';
import { readableTarget } from '@carshenas/observability/redact';
import type { Instrumentation } from 'next';
import { captureError } from '@/server/observability/logger';

// A server error Next.js caught in a page, a Route Handler, a Server Action or the proxy, as one structured error
// line (ADR-0016). The visitor sees the error screen with the reference code (the error's digest), never the
// message; this line is where the message, the stack and the request are.

type RequestErrorArguments = Parameters<Instrumentation.onRequestError>;

// Errors Next.js throws for control flow are not failures: a redirect, a 404, a render that switches to dynamic
// or is interrupted. Sentry's captureRequestError skips the same ones. Their digests start with these codes. Only the
// error's own digest counts, as it does for Next.js: a failure that wraps a redirect as its cause is still a failure.
// (A Route Handler's catch uses unstable_rethrow instead, which also rethrows a wrapped one; route-errors.ts.)
const CONTROL_FLOW_DIGESTS = [
  'NEXT_REDIRECT',
  'NEXT_HTTP_ERROR_FALLBACK',
  'DYNAMIC_SERVER_USAGE',
  'NEXT_PRERENDER_INTERRUPTED',
  'HANGING_PROMISE_REJECTION',
  'BAILOUT_TO_CLIENT_SIDE_RENDERING',
];
const MAX_USER_AGENT = 300;

/** The digest React and Next.js give a server error; the error screen shows it as the reference code. */
export function digestOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  try {
    const { digest } = error as { digest?: unknown };
    return typeof digest === 'string' && digest !== '' ? digest : undefined;
  } catch {
    return undefined;
  }
}

/** Whether Next.js threw this to redirect, answer 404 or change how it renders: never a failure to report. */
function isFrameworkControlFlow(error: unknown): boolean {
  const digest = digestOf(error);
  return digest !== undefined && CONTROL_FLOW_DIGESTS.some((code) => digest.startsWith(code));
}

function firstHeader(headers: RequestErrorArguments[1]['headers'], name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function reportRequestError(...[error, request, context]: RequestErrorArguments): void {
  if (isFrameworkControlFlow(error)) return;
  const digest = digestOf(error);
  const { path, query } = readableTarget(request.path);
  // Headers carry cookies and credentials: only the browser is logged, never the headers themselves.
  const userAgent = firstHeader(request.headers, 'user-agent')?.slice(0, MAX_USER_AGENT);
  captureError(error, {
    message: 'request failed',
    tags: { 'next.route_path': context.routePath, 'next.route_type': context.routeType },
    fields: {
      reference: digest,
      'http.request.method': request.method,
      'url.path': path,
      'url.query': query,
      'next.router_kind': context.routerKind,
      'next.render_source': context.renderSource,
      'next.revalidate_reason': context.revalidateReason,
      'user_agent.original': userAgent,
    },
  });
}
