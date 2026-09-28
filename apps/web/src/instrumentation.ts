import type { Instrumentation } from 'next';

// Next.js calls register() once per server process before the first request, and onRequestError for every server
// error it catches in a page, a Route Handler, a Server Action or the proxy (ADR-0016). Next.js also compiles this
// file for the Edge runtime and replaces process.env.NEXT_RUNTIME in each build, so the Node-only imports below are
// dropped from the Edge build. That is why the check reads the variable here instead of through src/server/env.ts.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { registerObservability } = await import('@/server/observability/register-node');
  registerObservability();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportRequestError } = await import('@/server/observability/request-error');
  reportRequestError(error, request, context);
};
