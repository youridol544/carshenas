import { hostname } from 'node:os';
import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino from 'pino';
import pretty from 'pino-pretty';
import { currentLogContext } from './context.ts';
import { sanitizeFields, type LogFields } from './fields.ts';
import { redactText } from './redact.ts';
import { sourceMappedStack } from './stack.ts';

// The one way server code writes a log line (ADR-0016). Callers depend on this small interface; pino is the engine
// behind it (fast, synchronous JSON to stdout, the pretty printer in development, and the integrations Sentry and
// OpenTelemetry already ship for it). A line is an event: a constant message that says what happened, and fields
// that say to what: `logger.info('snapshot stored', { listingId, source })`. Every line written inside a traced
// request or job carries its trace_id and span_id, so one search finds everything that happened in it.

export type { LogFields } from './fields.ts';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogLevelSetting = LogLevel | 'silent';

export type Logger = {
  trace(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  fatal(message: string, fields?: LogFields): void;
  /** A logger whose lines all carry these fields, such as `{ component: 'db' }` or `{ source: 'divar' }`. */
  child(bindings: LogFields): Logger;
  isLevelEnabled(level: LogLevel): boolean;
  /** Resolves once everything written so far has reached the destination. */
  flush(): Promise<void>;
};

export type LogFormat = 'json' | 'pretty';

export type LoggerOptions = {
  /** `carshenas-web`, `carshenas-worker`: which program wrote the line. */
  service: string;
  /** The deployed build (a git commit), so a line leads to the exact code that wrote it. */
  version: string;
  /** `production`, `development`, `test`. */
  environment: string;
  /** Lines below this level are not written. `info` by default. */
  level?: LogLevelSetting;
  /** One JSON object per line (production), or coloured lines for a person (development). `json` by default. */
  format?: LogFormat;
  /** Where lines go: standard output by default. JSON takes any `write(line)` object; pretty needs a Writable. */
  destination?: pino.DestinationStream;
  /** Milliseconds since the epoch. See `introspectionClock`. */
  clock?: () => number;
  /**
   * The folder paths in stack traces are shown relative to: the repository root, so a file reads the same from every
   * program and from the browser (`apps/web/src/app/page.tsx`). The working directory by default.
   */
  sourceRoot?: string;
};

/**
 * The current time without touching `Date`. With Cache Components, Next.js treats `Date.now()` and `new Date()`
 * inside a prerender as input that makes the page dynamic, and aborts or errors the render; its own source reserves
 * `Date` for output and `performance` for introspection, and its span store stamps time this way. So a log line
 * written while a page renders must not read `Date`. The clock follows the system clock's gradual NTP corrections;
 * only a step change of the system clock after the process started makes it drift.
 */
export function introspectionClock(): number {
  return performance.timeOrigin + performance.now();
}

// Trace context in the field names the OpenTelemetry specification gives for logs outside OTLP (Stable).
function traceFields(): LogFields | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) return undefined;
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: spanContext.traceFlags.toString(16).padStart(2, '0'),
  };
}

function destinationFor(
  format: LogFormat,
  output: pino.DestinationStream | undefined,
): pino.DestinationStream {
  if (format === 'pretty') {
    return pretty({
      sync: true,
      destination: output ?? 1,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname,service,version,env',
    });
  }
  // Synchronous on purpose: pino's default buffers, and a process that is killed (out of memory, SIGKILL) loses the
  // buffered lines, which are the ones that explain the crash.
  return output ?? pino.destination({ dest: 1, sync: true });
}

type Serialize = { mapStack: (stack: string) => string };

function wrap(engine: pino.Logger, bindings: LogFields, serialize: Serialize): Logger {
  function write(level: LogLevel, message: string, fields: LogFields | undefined): void {
    if (!engine.isLevelEnabled(level)) return;
    const context = currentLogContext();
    // One object, so a key never appears twice in a line; the call's own fields win over the logger's bindings,
    // which win over the surrounding log context.
    const entry = {
      ...traceFields(),
      ...(context && sanitizeFields(context, serialize)),
      ...bindings,
      ...(fields && sanitizeFields(fields, serialize)),
    };
    engine[level](entry, redactText(message));
  }
  return {
    trace: (message, fields) => {
      write('trace', message, fields);
    },
    debug: (message, fields) => {
      write('debug', message, fields);
    },
    info: (message, fields) => {
      write('info', message, fields);
    },
    warn: (message, fields) => {
      write('warn', message, fields);
    },
    error: (message, fields) => {
      write('error', message, fields);
    },
    fatal: (message, fields) => {
      write('fatal', message, fields);
    },
    child: (childBindings) =>
      wrap(engine, { ...bindings, ...sanitizeFields(childBindings, serialize) }, serialize),
    isLevelEnabled: (level) => engine.isLevelEnabled(level),
    flush: () =>
      new Promise((resolve, reject) => {
        engine.flush((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

/** A logger for one program. Create one per process and derive the rest with `child`. */
export function createLogger(options: LoggerOptions): Logger {
  const format = options.format ?? 'json';
  const clock = options.clock ?? introspectionClock;
  const engine = pino(
    {
      level: options.level ?? 'info',
      base: {
        service: options.service,
        version: options.version,
        env: options.environment,
        pid: process.pid,
        hostname: hostname(),
      },
      timestamp: () => `,"time":"${new Date(clock()).toISOString()}"`,
      // Fields arrive already serialised and redacted (fields.ts). pino always merges its own `err` serializer,
      // which would take the serialised error for a new one and rename its type to Object, so it is replaced.
      serializers: { err: (value: unknown) => value },
      // Level names instead of pino's numbers, so a line reads and filters the same everywhere. The pretty printer
      // names levels itself and expects the numbers.
      ...(format === 'json' && { formatters: { level: (label: string) => ({ level: label }) } }),
    },
    destinationFor(format, options.destination),
  );
  // Stacks point at the original TypeScript through the source maps Node has loaded (stack.ts); without them the
  // stack is written as it is.
  const { sourceRoot } = options;
  return wrap(engine, {}, { mapStack: (stack) => sourceMappedStack(stack, sourceRoot) });
}
