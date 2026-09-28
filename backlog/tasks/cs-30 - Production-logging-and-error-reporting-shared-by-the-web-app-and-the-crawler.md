---
id: CS-30
title: Production logging and error reporting shared by the web app and the crawler
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 07:25'
updated_date: '2026-09-28 09:00'
labels:
  - infra
  - backend
  - dx
milestone: m-1
dependencies: []
references:
  - docs/research/2026-09-28-production-logging-and-error-reporting.md
  - docs/decisions/0016-structured-logs-and-error-reporting.md
documentation:
  - docs/runbooks/logs-and-errors.md
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner wants production-grade, centralised logging in place before the crawler (CS-6) is built (request of 2026-09-28). The goal is to find the root cause of a bug in seconds from one search of the logs. Today server code writes ad-hoc console lines ([db], [health], [sql]); nothing is structured or correlated; a production server error reaches the visitor as a generic page whose digest nobody can look up; browser errors are lost; production stack traces point into minified bundles.

No external service is used for now: no Sentry SaaS and no hosted log store, because reachability from Iran and sanctions make each one an ADR of its own. The design must still let Sentry (or a self-hosted Sentry-compatible server) and any OpenTelemetry backend plug in later without touching calling code. The crawler worker is a plain Node.js process, so the logging code cannot depend on Next.js.

