# Logs and errors: reading them, finding a root cause, adding Sentry or a tracing backend

How the web app (and, from CS-6, the crawler worker) logs, how to find what went wrong from a visitor's reference code in seconds, and how to plug in a vendor. Decision: ADR-0016. Research: `docs/research/2026-09-28-production-logging-and-error-reporting.md`. Code: `packages/observability` (the shared package), `apps/web/src/server/observability` and `apps/web/src/instrumentation*.ts` (the web app's wiring).

## What is written, and where

Every line goes to standard output. In production it is one JSON object per line; in development (`pnpm dev`) the same events are printed as readable coloured lines. Next.js prints a few plain-text startup lines (`▲ Next.js 16.3.5`, `✓ Ready in …`) before any of our code runs; everything after `"msg":"server started"` is JSON, including what Next.js and libraries print through `console`.

| Field | Meaning |
|---|---|
| `time`, `level`, `msg` | ISO time (UTC), `trace` … `fatal`, and a constant sentence saying what happened |
| `service`, `version`, `env`, `pid`, `hostname` | which program (`carshenas-web`, later `carshenas-worker`), which build (git commit, `-dirty` when built with uncommitted changes), which environment and process |
| `trace_id`, `span_id`, `trace_flags` | the OpenTelemetry trace of the request or job the line belongs to |
| `reference` | the code a visitor sees on an error screen («کد پیگیری») |
| `err` | the error: `type`, `message`, `stack` (mapped to our TypeScript files, from the repository root: `apps/web/src/…`), `cause`, `errors`, and fields such as `code`, `constraint`, `digest` |
| `http.request.method`, `url.path`, `url.query`, `http.route`, `http.response.status_code`, `duration_ms` | the request, in OpenTelemetry's names |
| `clientAborted` | on a `request completed` line: the visitor left before the answer was complete. The line is written when the handler finishes, with the route and the status it produced; if Next.js never finishes the request, 10 seconds after the visitor left, without the route (with the status only if the answer had begun), its duration ending when the visitor left |
| `next.route_path`, `next.route_type` | the route, and where it failed: `render`, `route` (a Route Handler) or `action` (a Server Action) |
| `source: "browser"`, `kind` | a browser error (`uncaught`, `unhandledrejection`, `boundary`) |
| `component` | `db`, `health`, … |

Lines you will see: `server started`; one `request completed` per request, static files included (info; warn for a 5xx; debug for static files and `/api/health` unless they answered an error, so a chunk missing after a deploy shows at info); `request failed` for every unexpected server error; `browser error`; `slow statement` for SQL slower than 500 ms; `browser error reports dropped` when the intake hit its limit.

The logger removes the secrets and personal data it recognises: secret-named fields (`password`, `authorization`, `cookie`, `accessToken`, `phone`, `email`, …) become `[redacted]`, in log fields and in objects printed through `console` alike, and so do such pairs inside a message (`password=…`, `PGPASSWORD=…`, `"accessToken":"…"`); credentials in URLs, bearer tokens, JWTs and Iranian mobile numbers (with any spacing, dots, slashes or brackets) are removed from every string. Trace ids, hashes and UUIDs are never taken for phone numbers, so they stay whole and searchable. That is a safety net, not a guarantee: a secret in a shape it does not know passes, so code never logs one (`.claude/rules/observability.md`). Headers, cookies, IP addresses and SQL parameters are not logged (parameters only in development with `CARSHENAS_LOG_SQL=1`). A request path or query longer than 2,048 characters, an error's message longer than 4,000 and its stack longer than 16,000, and any other field or message longer than 8,000 are cut, with a note of how many characters more there were. Each is redacted before it is cut, so a secret across the cut is not shown in part, and redaction reads only what is kept and a margin past it, so a huge value costs no more to log than one at the limit.

## Finding a root cause

Production logs are wherever the host keeps standard output (CS-23 decides: `docker logs`, `journalctl`, a file). Every recipe below reads JSON lines; `jq -R 'fromjson? // empty'` skips the few plain-text startup lines.

