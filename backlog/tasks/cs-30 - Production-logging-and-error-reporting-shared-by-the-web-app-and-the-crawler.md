---
id: CS-30
title: Production logging and error reporting shared by the web app and the crawler
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 07:25'
updated_date: '2026-09-28 11:52'
labels:
  - infra
  - backend
  - dx
milestone: m-1
dependencies: []
references:
  - docs/decisions/0003-bare-minimum-nextjs-16-and-react-19.md
  - docs/decisions/0004-frontend-structure-and-enforcement.md
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

Review round 1 (2026-09-28), every finding fixed rather than reworded:
(1) AC 7: with the React Compiler, a client component's browser map points at the compiler's output, so browser frames were off by 3 to 18 lines. A runAfterProductionCompile step (apps/web/scripts/browser-source-maps.mjs) records which line of our file each compiled line came from; browser frames now start at browser-failures.tsx:12, :28 and :37, the lines that threw (e2e).
(2) AC 4: a Route Handler error answered an empty 500 with no reference. withErrorReference, required by lint on every method a route.ts exports, answers 500 with a Farsi message and a reference that its log line carries (unit and e2e).
(3) Map privacy: the proxy guarded only requests that reached Next.js. The build step moves every browser map to .next/browser-source-maps, which is never served; the proxy is removed; the e2e spec checks that .next/static holds no .map and that the server still maps.
(4) AC 3 redaction gaps, a path of two slashes answering 500, captureError throwing: fixed in commit 1a94942.
(5) Stack paths read from the repository root everywhere (server frames read src/..., browser frames apps/web/src/..., a shared-package frame ../../packages/...): logger option sourceRoot.
(6) pnpm check: the PGlite schema tests passed their 10 s setup limit in 2 of 3 runs because the new package's node:test suite ran beside Vitest on 8 CPUs; the workspace suites now run one after the other (3 of 3 runs pass). No timeout raised.
(7) Runbook: digits converted with jq in any locale; CARSHENAS_RELEASE is read by next build; Node refuses to strip types under node_modules (checked: ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING); Sentry's map upload shares the build hook; standalone deployments copy .next/browser-source-maps.
Evidence: pnpm check exit 0 (74 package tests, 143 web tests); pnpm e2e 95 passed, 13 skipped by design, 0 failed; the observability spec 9 of 9.

