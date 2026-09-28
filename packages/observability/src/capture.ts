import type { LogFields, Logger } from './logger.ts';

// Reporting an unexpected error: the one call for a failure someone has to look at (ADR-0016). Today it writes one
// error line with the serialised error. Later a reporter adds a destination without touching any caller: Sentry
// (or a self-hosted, Sentry-compatible server) is `captureException(error, { level, tags, extra, fingerprint })`
// behind the ErrorReporter interface. docs/runbooks/logs-and-errors.md has the adapter.

/** Sentry's spelling of severities, so an adapter passes it through. */
export type ErrorSeverity = 'fatal' | 'error' | 'warning';

export type CaptureContext = {
  /** The line's message: what failed, as a constant ('request failed', 'crawl run failed'). */
  message?: string;
  severity?: ErrorSeverity;
  /** A few searchable, low-cardinality values: route, route type, source. */
  tags?: Readonly<Record<string, string>>;
  /** Everything else worth seeing next to the error. */
  fields?: LogFields;
  /** Groups occurrences when the stack alone would split or merge them wrongly: ['crawler', source, code]. */
  fingerprint?: readonly string[];
};

export type ErrorReporter = {
  readonly name: string;
  capture(error: unknown, context: CaptureContext): void;
  /** Sends what is still queued; a worker calls it before exiting. */
  flush?(timeoutMs: number): Promise<unknown>;
};

export type ErrorCapture = {
  /** Logs the error at its severity and hands it to every reporter. Never throws. */
  capture(error: unknown, context?: CaptureContext): void;
  addReporter(reporter: ErrorReporter): void;
  flush(timeoutMs?: number): Promise<void>;
};

const LOG_LEVEL = { fatal: 'fatal', error: 'error', warning: 'warn' } as const satisfies Record<
  ErrorSeverity,
  string
>;

export function createErrorCapture(logger: Logger): ErrorCapture {
  const reporters: ErrorReporter[] = [];
  return {
    capture(error, context = {}) {
      const { message = 'unexpected error', severity = 'error', tags, fields } = context;
      logger[LOG_LEVEL[severity]](message, { ...tags, ...fields, err: error });
      for (const reporter of reporters) {
        try {
          reporter.capture(error, context);
        } catch (reporterError) {
          logger.warn('error reporter failed', { reporter: reporter.name, err: reporterError });
        }
      }
    },
    addReporter(reporter) {
      reporters.push(reporter);
    },
    async flush(timeoutMs = 2_000) {
      await Promise.allSettled(
        reporters.flatMap((reporter) => (reporter.flush ? [reporter.flush(timeoutMs)] : [])),
      );
    },
  };
}
