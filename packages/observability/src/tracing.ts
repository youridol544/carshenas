import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type AttributeValue,
  type Span,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  hrTimeToMilliseconds,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  TracerProvider,
  type ReadableSpan,
  type SpanExporter,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { isError } from './errors.ts';
import type { Logger, LogLevel } from './logger.ts';
import { readableTarget } from './redact.ts';

// OpenTelemetry tracing without a vendor (ADR-0016). Registering a provider makes Next.js create its own spans for
// every request (its root span is `GET /route`), and every span has a W3C trace id that the logger writes on each
// line, so one search finds everything one request or job did. No span leaves the process unless an exporter is
// given: `otlpExporter()` sends them to any OpenTelemetry collector or backend, configured by the standard OTEL_*
// variables. Built on @opentelemetry/sdk-trace with the globals set here, which is what SDK 3 keeps; sdk-trace-node
// and its register() are removed in SDK 3.

export type RequestLogOptions = {
  logger: Logger;
  /** Level of an ordinary completion line: `info` in production, `debug` where the framework already prints one. */
  level?: LogLevel;
  /** Paths whose lines drop to debug, such as static files and health checks. */
  isQuietPath?: (path: string) => boolean;
};

export type TracingOptions = {
  service: string;
  version: string;
  environment: string;
  /** Where finished spans go; none by default, and trace ids still exist for the logs. */
  exporter?: SpanExporter;
  /** Writes one completion line for each request the process serves. */
  requestLog?: RequestLogOptions;
};

export type Tracing = {
  /** Sends what is still buffered; call before a worker exits. */
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
};

const TRACER_NAME = 'carshenas';

function text(value: AttributeValue | undefined): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

// One line per request, written when the server's root span ends: the canonical log line (Stripe) or wide event,
// with method, route, status and duration, and the span's own trace id. Reads both the current HTTP semantic
// conventions and the older names Next.js still sets (http.method, http.target, http.status_code).
function requestLogProcessor(options: RequestLogOptions): SpanProcessor {
  return {
    onStart: () => undefined,
    onEnd(span: ReadableSpan) {
      // This runs inside the framework's span.end(): a failure here must never reach the request.
      try {
        writeRequestLine(span, options);
      } catch (error) {
        options.logger.warn('request line could not be written', { err: error, span: span.name });
      }
    },
    forceFlush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
}

function writeRequestLine(
  span: ReadableSpan,
  { logger, level = 'info', isQuietPath }: RequestLogOptions,
): void {
  if (span.kind !== SpanKind.SERVER) return;
  // Only the process's own root: a server span under a remote parent (a proxy's trace) counts, a nested one not.
  if (span.parentSpanContext && !span.parentSpanContext.isRemote) return;
  const { attributes } = span;
  const target = text(attributes['url.path'] ?? attributes['http.target']);
  const { path, query } =
    target === undefined ? { path: undefined, query: undefined } : readableTarget(target);
  const status = attributes['http.response.status_code'] ?? attributes['http.status_code'];
  const statusCode = typeof status === 'number' ? status : undefined;
  const { traceId, spanId } = span.spanContext();
  const fields = {
    trace_id: traceId,
    span_id: spanId,
    'http.request.method': text(attributes['http.request.method'] ?? attributes['http.method']),
    'url.path': path,
    'url.query': query ?? text(attributes['url.query']),
    'http.route': text(attributes['http.route'] ?? attributes['next.route']),
    'http.response.status_code': statusCode,
    duration_ms: Math.round(hrTimeToMilliseconds(span.duration) * 10) / 10,
    ...(attributes['next.rsc'] === true && { 'next.rsc': true }),
  };
  const lineLevel: LogLevel =
    statusCode !== undefined && statusCode >= 500
      ? 'warn'
      : path !== undefined && isQuietPath?.(path)
        ? 'debug'
        : level;
  logger[lineLevel]('request completed', fields);
}

/** Exports spans to the collector the standard OTEL_EXPORTER_OTLP_* variables name (endpoint, headers, timeout). */
export function otlpExporter(): SpanExporter {
  return new OTLPTraceExporter();
}

/**
 * Registers the process-wide tracer provider, context manager and W3C propagators. Call once at startup: in
 * Next.js from `register()` in instrumentation.ts, in a worker before its first job. Returns undefined, and changes
 * nothing, when another provider is already registered (a second call, or an SDK such as Sentry's that set one up).
 */
export function registerTracing(options: TracingOptions): Tracing | undefined {
  const spanProcessors: SpanProcessor[] = [];
  if (options.requestLog) spanProcessors.push(requestLogProcessor(options.requestLog));
  if (options.exporter) spanProcessors.push(new BatchSpanProcessor({ exporter: options.exporter }));
  const provider = new TracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.service,
      [ATTR_SERVICE_VERSION]: options.version,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: options.environment,
    }),
    spanProcessors,
  });
  if (!trace.setGlobalTracerProvider(provider)) return undefined;
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(
    new CompositePropagator({ propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()] }),
  );
  return {
    forceFlush: () => provider.forceFlush(),
    shutdown: () => provider.shutdown(),
  };
}

/**
 * Runs `work` inside a new active span, so its log lines share a trace id and a failure marks the span. For units
 * of work the framework does not trace itself: a crawl job, a page of a source, a model call.
 */
export function withSpan<T>(
  name: string,
  work: (span: Span) => Promise<T>,
  attributes?: Attributes,
): Promise<T> {
  return trace.getTracer(TRACER_NAME).startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await work(span);
    } catch (error) {
      span.recordException(isError(error) ? error : String(error));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