```bash
logs() { docker logs carshenas-web 2>&1; }          # or: journalctl -u carshenas-web -o cat

# 1. A visitor sent «کد پیگیری: ۸۸۰۲۰۸۱۴۸»: convert Persian or Arabic-Indic digits to Latin, then find the error.
code=$(jq -rn --arg c '۸۸۰۲۰۸۱۴۸' '$c | explode | map(if . >= 1776 and . <= 1785 then . - 1728 elif . >= 1632 and . <= 1641 then . - 1584 else . end) | implode')
logs | jq -R --arg code "$code" 'fromjson? // empty | select(.reference == $code)'

# 2. Everything that request did, in order: its trace id.
logs | jq -R -c 'fromjson? // empty | select(.trace_id == "f5d31e7af82a4c5721c28858b5bc12d8")'

# 3. Errors, newest last, with the place that threw.
logs | jq -R -c 'fromjson? // empty | select(.level == "error" or .level == "fatal") | {time, msg, reference, path: ."url.path", error: .err.message, at: (.err.stack // "" | split("\n")[1])}'

# 4. Slow requests and failed ones.
logs | jq -R -c 'fromjson? // empty | select(.msg == "request completed" and (.duration_ms > 1000 or ."http.response.status_code" >= 500))'

# 5. Browser errors by place in the code.
logs | jq -R -r 'fromjson? // empty | select(.source == "browser") | (.err.stack // "" | split("\n")[1])' | sort | uniq -c | sort -rn
```

The same code appears again for every occurrence of one server bug in a page or a Server Action (Next.js's digest hashes the message and stack); a Route Handler's and a browser error's code is new each time. A page that fails after it started streaming is sent to the browser with status 200 and `noindex` (Next.js cannot change a status it already sent); its `request completed` line says 500.

## Settings

| Variable | Default | Effect |
|---|---|---|
| `LOG_LEVEL` | `debug` in development, nothing in unit tests, `info` otherwise | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`; any other value stops the server with a message |
| `LOG_FORMAT` | `pretty` in development, `json` otherwise | `json` or `pretty` |
| `CARSHENAS_LOG_SQL` | off | `1`: a debug line per SQL statement, with parameters in development only |
| `CARSHENAS_RELEASE` | the git commit at build time | overrides `version`; read by `next build`, which fixes it into the server code, so set it for the build (when the build has no `.git`), not at run time |
| `CARSHENAS_ENVIRONMENT` | `NODE_ENV` | `env` on every line: `production`, `staging`, … |
| `CARSHENAS_DIAGNOSTICS` | off | `1` opens the routes that fail on purpose (below) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` (or `…_TRACES_ENDPOINT`) | unset | sends traces to an OpenTelemetry collector; the exporter reads the other standard `OTEL_EXPORTER_OTLP_*` variables (headers, timeout, compression) itself; `OTEL_SDK_DISABLED=true` turns it off |

## Checking a deployment

With `CARSHENAS_DIAGNOSTICS=1` (then restart; turn it off again afterwards), these fail on purpose with a made-up credential and phone number in the message:

- `/diagnostics/server-render`: a Server Component that throws; the screen shows «کد پیگیری», the log a `request failed` line with that reference and a stack in `apps/web/src/app/diagnostics/[failure]/page.tsx`.
- `/api/diagnostics/slow`: a Route Handler that answers after two seconds; leave before it answers (`curl --max-time 1`) and its `request completed` line says `clientAborted`.
- `/api/diagnostics`: a Route Handler that throws: HTTP 500 with `{ "message": "مشکلی پیش آمد؛ دوباره امتحان کنید.", "reference": "…" }`, and a `request failed` line with the same reference.
- `/diagnostics/server-action`: a Server Action that throws.
- `/diagnostics/browser`: three buttons for a render error, an uncaught error and an unhandled rejection in the browser; each becomes a `browser error` line whose stack starts at the line of `apps/web/src/features/diagnostics/components/browser-failures.tsx` that threw.

In every line the credential and phone number must read `[redacted]`. `e2e/tests/app/observability.spec.ts` does all of this against a production build (`pnpm e2e tests/app/observability.spec.ts --project=mobile`); its server's output is saved as `server-output.log` (standard error as `server-errors.log`, which must stay empty) in the test results.

## Adding an OpenTelemetry backend

**Not redacted yet (2026-09-28):** spans leave the process as recorded, and Next.js puts a failing request's error message, stack and raw address on its spans, so what the logs redact reaches the collector. Before the variable is set anywhere but a collector you run on the same host, spans go through the same redaction as log lines: a redacting wrapper around the exporter in `registerTracing` (open follow-up).

Set `OTEL_EXPORTER_OTLP_ENDPOINT` (and `OTEL_EXPORTER_OTLP_HEADERS` if it needs a key) and restart; no code changes. Traces then show every request's spans (Next.js creates them: routing, rendering, `fetch`, our `withSpan` spans). Logs stay on standard output; a collector (the OpenTelemetry Collector's `filelog` receiver, Vector, Grafana Alloy) can read them and join them to traces by `trace_id`. Candidates that can run on an Iranian host: Jaeger, Grafana Tempo with Loki, SigNoz, OpenObserve. The choice needs an ADR (AGENTS.md: services must be reachable from Iran).

