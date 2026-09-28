import { AsyncLocalStorage } from 'node:async_hooks';

// Fields that belong to a unit of work (a crawl run, a source, a job id) and should appear on every line written
// inside it, however deep the call stack, without threading a logger through every function. What Java calls a
// mapped diagnostic context. The trace and span ids come from OpenTelemetry instead (tracing.ts); this carries the
// application's own identifiers.

export type LogContextFields = Readonly<Record<string, unknown>>;

const storage = new AsyncLocalStorage<LogContextFields>();

/** Runs `work` with `fields` added to every log line written inside it; nested calls add to the outer fields. */
export function withLogContext<T>(fields: LogContextFields, work: () => T): T {
  const outer = storage.getStore();
  return storage.run(outer ? { ...outer, ...fields } : fields, work);
}

/** The fields of the innermost `withLogContext` around this call, if any. */
export function currentLogContext(): LogContextFields | undefined {
  return storage.getStore();
}
