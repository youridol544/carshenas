import { receiveBrowserErrorReport } from '@/server/observability/browser-errors';

// Browser errors, from instrumentation-client.ts and the error screens, into the server log (ADR-0016).
export function POST(request: Request) {
  return receiveBrowserErrorReport(request);
}