## Adding Sentry (written against @sentry/nextjs 11.0.0, not yet run)

**Not redacted yet (2026-09-28):** `captureError` hands reporters the raw error and fields. Before a reporter sends anything out, it gets a redacted copy (`serializeError` for the error, `sanitizeFields` for the fields) or scrubs the event in `beforeSend` (open follow-up).

Sentry's SaaS may not be reachable from Iran or usable under its sanctions terms; a self-hosted Sentry or a Sentry-compatible server (GlitchTip) takes the same SDK. Decide in an ADR first. Then:

1. `pnpm --filter @carshenas/web add @sentry/nextjs`, the DSN in the environment and read through `src/server/env.ts`.
2. In `registerObservability()` (`src/server/observability/register-node.ts`), after `registerTracing`:

   ```ts
   Sentry.init({
     dsn: env.sentryDsn,
     release: env.release,
     environment: env.environment,
     enableOpenTelemetrySetup: false, // our provider stays; Sentry attaches to it
     integrations: [Sentry.openTelemetryIntegration()],
     sendDefaultPii: false, // and set `dataCollection` explicitly: v11 collects cookies, headers and bodies by default
   });
   addErrorReporter({
     name: 'sentry',
     capture: (error, { severity = 'error', tags, fields, fingerprint }) =>
       Sentry.captureException(error, { level: severity, tags, extra: fields, fingerprint: fingerprint && [...fingerprint] }),
     flush: (timeoutMs) => Sentry.flush(timeoutMs),
   });
   ```

   `onRequestError` already goes through `captureError`, so do not also export `Sentry.captureRequestError`, or each error is sent twice. For spans in Sentry, add an OTLP exporter to `Sentry.getOtlpTracesEndpoint(dsn)`.
