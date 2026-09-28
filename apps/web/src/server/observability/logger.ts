import 'server-only';
import {
  createErrorCapture,
  type CaptureContext,
  type ErrorCapture,
  type ErrorReporter,
} from '@carshenas/observability/capture';
import { createLogger, type Logger } from '@carshenas/observability/logger';
import { env } from '@/server/env';
import { REPOSITORY_ROOT } from '@/server/observability/repository-root';

// The web app's logger and error capture (ADR-0016, docs/runbooks/logs-and-errors.md). One of each per process:
// Next.js loads server code in several module graphs (instrumentation, each route), so they live on globalThis,
// like the database pool, and a reporter added at startup reaches every route.

type Observability = { logger: Logger; errors: ErrorCapture };

const globalForObservability = globalThis as typeof globalThis & { carshenasObservability?: Observability };

function observability(): Observability {
  if (!globalForObservability.carshenasObservability) {
    const logger = createLogger({
      service: 'carshenas-web',
      version: env.release,
      environment: env.environment,
      level: env.logLevel,
      format: env.logFormat,
      sourceRoot: REPOSITORY_ROOT,
    });
    globalForObservability.carshenasObservability = { logger, errors: createErrorCapture(logger) };
  }
  return globalForObservability.carshenasObservability;
}

/** Server code logs through this: `logger.info('snapshot stored', { listingId })`, or a `logger.child(…)`. */
export const logger: Logger = observability().logger;

/**
 * For an unexpected error that is handled rather than thrown, such as a Server Action that catches it to return a
 * Farsi message: one error line, and every reporter (Sentry later). Thrown errors reach onRequestError instead.
 */
export function captureError(error: unknown, context?: CaptureContext): void {
  observability().errors.capture(error, context);
}

/** Adds a destination for captured errors, such as Sentry; called once at startup (register-node.ts). */
export function addErrorReporter(reporter: ErrorReporter): void {
  observability().errors.addReporter(reporter);
}
