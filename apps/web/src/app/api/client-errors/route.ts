import { receiveBrowserErrorReport } from '@/server/observability/browser-errors';
import { withErrorReference } from '@/server/observability/route-errors';

// Browser errors, from instrumentation-client.ts and the error screens, into the server log (ADR-0016).
export const POST = withErrorReference('/api/client-errors', receiveBrowserErrorReport);