3. Logs in Sentry (optional): `Sentry.pinoIntegration({ error: { levels: [] } })`; it sees lines after our redaction. Keep error events coming from the reporter only.
4. Browser: `Sentry.init` in `src/instrumentation-client.ts` and `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart`; keep or remove our reporter, but not both reporting the same errors.
5. Source maps: for Turbopack builds `withSentryConfig` uploads them from the same `compiler.runAfterProductionCompile` hook that runs `scripts/browser-source-maps.mjs`, and by default deletes the browser maps afterwards (Sentry's build options, checked 2026-09-28). Make both run, Sentry's first while the maps still sit next to the chunks, with `sourcemaps.deleteSourcemapsAfterUpload: false`: ours moves them out of the served folder instead, and the server still needs them. The e2e spec checks that `.next/static` has no map left.
6. Worker: `@sentry/node` with the same reporter in the worker's startup.

## The crawler worker (CS-6)

```ts
import { createLogger } from '@carshenas/observability/logger';
import { installProcessHandlers } from '@carshenas/observability/process';
import { otlpExporter, registerTracing, withSpan } from '@carshenas/observability/tracing';
import { withLogContext } from '@carshenas/observability/context';

// sourceRoot: the repository root, so stack paths read `apps/crawler/src/…` like the web app's `apps/web/src/…`.
const logger = createLogger({ service: 'carshenas-worker', version, environment, level, format, sourceRoot });
installProcessHandlers(logger); // fatal line, then exit 1; the supervisor restarts it
const tracing = registerTracing({ service: 'carshenas-worker', version, environment, exporter: exportTraces ? otlpExporter() : undefined });
await withLogContext({ runId, source: 'divar' }, () =>
  withSpan('crawl divar page', async () => { logger.info('page fetched', { page, listings }); }),
);
await tracing?.shutdown(); // on SIGTERM, after draining jobs
```

Run it with Node's source maps on (`node --enable-source-maps`, or the flags the worker's runner uses) so stacks point at TypeScript. On Node 22.14 the package runs as TypeScript with `--experimental-strip-types`; from Node 22.18 no flag is needed. Node refuses to strip types from a file under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`): the pnpm workspace link resolves to `packages/observability`, so the worker runs it from the repository as it is, but a deployment that copies the package into `node_modules` (`pnpm deploy`) must compile it to JavaScript first.

## Source maps

Server stacks are mapped through the maps Node loads beside the server build (`register()` turns them on). Browser stacks are mapped with the maps `next build` writes for the browser code (`productionBrowserSourceMaps`): right after compiling, `apps/web/scripts/browser-source-maps.mjs` (run by `next.config.ts`) moves every map from `.next/static`, which is served, to `.next/browser-source-maps`, which is not, so no visitor can download our source. The React Compiler rewrites client components before the maps are made, so their maps point at the compiled code, not at our file. The same script runs Next.js's own React Compiler step on each such file again, with Babel's source maps on; when that gives back exactly the compiled code the map holds, it stores Babel's map beside it, and the server follows both maps to the line and column of our file. If a Next.js upgrade changes that step so it no longer gives back the same code, `next build` prints a warning naming the files, and their frames show the compiled code's position, marked `browser-failures.tsx (compiled):41:5`, never a wrong line of ours; the e2e spec fails on the diagnostics component.

A standalone deployment (`output: 'standalone'`, if CS-23 picks it) copies `.next/browser-source-maps` next to `.next/static`, or browser stacks stay unmapped.

## Known limits

- Redaction gaps found in the last review, left as follow-ups: a personal-data field is recognised only by its exact name (`phone`, `email`, not `sellerPhone`); object, Map and error-field keys are never redacted; one malformed percent-escape leaves a whole path undecoded, so what it encodes is not redacted; `console`'s `%d` and `%i` drop a phone number's leading 0 before redaction sees it; a URL password with a raw `/`, `?`, `#` or space is not recognised.
- The browser reporter cuts its body at 12,000 characters, the intake refuses over 16 KiB: a report mostly in Farsi can be refused (413), and one from a page address over 2,000 characters too (400).
- The Next.js startup banner is plain text.
- The browser intake's limit (30 reports a minute, one per bug) is per server process, not per visitor, until CS-23 decides which forwarded-for header can be trusted.
- Next.js's own print of a reported error is recognised by its call path (`onRequestError`, `instrumentationOnRequestError`); if a Next.js upgrade renames them, the error appears twice, never zero times.
- A path with a malformed percent-escape in a dynamic segment (`/diagnostics/%E0%A4%A`) fails inside Next.js 16.3.5 before any of our code: it answers a plain-text English 500 and calls no hook, so the only line is its `request completed` at warn, with a trace id but no error and no reference. The listing page (CS-17) meets the same; the fix is a 400 before routing (a proxy matched to the dynamic routes) or a Next.js fix.
- Development: if `next dev` shows «Cannot access "moduleLoading" without a work store» on every page after `instrumentation.ts` changed while it ran, restart it (seen on 2026-09-28; fresh servers never showed it).