Review round 2 (2026-09-28), every finding fixed:
(1) CI WebKit: the spec skips by project name in beforeAll, so it runs only in the mobile project and no other project starts a server for skipped tests.
(2) AC 7, React Compiler: placing lines by their text found 2 of 55 lines in global-error.tsx, because the compiler reprints strings and JSX. The build step now runs Next.js's own compiler step (getReactCompilerLoader through its Babel loader transform) on each compiled file with source maps on; all 9 compiled files of the build came back byte for byte, and the server follows Turbopack's map, then Babel's. A unit test runs the real step on a component with a string-literal throw and JSX (line 7 column 28, line 10). A file that does not reproduce is marked (compiled) and the build warns.
(3) AC 7, awaited frames: at async <file> was read with async in the file name; now mapped (the Route Handler's wrapper frame reads route-errors.ts:26), and the spec asserts no .next/server frame is left. Browser dependency frames read node_modules/<package>/.
(4) AC 6, trace ids: the completion line takes its ids from the span's context, and the phone pattern never matches next to a Latin letter or digit or inside a UUID: 0 of 3,000,000 random trace ids, span ids and UUIDs changed (430 of 2,000,000 trace ids before).
(5) AC 6, static files: a hook on http.Server emit gives a request Next.js answers before any traced code its own span and line; a static 4xx logs at info. e2e: a served chunk at debug with 200, a missing chunk at info with 404.
(6) AC 3: key=value and JSON pairs whose key names a secret or personal data (password=, PGPASSWORD=, "access_token":), URL passwords with an unescaped @, phone numbers with brackets or dots; phones are removed before pairs, so phone=0912 123 4567 goes whole.
(7) Low: route lint catches export { handler as GET } and destructured exports; the wrapper uses unstable_rethrow while onRequestError keeps the digest check (a failure wrapping a redirect is a 500 and is logged); pool and health failures go through captureError, and database-health.db.test.ts, which still expected the removed console print, now asserts the capture; the dropped-reports count is written when its minute ends; the spec reads the throw lines from the source files.
(8) A malformed escape in a dynamic segment makes Next.js 16.3.5 answer an English 500 without any hook: logged only by the completion line. Known limit in the runbook; hand-off note on CS-17.
(9) pnpm check flaked again once the real-transform test ran beside the PGlite schema tests; the heavy files now run as a second Vitest project group after the rest (groupOrder). 5 of 5 runs pass since.
Evidence: pnpm check exit 0 (83 package tests, 147 web tests, 23 lint samples); pnpm db:check exit 0 (9 integration tests); pnpm e2e 96 passed, 14 skipped by design, 0 failed; the observability spec 10 of 10 in the mobile project.

Review round 3 (2026-09-28), every finding fixed:
(1) High, a remote stall: every request line redacted its path, and patterns with unbounded runs tried from every position made one 16 KB path take 350 ms to log. Every repetition is now bounded, values are cut to what is shown (plus a 1,000-character margin) before they are scanned, and a path or query is cut at 2,048 characters. Measured on next start: one 15,801-character path 23 ms (was 347 ms); GET / beside ten of them 47 ms (was 4,114 ms). A unit test fails if a megabyte of any hostile shape takes 250 ms to redact.
(2) Medium, AC 6: when the visitor left while a Route Handler answered, Next.js 16.3.5 never ended its root span and the request had no line. The http.Server hook now marks that span clientAborted and ends it when the response closes unfinished; a request whose visitor left before the framework started its span keeps the hook's own line, never two. Measured on next start: of 220 aborted health checks, 48 reached the handler (SQL in their trace), all 48 with exactly one line (43 marked clientAborted). The browser suite proves it with /api/diagnostics/slow, which answers after two seconds.
(3) Low: objects printed through console are sanitised by key before they become text; phone numbers spaced with no-break spaces, joiners, slashes or double spaces, or glued to a non-hex letter, are removed (hex ids and UUIDs still never); the runbook says what the logger removes instead of claiming nothing can appear.
(4) Low: a library that ships the compiler's output is no longer reported as not reproduced (its map content equals the file on disk).
Evidence: pnpm check exit 0 (89 package tests, 148 web tests, 23 lint samples); pnpm e2e 97 passed, 15 skipped by design (11 desktop copies of the observability spec, 4 harness self-checks), 0 failed; the observability spec 11 of 11 in the mobile project.

Review round 4 (2026-09-28), two regressions from round 3 fixed:
(1) AC 3: capping value lengths let longer secrets through untouched (a quoted password over 1,024 characters, a PEM key, a connection-string password over 512, a Bearer token's tail). Only the lookups that find a secret are bounded now; the secret is read whole in one pass. Pairs are found by a scanner that passes over harmless keys, so an unclosed quote cannot hide a secret; PEM private keys are removed whole; a slash separates phone digits only after a 0 or the country code, so /api/912/123/4567 stays. Tests: every long-secret case, both unclosed-quote cases, and a scaling test on redactText itself (the old key pattern: 0.4 s on 20 KB, 6.2 s on 80 KB, ratio 15.5, which it fails).
(2) AC 6: ending Next.js's span when the visitor left lost the route and status Next.js sets when its handler finishes, which it usually does. The hook now marks the span clientAborted (and the status if one was sent) and ends it only if it is still open 10 seconds later. Measured on next start: 60 streamed pages left at their headers gave 60 lines, all with route and status, none twice; aborted health checks that ran SQL all had exactly one line; the e2e test now expects the route. ADR, research note and learnings no longer claim Next.js never ends the span.
Evidence: pnpm check exit 0 (94 package tests, 148 web tests, 23 lint samples); pnpm e2e 97 passed, 15 skipped by design, 0 failed; a 15,801-character path answered in 20 ms, GET / beside ten of them in 38 ms.
<!-- SECTION:NOTES:END -->