ADR-0003 deferred monitoring until "a real user on a real network"; the owner's request reopens it for logging and error reporting only. Metrics, alerting and log storage stay deferred (hosting is CS-23).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shared workspace package provides structured logging, error serialisation and trace correlation, and runs in a plain Node.js process without Next.js or a bundler, proven by its own tests run with Node alone
- [ ] #2 In production every log line the server writes is one JSON object with ISO time, level name, message, service, version and environment, and lines written during a request carry its trace and span ids; development prints the same events in readable form
- [ ] #3 Logged errors keep their type, message, stack, cause chain and AggregateError members, and secrets, passwords in connection strings and Iranian mobile numbers are redacted from logged fields and messages, proven by unit tests
- [ ] #4 An unexpected error in a page, a Route Handler or a Server Action writes one structured error event with the route, method, path and a reference code, while the visitor sees only the Farsi error screen with that reference code and never the message or stack, proven against a production build
- [ ] #5 A browser error (uncaught, an unhandled rejection or one caught by an error boundary) reaches the server log with its reference code, page path and browser, and the intake refuses oversized or malformed reports and caps how many it logs
- [ ] #6 Each request writes one completion line with method, route, status and duration that shares its trace id with every other line of that request
- [ ] #7 Stack traces in production logs point to the original TypeScript files and lines
- [ ] #8 Server code cannot call console directly (lint), and the existing database and health-check logging goes through the logger without logging query parameters in production
- [ ] #9 An ADR records the design, and a runbook shows how to read and search the logs, how to raise the level, and the exact steps to add Sentry or an OpenTelemetry backend; setting the standard OTLP endpoint variable exports traces with no code change
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research (cited note in docs/research) and ADR-0016 (proposed): pino as the engine behind our own Logger interface; OpenTelemetry API for trace context; Next.js hooks (register, onRequestError, instrumentation-client); no vendor now, Sentry and OTLP as adapters.
2. packages/observability (@carshenas/observability), the first packages/* workspace package: TypeScript source run directly by Turbopack and by Node (type stripping), erasable syntax only. Modules: redact (sensitive keys, credentials in URLs, bearer tokens, JWTs, Iranian mobile numbers in any digit script), errors (type, message, stack, cause chain, AggregateError, own primitive props, cycles and depth capped), logger (message-first Logger over pino: level labels, ISO time from performance.timeOrigin + performance.now() so Cache Components prerendering never sees Date, base service/version/env, trace_id/span_id and log context mixed in, sync stdout JSON or pino-pretty stream), context (AsyncLocalStorage log fields), tracing (NodeTracerProvider, no exporter unless an OTLP endpoint is configured, withSpan, one completion line per server span), capture (captureError + ErrorReporter seam for Sentry), console (route console to the logger), process (fatal handlers for the worker), browser (client reporter: dedupe, cap, sendBeacon). Tests with node:test run by Node alone.
3. Web app: src/server/observability (logger instance from env.ts, register-node, request-error mapping for onRequestError, browser intake with size cap, validation, rate cap and dedupe, client stack symbolication from the build's browser source maps); src/instrumentation.ts and src/instrumentation-client.ts; error.tsx and global-error.tsx show a Farsi reference code (digest, or a client reference) and report client-side errors; source-mapped server stacks; database.ts and database-health.ts through the logger (slow queries warn, parameters only in development); no-console lint.
4. Env-gated diagnostics routes (CARSHENAS_DIAGNOSTICS=1) that fail on purpose, and an e2e spec that starts its own production server, captures its stdout and proves AC 2 to 7 end to end.
5. Runbook docs/runbooks/logs-and-errors.md (reading, searching with jq, levels, verifying a deploy, adding Sentry or an OTLP backend), rule pack .claude/rules/observability.md, AGENTS.md map line, learnings.
6. pnpm check, pnpm e2e, verify-ui evidence for the error screens, design-reviewer and task-reviewer passes, then In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Slice 1 (2026-09-28): packages/observability, the first packages/* workspace package, run as TypeScript source by Node (type stripping) and later by Turbopack. Modules: redact, errors, fields, logger (pino behind our Logger interface; synchronous stdout; time from performance.timeOrigin + performance.now(), never Date, because Cache Components treats Date in a prerender as dynamic input), context, tracing (@opentelemetry/sdk-trace with the globals set by hand, which SDK 3 keeps; completion line per server root span), capture (ErrorReporter seam), console, process, browser. pino always merges its default err serializer, so an identity one replaces it. 61 node:test tests run by Node alone, two of them in child processes (a crashing worker; a span exported only through OTEL_EXPORTER_OTLP_ENDPOINT). Root lint, typecheck and test now include packages/*.

Slice 2 (2026-09-28): stack.ts maps each stack frame to its original file, line and column through Node source maps (findSourceMap for loaded modules; any SourceMap lookup for browser stacks), with frame names taken from the caller's call site as Node does. Measured on Node 22.14: Next.js sets Error.prepareStackTrace, so error.stack stays unmapped even with --enable-source-maps, while findSourceMap works once source maps are enabled (the flag, or process.setSourceMapsEnabled(true) before the code loads) and returns nothing otherwise. The logger maps every serialised error. Console routing and process handlers install once per process (Symbol.for flag), since Next.js may load the package in several module graphs.

Slice 3 (2026-09-28): the web app. src/instrumentation.ts (register, onRequestError; reads process.env.NEXT_RUNTIME itself so Next.js drops the Node-only imports from the Edge build, with a lint exemption narrowed to that variable), src/instrumentation-client.ts (browser reporting before hydration), src/server/observability (logger and captureError on globalThis; register-node: setSourceMapsEnabled, tracing with a completion line per request, console routed to JSON in production except Next.js's own print of an error it hands to onRequestError, recognised by its call path; request-error: one "request failed" line with route, method, path, query without _rsc, digest as reference, browser; Next.js control-flow digests skipped as Sentry does; browser-errors intake: same-origin, 16 KiB, zod schema, 30 a minute and one per bug a minute, stacks symbolicated from the build's browser maps), src/proxy.ts refusing /_next/static/**.map, error.tsx and global-error.tsx showing «کد پیگیری» in Persian digits and reporting client errors, next.config.ts stamping the release (commit, -dirty) and writing browser source maps, database.ts and database-health.ts through the logger (slow statements warn; failed statements debug; parameters only in development), no-console and constant log messages enforced by lint with self-test samples. Dev-server incident: the owner's next dev, started under my first instrumentation.ts draft, failed instant validation with "Cannot access moduleLoading without a work store" on every load; fresh servers with the same code never did (checked with repeated reloads, mid-run edits and the old cache), and a restart cleared it.

Slice 4 (2026-09-28): diagnostics routes (features/diagnostics, app/diagnostics/[failure], app/api/diagnostics), not-found unless CARSHENAS_DIAGNOSTICS=1, and e2e/tests/app/observability.spec.ts, which starts its own production server with a local OTLP collector and checks screen against log: 9 of 9 pass. Found while running it: (1) Turbopack names a browser chunk's map with its own hash, so the intake follows the chunk's sourceMappingURL comment; (2) the diagnostics page is built as a partial prerender (◐) even with instant = false, so a not-found or an error on it is sent with status 200 and noindex (the bundled streaming guide, "The HTTP contract"), while the completion line records 500; the next-app-router rule's real-404 recipe did not give a 404 here, which CS-17 should verify in the browser suite; (3) a request the proxy answers itself is logged with the status of Next.js's internal proxy call; (4) ActionLink needed Link<T> once the app had its first dynamic route.

Slice 5 (2026-09-28): docs. Research note docs/research/2026-09-28-production-logging-and-error-reporting.md (both passes, labs, the e2e log sample), ADR-0016 (proposed), runbook docs/runbooks/logs-and-errors.md (its jq recipes were run against the e2e server log), rule pack .claude/rules/observability.md, AGENTS.md map row and Logging convention (144 lines), index rows, example.env, five learnings; hand-off notes on CS-6 and CS-17. Stack names: a caller's call-site name is used only when the caller is our code (React's variable names such as Component misled), and a minified generated name is dropped. UI evidence: error screen at 412 and 1440 px on a production build, craft checks clean (no overflow or shift, targets ok, text-secondary 14px/1.6, proportional code digits, one hue); browser-error variant showed ۳۳۲۵۳۳۷۴۷۱ and the log the same reference.

Design review (design-reviewer agent, 2026-09-28): measured pass on bidi order (label, colon, then the code reading left to right), Persian digits, text-secondary 14px/1.6 in text-muted at 6.52:1, 48 px targets, no overflow at 320/412/1440 px, layout shift 0, visible focus ring, axe 0 violations on both variants, one tap selects exactly the code. One fix, applied: lang="en" on the Persian-digit code made screen readers read it in English; the span is dir="ltr" alone, and design-language.md section 6 now says lang="en" only for Latin text (its own phone sample already did this). «کد پیگیری» added to the glossary. The e2e spec now runs expectDocumentRtl, expectPersianDigits, expectNoHorizontalOverflow and a11y.check on the error screen. Left for the owner: the term («کد پیگیری» or «شناسه‌ی خطا»), the large «۵۰۰» outranking the code (and not true for a browser error), behaviour on real phones and TalkBack; pre-existing and out of scope: focus falls to the body after a browser error replaces the page (craft.md I-31).
<!-- SECTION:NOTES:END -->
