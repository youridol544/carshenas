# ADR-0016: Structured logs and error reporting in a shared package: pino behind our own logger, OpenTelemetry trace ids, no vendor yet

- Status: proposed
- Date: 2026-09-28
- Deciders: Pedrum
- Related: ADR-0003 (its deferred "monitoring" row, reopened here for logging and error reporting only), ADR-0004, ADR-0008; tasks CS-30, CS-6, CS-22, CS-23; `docs/research/2026-09-28-production-logging-and-error-reporting.md`; `docs/runbooks/logs-and-errors.md`

## Context

The owner asked on 2026-09-28 for production-grade, centralised logging before the crawler is built: a bug's root cause found in seconds, no external service for now, and Sentry or a telemetry backend easy to add later; the crawler worker must reuse the code. Before this, server code printed ad-hoc console lines, a production error reached the visitor as a digest nobody could look up, browser errors were lost, and stack traces pointed into minified bundles. Next.js 16.3 with Cache Components adds constraints of its own: `Date` in a render is dynamic input, `error.stack` is never source-mapped, and Next.js prints the errors it reports (research note, section 2).

## Decision

1. **`packages/observability`** (`@carshenas/observability`), the first `packages/*` workspace package, TypeScript source that Next.js bundles and Node runs directly (erasable syntax only), with subpath exports and no dependency on Next.js or React.
2. **One `Logger` interface, pino behind it.** Calls are `logger.info('snapshot stored', { listingId })`: a constant message, values in fields (lint enforces both). Output is one JSON object per line on stdout, synchronous (a killed process keeps its last lines), with level names, an ISO time from `performance.timeOrigin + performance.now()`, `service`, `version` (the git commit, stamped at build), `env`, `pid` and `hostname`; `pino-pretty` in-process in development. Before pino sees a line, every field is sanitised: errors serialised with their cause chain, AggregateError members and own primitive fields; secret-named fields replaced; credentials in URLs, bearer tokens, JWTs and Iranian mobile numbers in any digit script removed from every string; depth, size and cycles bounded. Stacks are mapped to the TypeScript source through the source maps Node loaded, with paths from the repository root so a file reads the same in every program's stacks and the browser's.
3. **OpenTelemetry for correlation.** `registerTracing` sets the provider, context manager and W3C propagators by hand on `@opentelemetry/sdk-trace` (the SDK 3 way). Every line inside a request or job gets `trace_id`, `span_id` and `trace_flags`. Each request writes one `request completed` line (method, path, query, route, status, duration) from Next.js's root span. No span leaves the process unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
4. **Errors.** Expected failures stay return values (ADR-0004). An unexpected error is either thrown (Next.js calls `onRequestError`, which writes one `request failed` line with the route, method, path and digest as the reference code, and skips Next.js's control-flow errors) or passed to `captureError`, which logs it and hands it to every `ErrorReporter` (Sentry is one adapter). A Route Handler is wrapped in `withErrorReference`, which logs the error with a new reference and answers 500 with a Farsi message and that reference (Next.js's own answer has neither). The visitor sees only the Farsi error screen or message and «کد پیگیری». In production, console output becomes JSON too, except Next.js's own print of an error it reported.
5. **Browser errors** reach the same log: `instrumentation-client.ts` reports uncaught errors and rejections, the error screens report what their boundary caught, and `/api/client-errors` accepts only same-origin, bounded, valid reports, at most 30 a minute and one per bug a minute per process, symbolicated with the build's browser source maps. A build step (`compiler.runAfterProductionCompile`) moves those maps out of the served folder, and, because the React Compiler's maps point at its own output, records which line of our file each compiled line came from.
6. **Workers** use the same package plus `installProcessHandlers` (fatal line, then exit with 1) and `withSpan`/`withLogContext` for job-wide fields.

## Alternatives considered

- **Sentry or a hosted log store now**: ruled out by the owner for now, and reachability from Iran and sanctions are unverified; the seams above take either later.
- **pino exposed directly** (formbricks, Payload): no constant-message rule, pino's merge of its own `err` serializer and path-only redaction apply; our interface is small and keeps the engine replaceable.
- **LogTape, winston, tslog, a console wrapper**: fewer integrations (Sentry's `pinoIntegration`, OpenTelemetry's pino instrumentation) or no structured output at all.
- **pino transports (worker threads)**: the most frequent breakage under bundlers (formbricks, Payload, Next.js #86884).
- **`@vercel/otel` or `@opentelemetry/sdk-node`**: the first is tied to SDK 2 and Vercel's defaults, the second pulls far more than tracing needs.
- **Our own request id through the proxy**: cannot reach Server Components' context; OpenTelemetry's does.
- **A proxy that refuses `.map` requests** (the first version): it guards only requests that reach Next.js, not a CDN or web server serving `.next/static` itself, and it made every request pass through a proxy.
- **Browser source maps off**: browser stacks would name minified chunks, the opposite of the goal.

## Consequences

- Positive: one search by `trace_id` or reference code finds everything a request did; stacks name files and lines we wrote; nothing leaves the machine; Sentry and any OpenTelemetry backend are configuration and one adapter (runbook); the crawler starts with the same logger.
- Negative / risks: a wrapper and a sanitiser to maintain; Next.js's startup banner stays plain text; a streamed page that fails is sent as 200 with `noindex` (its log line says 500); the intake's limit is per process until CS-23 settles which proxy header can be trusted; the dedupe of Next.js's error print depends on its internal function names (a rename means a duplicate line, never a lost one); lines the React Compiler moved are placed back by their text, and a line that cannot be placed is shown as compiled code, marked so; OpenTelemetry SDK 3 needs Node.js 22.15 or later.
- Follow-ups: CS-6 logs through the package and adds drain-then-exit on SIGTERM; CS-22 runs the e2e spec in CI; CS-23 decides log retention on the host and the proxy header; an ADR before any Sentry, self-hosted Sentry or log store.
