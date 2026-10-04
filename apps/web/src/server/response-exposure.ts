import 'server-only';
import { exposureHeaders } from '@/lib/exposure';
import { requestHost, requestScheme } from '@/server/auth/request-origin';
import { env } from '@/server/env';

// The deployment's headers on a response the proxy is about to send (CS-119): noindex while the site is unlisted, the
// security headers in a production build, HSTS over https. What they are and when they apply: src/lib/exposure.ts.

/** The same response with the headers set; one that already carries such a header gets this deployment's value. */
export function withExposureHeaders<T extends Response>(
  response: T,
  request: { readonly headers: Headers },
): T {
  const facts = { protocol: requestScheme(request.headers), host: requestHost(request.headers) };
  for (const [name, value] of exposureHeaders(env.exposure, facts)) response.headers.set(name, value);
  return response;
}
