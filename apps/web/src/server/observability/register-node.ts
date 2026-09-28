import 'server-only';
import { routeConsoleToLogger } from '@carshenas/observability/console';
import { isError } from '@carshenas/observability/errors';
import { otlpExporter, registerTracing } from '@carshenas/observability/tracing';
import { env } from '@/server/env';
import { logger } from '@/server/observability/logger';

// What the server does once at startup, from register() in instrumentation.ts (ADR-0016).

// Static files, images and health checks: their completion lines are debug, not info.
const QUIET_PATHS = /^\/(?:_next\/(?:static|image)\/|favicon\.ico$|api\/health$)/;

// Next.js also prints every error it hands to onRequestError: before calling the hook for a Route Handler, after it
// for a page. The hook's line is the structured one, so the print is dropped. It is recognised by being made from
// inside Next.js's onRequestError path, so an error Next.js only prints (a failure while rendering its own error
// page) is still logged.
const REQUEST_ERROR_PATH = /\b(?:instrumentationOnRequestError|onRequestError)\b/;

export function isReportedRequestErrorPrint(
  args: readonly unknown[],
  stack = new Error().stack ?? '',
): boolean {
  return args.some(isError) && REQUEST_ERROR_PATH.test(stack);
}

export function registerObservability(): void {
  // Stack traces in the logs point at the TypeScript source: from here on Node keeps the source map of every chunk
  // it loads, and the logger maps each frame through it (Next.js leaves error.stack itself unmapped).
  process.setSourceMapsEnabled(true);
  registerTracing({
    service: 'carshenas-web',
    version: env.release,
    environment: env.environment,
    exporter: env.exportTraces ? otlpExporter() : undefined,
    // The development server prints its own line per request, so ours is debug there.
    requestLog: {
      logger,
      level: env.isProduction ? 'info' : 'debug',
      isQuietPath: (path) => QUIET_PATHS.test(path),
    },
  });
  // In production every line is JSON, including what Next.js and libraries print through console.
  if (env.isProduction) routeConsoleToLogger(logger, { ignore: (args) => isReportedRequestErrorPrint(args) });
  logger.info('server started', {
    node: process.version,
    logLevel: env.logLevel,
    exportTraces: env.exportTraces,
    diagnostics: env.diagnosticsEnabled,
  });
}
