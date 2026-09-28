import 'server-only';
import { readableTarget } from '@carshenas/observability/redact';
import { newReference } from '@carshenas/observability/reference';
import { captureError } from '@/server/observability/logger';
import { isFrameworkControlFlow } from '@/server/observability/request-error';

// Every Route Handler exports its methods through withErrorReference (lint, src/app/**/route.ts). Next.js answers an
// error a Route Handler throws with an empty 500 and no digest, so neither the caller nor the log would have a code
// that connects them; this answers 500 with a Farsi message and a reference code, and writes the `request failed`
// line with the same code (ADR-0016). A redirect() or notFound() passes through to Next.js.

export const ROUTE_ERROR_MESSAGE = 'مشکلی پیش آمد؛ دوباره امتحان کنید.';

const MAX_USER_AGENT = 300;

export type RouteErrorBody = { message: string; reference: string };

/** `export const GET = withErrorReference('/api/search', async (request) => …)`: route is the route's path. */
export function withErrorReference<Context>(
  route: string,
  handler: (request: Request, context: Context) => Response | Promise<Response>,
): (request: Request, context: Context) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (isFrameworkControlFlow(error)) throw error;
      const reference = newReference();
      const url = new URL(request.url);
      const { path, query } = readableTarget(url.pathname + url.search);
      captureError(error, {
        message: 'request failed',
        tags: { 'next.route_path': route, 'next.route_type': 'route' },
        fields: {
          reference,
          'http.request.method': request.method,
          'url.path': path,
          'url.query': query,
          'user_agent.original': request.headers.get('user-agent')?.slice(0, MAX_USER_AGENT),
        },
      });
      return Response.json({ message: ROUTE_ERROR_MESSAGE, reference } satisfies RouteErrorBody, {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  };
}
