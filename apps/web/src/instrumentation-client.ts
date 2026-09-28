import { installBrowserErrorReporting } from '@carshenas/observability/browser';

// Runs in the browser before the app hydrates (Next.js instrumentation-client), so an uncaught error or unhandled
// rejection from the first moment reaches the server log (ADR-0016). Errors an error boundary catches are reported
// by the error screen itself (src/components/layout/error-reference.tsx). The endpoint is the Route Handler at
// src/app/api/client-errors/route.ts.
installBrowserErrorReporting({ endpoint: '/api/client-errors' });
