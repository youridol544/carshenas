import { AsyncLocalStorage } from 'node:async_hooks';
import { Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { clearTimeout, setTimeout } from 'node:timers';
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
  type Span as SdkSpan,
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
  /** Paths whose lines drop to debug, such as static files and health checks, unless the answer is an error. */
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

// An http.Server request in flight (traceUntracedRequests): the root server span the framework started for it, if any,
// and whether its `request completed` line is written. One line per request, whichever way it ends.
type HttpRequest = { root?: SdkSpan; done: boolean };
const httpRequests = new AsyncLocalStorage<HttpRequest>();
const requestOfSpan = new WeakMap<ReadableSpan, HttpRequest>();
// The grace timer of a root span whose visitor left; cleared when the framework ends the span itself.
const abandonTimers = new WeakMap<ReadableSpan, ReturnType<typeof setTimeout>>();
// Set on a root span whose visitor left before the answer was complete.
const CLIENT_ABORTED = 'carshenas.client_aborted';

function isRootServerSpan(span: ReadableSpan): boolean {
  // The process's own root: a server span under a remote parent (a proxy's trace) counts, a nested one not.
  return (
    span.kind === SpanKind.SERVER && (!span.parentSpanContext || span.parentSpanContext.isRemote === true)
  );
}

// One line per request, written when the server's root span ends: the canonical log line (Stripe) or wide event,
// with method, route, status and duration, and the span's own trace id. Reads both the current HTTP semantic
// conventions and the older names Next.js still sets (http.method, http.target, http.status_code).
function requestLogProcessor(options: RequestLogOptions): SpanProcessor {
  return {
    onStart(span) {
      if (!isRootServerSpan(span)) return;
      const request = httpRequests.getStore();
      if (!request) return;
      request.root ??= span;
      requestOfSpan.set(span, request);
    },
    onEnd(span: ReadableSpan) {
      // This runs inside the framework's span.end(): a failure here must never reach the request.
      try {
        const timer = abandonTimers.get(span);
        if (timer) {
          clearTimeout(timer);
          abandonTimers.delete(span);
        }
        const request = requestOfSpan.get(span);
        // Its line is written already: the visitor left before the framework started this span.
        if (request?.done) return;
        if (request) request.done = true;
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
  if (!isRootServerSpan(span)) return;
  const { attributes } = span;
  const target = text(attributes['url.path'] ?? attributes['http.target']);
  const { path, query } =
    target === undefined ? { path: undefined, query: undefined } : readableTarget(target);
  const status = attributes['http.response.status_code'] ?? attributes['http.status_code'];
  const statusCode = typeof status === 'number' ? status : undefined;
  const fields = {
    'http.request.method': text(attributes['http.request.method'] ?? attributes['http.method']),
    'url.path': path,
    'url.query': query ?? text(attributes['url.query']),
    'http.route': text(attributes['http.route'] ?? attributes['next.route']),
    'http.response.status_code': statusCode,
    duration_ms: Math.round(hrTimeToMilliseconds(span.duration) * 10) / 10,
    ...(attributes['next.rsc'] === true && { 'next.rsc': true }),
    ...(attributes[CLIENT_ABORTED] === true && { clientAborted: true }),
  };
  // A quiet path that answered an error is not quiet: a chunk missing after a deploy is a 404 worth seeing.
  const lineLevel: LogLevel =
    statusCode !== undefined && statusCode >= 500
      ? 'warn'
      : path !== undefined && isQuietPath?.(path) && (statusCode === undefined || statusCode < 400)
        ? 'debug'
        : level;
  // Written inside the span's own context, so the logger stamps its trace ids as it does every other line of the
  // request, unaltered: passed as fields they would be scrubbed like any text.
  context.with(trace.setSpanContext(context.active(), span.spanContext()), () => {
    logger[lineLevel]('request completed', fields);
  });
}

const HTTP_HOOK = Symbol.for('carshenas.observability.untraced-requests');

export type UntracedRequestOptions = {
  /**
   * How long a request's span may stay open after its visitor left before the hook ends it itself (the framework ends
   * it earlier when its handler finishes). 10 seconds by default.
   */
  abandonedAfterMs?: number;
};

const DEFAULT_ABANDONED_AFTER_MS = 10_000;
const untraced = { abandonedAfterMs: DEFAULT_ABANDONED_AFTER_MS };

// http.Server's emit, typed as a property: the one in place (Node's, or another tool's wrapper) is kept and called with
// the server as `this`.
type RequestEmitter = {
  emit: (this: Server, event: string, ...args: unknown[]) => boolean;
  [HTTP_HOOK]?: true;
};

function traceAnswered(request: IncomingMessage, response: ServerResponse, startTime: number): void {
  trace
    .getTracer(TRACER_NAME)
    .startSpan(request.method ?? 'GET', {
      kind: SpanKind.SERVER,
      root: true,
      startTime,
      attributes: {
        'http.request.method': request.method ?? 'GET',
        'http.target': request.url ?? '/',
        // A client that left before any answer was sent gets no status, not Node's default 200.
        ...(response.headersSent && { 'http.response.status_code': response.statusCode }),
        ...(!response.writableFinished && { [CLIENT_ABORTED]: true }),
      },
    })
    .end();
}

/** When a request's connection closes: makes sure it has its line, and only one. */
function closed(
  state: HttpRequest,
  request: IncomingMessage,
  response: ServerResponse,
  startTime: number,
): void {
  try {
    if (state.done) return;
    if (state.root === undefined) {
      // The framework started no span (a static file), or has not yet (the visitor left first): a span of our own,
      // outside the request's context so it is not taken for the framework's. A span the framework starts later is
      // not logged again.
      state.done = true;
      httpRequests.exit(() => {
        traceAnswered(request, response, startTime);
      });
      return;
    }
    if (!response.writableFinished && !state.root.ended) {
      // The visitor left before the answer was complete. The framework usually ends its span once its handler is done,
      // with the route and status, so for now the span is only marked, with the status if one was sent. Next.js
      // 16.3.5 sometimes never ends it: a span still open after the grace period is ended here, so the request keeps
      // its line, and the framework's own end() later does nothing.
      const { root } = state;
      const leftAt = performance.now();
      root.setAttribute(CLIENT_ABORTED, true);
      if (response.headersSent) root.setAttribute('http.response.status_code', response.statusCode);
      const timer = setTimeout(() => {
        abandonTimers.delete(root);
        // Its duration ends when the visitor left, not when the grace period ran out.
        if (!root.ended) root.end(leftAt);
      }, untraced.abandonedAfterMs).unref();
      abandonTimers.set(root, timer);
    }
    // Otherwise the answer was sent in full, and the framework's span ends in a moment with the line.
  } catch {
    // Recording a request must never break serving it.
  }
}

/**
 * Gives every request an http.Server answers exactly one `request completed` line. A request the framework answered
 * without starting a root server span (Next.js serves /_next/static and public files before any traced code) gets a
 * span of its own, from its arrival to the close of its response; one whose visitor left before the answer was
 * complete gets its line marked `clientAborted`. Call after `registerTracing`; a second call only changes the options.
 * Node only.
 */
export function traceUntracedRequests(options: UntracedRequestOptions = {}): void {
  untraced.abandonedAfterMs = options.abandonedAfterMs ?? DEFAULT_ABANDONED_AFTER_MS;
  const prototype: RequestEmitter = Server.prototype;
  if (prototype[HTTP_HOOK]) return;
  prototype[HTTP_HOOK] = true;
  const { emit } = prototype;
  prototype.emit = function emitRequest(event, ...args) {
    if (event !== 'request') return emit.call(this, event, ...args);
    const [request, response] = args as [IncomingMessage, ServerResponse];
    const state: HttpRequest = { done: false };
    const startTime = performance.now();
    response.once('close', () => {
      closed(state, request, response, startTime);
    });
    return httpRequests.run(state, () => emit.call(this, event, ...args));
  };
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
