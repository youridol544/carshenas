# How should Carshenas log and report errors, in a Next.js 16 app and a Node.js worker, so a bug's root cause is found in seconds?

- Date: 2026-09-28
- Asked by / for: Pedrum, for CS-30: "I want a production grade logging system, centralized, easily integratable with telemetry services and things like sentrt", "later when we have crawler, I want to use this code in crawler too", and "the goal is to find the root cause of a bug in seconds, however we want no external sevice like sentry for now, but our system must easily be integrated for best results with those."
- Outcome: ADR-0016 (proposed); `packages/observability` and its wiring in `apps/web` (CS-30); `docs/runbooks/logs-and-errors.md`; the `observability.md` rule pack.

## Questions

1. How do the best-run open-source TypeScript and Next.js codebases log and report errors, and what went wrong for them?
2. What does Next.js 16.3 (App Router, Turbopack, Cache Components) offer and forbid: hooks for server and browser errors, what a visitor sees, stack traces, bundling of a logging library?
3. Which logging engine, and how exactly: output, durability on a crash, redaction, error serialisation, pretty output in development?
4. How do log lines get a trace id per request and job without a tracing vendor, and how does a vendor plug in later (OpenTelemetry, Sentry)?
5. How does the same code serve the crawler worker, a plain Node.js process?

## Method

Two research passes on 2026-09-28, then hands-on checks while building:

- **Repositories**: the source of next-forge, formbricks, cal.com (now cal.diy), Payload, midday, documenso, dub, unkey, trigger.dev, Infisical, langfuse and sentry-javascript, read with `gh` and `curl` at the commits named below; every link returned HTTP 200 on the day.
- **Libraries**: pino 10, pino-pretty 13, OpenTelemetry JS 2.11 and its 3.0 plan, @vercel/otel 2.1, @sentry/nextjs 11.0; versions from `npm view`, behaviour from their docs and from scripts run on Node 22.14 (a crash test of pino destinations, redaction depth, serializer output, a provider without an exporter, OTLP export to a local receiver), and a pnpm workspace built with Next.js 16.3.5 where only a workspace package depends on pino.
- **Next.js itself**: the version-matched docs in `apps/web/node_modules/next/dist/docs/` and the compiled source of 16.3.5 (`dist/server/...`), read to answer what the docs leave open.
- **Checks while building**: `node:test` suites run by Node alone, Vitest, production builds with Turbopack, and `e2e/tests/app/observability.spec.ts`, which starts its own production server and compares each failure on screen with the log.

Anything not checked is marked UNVERIFIED.

## Sources

Practitioners and specifications:

- Brandur Leach, "Fast and flexible observability with canonical log lines", Stripe, 2019-07-30, https://stripe.com/blog/canonical-log-lines — the canonical log line, from the team that runs it at Stripe's scale.
- Charity Majors, "Is It Time To Version Observability? (Signs Point To Yes)", 2024-08-07, https://charity.wtf/2024/08/07/is-it-time-to-version-observability-signs-point-to-yes/ — Honeycomb's co-founder on wide events as the source of truth.
- Boris Tane, "Logging Sucks - Your Logs Are Lying To You", 2025-12-21 (date from boristane.com), https://loggingsucks.com/ — a practitioner's argument for one wide event per request or job and for sampling after the outcome is known; his role was not checked.
- Dave Pacheco, "Error Handling in Node.js", Joyent, 2014-03-28, https://www.davepacheco.net/blog/2014/error-handling-nodejs/ — the operational-versus-programmer-error distinction Node.js practice still uses.
- Matteo Collina (pino's author), "Welcome to pino@7.0.0 - and the era of worker_thread transport", Nearform, 2021-10-14, https://nearform.com/insights/pino7-0-0-pino-transport-worker-thread-transport/ — why an app should just write to stdout.
- OpenTelemetry, "Trace Context in non-OTLP Log Formats" (Stable), https://opentelemetry.io/docs/specs/otel/compatibility/logging_trace_context/; "Logs Data Model" (Stable), https://opentelemetry.io/docs/specs/otel/logs/data-model/; "Semantic conventions for exceptions in logs", https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/ — the field names.

Libraries and frameworks:

- Next.js 16.3.5 bundled docs: `01-app/03-api-reference/03-file-conventions/instrumentation.md`, `instrumentation-client.md`, `error.md`, `proxy.md`; `01-app/02-guides/open-telemetry.md`, `streaming.md` ("The HTTP contract"); `05-config/01-next-config-js/serverExternalPackages.md`, `transpilePackages.md`, `productionBrowserSourceMaps.md`, `logging.md`.
- Next.js 16.3.5 source: `dist/server/node-environment-extensions/{date,console-exit,io-utils}.js`, `dist/server/patch-error-inspect.js`, `dist/server/lib/router-utils/instrumentation-node-extensions.js`, `dist/server/route-modules/route-module.js`, `dist/server/next-server.js`, `dist/server/app-render/create-error-handler.js`, `dist/lib/server-external-packages.jsonc`.
- Next.js PR #86884 (pino and thread-stream external by default, merged 2025-12-05), https://github.com/vercel/next.js/pull/86884; issue #86099, https://github.com/vercel/next.js/issues/86099.
- pino: release 10.0.0, https://github.com/pinojs/pino/releases/tag/v10.0.0; `docs/api.md`, `docs/redaction.md`, `docs/bundling.md`, `docs/diagnostics.md`, `docs/transports.md` in https://github.com/pinojs/pino; pino-std-serializers `lib/err.js`.
- OpenTelemetry JS: `doc/upgrade-to-2.x.md` and `doc/3.x/migration-guide.md` in https://github.com/open-telemetry/opentelemetry-js; @opentelemetry/instrumentation-pino README, https://www.npmjs.com/package/@opentelemetry/instrumentation-pino.
- Sentry: Next.js manual setup, https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/; custom OpenTelemetry setup, https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/custom-setup/; `MIGRATION.md` for v11 and `packages/nextjs/src/common/captureRequestError.ts` and `packages/node/src/integrations/pino.ts` at 954e969 in https://github.com/getsentry/sentry-javascript.

Repositories (commit read):

- vercel/next-forge `packages/observability` (f189de7), formbricks `packages/logger` (736e35a) with PRs #7251, #7510, #8319, #8744, #8725 and #8770, calcom/cal.diy `packages/lib/logger.ts` (54343aa), payloadcms/payload `utilities/logger.ts`, `logError.ts`, `routeError.ts` (124b55a), midday-ai/midday `packages/logger` (5158731), documenso (a1d4bec), dubinc/dub `lib/axiom` (21c57ae), unkeyed/unkey `pkg/logger` (e1a963a), triggerdotdev/trigger.dev `packages/core/src/logger.ts` (c2b7a72, redaction default since PR #4401), Infisical `backend/src/lib/logger` (e008b8c), langfuse `packages/shared/src/server/logger.ts` and `processErrorHandlers.ts` (e0a2735, PR #16996).

## Findings

### 1. What the best codebases do, and what hurt them

- **One logger package shared by the web app and the workers** is the norm where both exist (langfuse, midday, formbricks); langfuse's is exactly our shape, a package used by a Next.js app and a separate worker.
- **JSON on stdout in production, pretty output only in development** (formbricks, cal.com, Payload, midday). Collina: the application "should just log to stdout", shipping happens elsewhere.
- **The error as a field**, serialised with its cause chain, not flattened into the message: next-forge and cal.com flatten errors into strings (cal.com's `safeStringify` keeps only `stack ?? message`), losing causes and fields.
- **Expected and unexpected errors split** (formbricks, Payload, cal.com, unkey): expected ones are logged at info or warn with a public message; unexpected ones at error, reported, and shown with a generic message. next-forge and cal.com return `error.message` to users in places.
- **A code the user can quote**: midday's global error screen shows `Error ID: {error.digest}`; cal.com returns an `X-Trace-Id` header.
- **Trace ids on every line** (formbricks, langfuse, trigger.dev), from OpenTelemetry.
- **Redaction inside the logger**: key lists, value patterns and size caps (trigger.dev), pino paths expanded per depth (Infisical), URL sanitising (Infisical). dub logs request bodies unredacted.
- **Worker-thread transports break under bundling**: formbricks needed six pull requests (a crash on custom level formatters, pino-pretty's worker exiting under Turbopack, transport targets not found in the standalone image, logs exported twice, handlers accumulating per bundled copy), Payload documents "unable to determine transport target", and Next.js itself added pino to its default externals (#86884).
- **Fatal handlers must exit**: formbricks' `uncaughtException` handler logs and flushes but never exits, which the Node.js docs call unsafe; langfuse drains in-flight work, then exits (PR #16996, after a container died on an unhandled error). Pacheco: for programmer errors, crash and let the supervisor restart.
- **One wide event per request** (Stripe, Majors, Tane; unkey's Go logger emits one entry per request); midday writes two lines per request with the values inside the message text.

### 2. Next.js 16.3.5: the hooks, and six traps

- **Hooks.** `register()` in `instrumentation.ts` runs once per server before the first request; `onRequestError(error, request, context)` receives every server error with the route path, the route type (`render`, `route`, `action`, `proxy`) and the render source. `instrumentation-client.ts` runs in the browser after the HTML loads and before hydration.
- **What a visitor sees.** In production a Server Component error reaches `error.tsx` with a generic message and a `digest`, "to match the corresponding server-side logs" (error.md). The digest is a hash of the message and stack (`create-error-handler.js`), so one bug keeps one code.
- **Trap 1, the clock.** With Cache Components, Next.js wraps `Date` so that `Date.now()` and `new Date()` inside a prerender count as dynamic input (`date.js`, `io-utils.js`); its own comment reserves `Date` for output and `performance` for introspection. pino's default timestamp reads `Date.now()`, so a line written while a page renders could abort or error the render. Next's span store stamps time with `performance.timeOrigin + performance.now()`.
- **Trap 2, stacks.** Next.js sets `Error.prepareStackTrace` so `error.stack` is never source-mapped, even under `--enable-source-maps` (`patch-error-inspect.js`); it maps only when it prints an error. Measured on Node 22.14: with a custom `prepareStackTrace`, the stack stayed unmapped with the flag, with `process.setSourceMapsEnabled(true)` and with neither, while `module.findSourceMap()` returned the original position in the first two cases and nothing in the third.
- **Trap 3, double printing.** In production Next.js prints every error it hands to `onRequestError`: before calling the hook in `route-module.js`, after it in `next-server.js`. It also prints errors it never hands to the hook (a failure while rendering its own error page). Deduplication by timing is unreliable; the call path is not.
- **Trap 4, control flow.** `redirect()`, `notFound()` and dynamic bailouts are thrown errors with digests starting `NEXT_REDIRECT`, `NEXT_HTTP_ERROR_FALLBACK`, `DYNAMIC_SERVER_USAGE`, `NEXT_PRERENDER_INTERRUPTED`, `HANGING_PROMISE_REJECTION`, `BAILOUT_TO_CLIENT_SIDE_RENDERING`; Sentry's `captureRequestError` skips the same set.
- **Trap 5, the Edge build.** Next.js compiles `instrumentation.ts` for the Edge runtime too and removes Node-only imports only behind a literal `process.env.NEXT_RUNTIME` check; behind a getter it compiled pino and the tracer into the Edge build (warnings in `next build`, 72 compile errors in `next dev`).
- **Trap 6, output tracing.** A `path.join` from `process.cwd()` in server code made `next build` warn that the whole project would be traced into the output.
- **Status codes.** A page that streams has sent 200 before it can fail; a later `notFound()` or error keeps 200 and adds `noindex` (streaming.md, "The HTTP contract"). Measured: `/diagnostics/[failure]`, built as a partial prerender (◐) even with `instant = false`, answered 200 for both. Next.js's request span then records `res.statusCode` as 500, which the completion line reports. A Route Handler error answers a real 500.
- **Bundling pino.** Next.js 16.3.5 externalises `pino`, `pino-pretty` and `thread-stream` by default and, since 16.1, resolves them when only a workspace package depends on them (the pnpm lab built and ran; Payload's source comment says otherwise for older versions).
- **Browser source maps.** `productionBrowserSourceMaps` writes maps next to the chunks and Next.js serves them. Turbopack gives each map its own hashed name: `23-cxwomf0no7.js` ends with `//# sourceMappingURL=3y_lez0yndito.js.map`.
- **Browser errors.** Next.js reports hydration mismatches and errors that reach the root through `window.reportError`, so they arrive as `error` events; an error an explicit boundary catches is only printed to the browser console (`error-boundary-callbacks.js`), so the boundary must report it itself.

### 3. pino 10 as the engine

- pino 10.3.1 (2026-02-09) and pino-pretty 13.1.3 ship their own types; 10.0.0 only dropped Node.js 18.
- **Durability**: the default destination is asynchronous. In a crash test of 20,000 lines on a pipe, SIGKILL left 1 line with the default, 41 with `minLength: 4096`, and all 20,000 with `pino.destination({ dest: 1, sync: true })`; an exit or an uncaught throw kept all of them in every mode.
- **Serializers**: pino always merges its default `err` serializer into the options; it treats an already serialised error as a new one (type `Object`), flattens causes into the message in `err` and names AggregateError members `aggregateErrors`; only the `err` key is serialised.
- **Redaction**: path based, one level per wildcard (`*.password` misses `a.b.password`), no value patterns; `hooks.streamWrite` rewrites the final text but runs after the diagnostics channel Sentry listens on.
- **Pretty output** works as an in-process stream (`pretty({ sync: true })`), with no worker thread.
- Duplicate keys: a child binding and a call field with the same name are both written.
- In the browser pino offers no redaction; it adds little over a small reporter.

### 4. OpenTelemetry without a vendor

- A tracer provider with no span processor still creates recording spans with random 32- and 16-hex ids, carried across `await` by the AsyncLocalStorage context manager; with no provider, span contexts are all zeros, so a logger must check `isSpanContextValid`.
- Registering a provider makes Next.js create its own spans: the root `GET /route` span carries method, target, status and route (`base-server.js`), and Next.js extracts an incoming `traceparent`. Next.js wraps the provider's tracers so span creation leaves the prerender store.
- Field names for trace context in JSON logs: `trace_id`, `span_id`, `trace_flags` (Stable). instrumentation-pino injects the same by patching modules, which depends on load order inside a bundler (UNVERIFIED inside Next.js).
- **SDK 2 to 3**: `@opentelemetry/sdk-trace` (2.9.0) replaces sdk-trace-base, -node and -web; SDK 3 removes those and `NodeTracerProvider#register()` and needs Node.js 22.15 or later. Setting the global provider, context manager and propagators by hand works on 2.11 and 3.
- `@opentelemetry/exporter-trace-otlp-http` reads `OTEL_EXPORTER_OTLP_*` itself; verified against a local receiver, from the package and from the app.
- `@vercel/otel` bundles the SDK and peers on `sdk-trace-base` 2, so it is not ready for SDK 3.

### 5. Sentry later

- `@sentry/nextjs` 11.0.0 (2026-09-23): `register()` loads its server config, `onRequestError = Sentry.captureRequestError`, `instrumentation-client.ts` runs `Sentry.init`, `global-error.tsx` calls `captureException`, `withSentryConfig` moved to `@sentry/nextjs/config`, `tunnelRoute` requests now pass through the proxy.
- With our own OpenTelemetry provider: `enableOpenTelemetrySetup: false`, `Sentry.openTelemetryIntegration()`, and an OTLP exporter to `Sentry.getOtlpTracesEndpoint(dsn)`; `SentrySpanProcessor`, `SentrySampler` and `skipOpenTelemetrySetup` are gone in v11.
- `pinoIntegration` subscribes to pino's `tracing:pino_asJson` diagnostics channel (pino 9.10 or later); it sees what the logger passed to pino, so redaction must happen before pino. Use it or an error reporter for errors, not both, or each error is sent twice.
- v11 collects cookies, headers, request bodies and user details by default; the `dataCollection` option must be set.
- Reachability from Iran is UNVERIFIED; a self-hosted Sentry or a Sentry-compatible server (GlitchTip) is the fallback AGENTS.md requires, decided in its own ADR.

### 6. Measured on the build

The e2e spec's server wrote, for a page that threw (abridged):

```json
{"level":"error","time":"2026-09-28T08:36:40.287Z","service":"carshenas-web","version":"55b96cb88a3c-dirty","env":"production","trace_id":"f5d31e7af82a4c5721c28858b5bc12d8","span_id":"ffb0c9d3137ea979","next.route_path":"/diagnostics/[failure]","next.route_type":"render","reference":"880208148","http.request.method":"GET","url.path":"/diagnostics/server-render","err":{"type":"Error","message":"diagnostic failure on purpose: postgres://diagnostic:[redacted]@db/carshenas, seller [redacted]","stack":"Error: …\n    at i (src/app/diagnostics/[failure]/page.tsx:20:46)\n    …","digest":"880208148"},"msg":"request failed"}
```

followed by its completion line (`warn`, status 500, 251.6 ms, same `trace_id`); the visitor's screen showed «کد پیگیری: ۸۸۰۲۰۸۱۴۸» and nothing of the message. A browser render error arrived as one `browser error` line with the screen's reference and a stack mapped to `apps/web/src/features/diagnostics/components/browser-failures.tsx`.

## Recommendation

Build what ADR-0016 records: a workspace package, run as TypeScript source by Next.js and by Node alone, with our own message-first `Logger` over pino (synchronous JSON to stdout, a `performance`-based clock, our own redaction and error serialisation before pino sees anything), OpenTelemetry for trace ids with no exporter unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set, one completion line per request from Next.js's root span, an `ErrorReporter` seam for Sentry, and in the web app `onRequestError`, a reference code on the error screens, a same-origin browser intake with source-mapped stacks, and console output turned into JSON in production.

Trade-offs accepted: a thin wrapper over pino to maintain; the Next.js startup banner stays plain text; a streamed page that fails is sent as 200 (the log says 500); the request line for a response the proxy writes itself shows Next.js's internal status; the browser intake rate-limits per server process, not per visitor, until the host (CS-23) says which proxy header can be trusted.

What would change it: pino dropping synchronous destinations or the diagnostics channel; Next.js exposing mapped stacks or a request log hook; a hosted log store reachable from Iran, which would add a shipper but not change the code; volume high enough to need tail sampling (Tane, unkey), which belongs in the collector.
