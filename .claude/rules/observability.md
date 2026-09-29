---
paths:
  - "apps/web/src/server/**"
  - "apps/web/src/features/*/server/**"
  - "apps/web/src/features/*/*-actions.ts"
  - "apps/web/src/app/**/route.ts"
  - "apps/web/src/app/**/error.tsx"
  - "apps/web/src/instrumentation*.ts"
  - "packages/observability/**"
---

# Logging and error reporting

Decision: ADR-0016. How to read the logs and add Sentry or a tracing backend: `docs/runbooks/logs-and-errors.md`. Lint already rejects `console` in `src/` and a log message built from values; this file is what lint cannot see. Sources: Stripe's canonical log lines (Brandur Leach, 2019), Charity Majors on wide events (2024), Dave Pacheco's "Error Handling in Node.js" (Joyent, 2014), and the codebases in `docs/research/2026-09-28-production-logging-and-error-reporting.md`.

## Writing a line

- Server code logs through `logger` from `@/server/observability/logger` (the worker: its own `createLogger`), usually a child: `const log = logger.child({ component: 'search' })`. The message is a constant sentence saying what happened (`'snapshot stored'`, `'slow statement'`); every value is a field (`{ listingId, durationMs }`), so all occurrences of an event read the same and can be counted.
- A line is an event someone may need to find, not narration. Every request already has its `request completed` line with method, route, status and duration, so do not add "start" and "end" lines; add fields to the one event that matters instead. In a worker, one line per unit of work (a page fetched, a run finished with counts) inside `withSpan`, which gives all its lines one `trace_id`.
- Levels: `error` when something failed unexpectedly and a person should look; `warn` when it was handled but is not normal (a slow query, a source that answered 429, dropped reports); `info` for lifecycle and one line per unit of work; `debug` for detail you would switch on to diagnose; `fatal` only right before a process exits.
- Our field names are camelCase (`listingId`, `sourceId`, `runId`); standard concepts use OpenTelemetry's names (`url.path`, `http.response.status_code`); the error is always `err`. Put the unit in the name (`durationMs`, `priceToman`).
- Never log personal data or secrets, even though the logger redacts what it recognises: pick the fields you need, never a whole row, request, response or headers object. The redaction (secret-named fields, credentials in URLs, bearer tokens, JWTs, Iranian phone numbers) is the safety net, not the plan. A seller's phone number, a visitor's IP address and SQL parameters stay out.

## Errors

- Expected failures are values, not errors (ADR-0004): a violated constraint, a listing no longer available, invalid input. Return them; log them at `info` or `warn` only if they are worth counting.
- Log or throw, never both. An unexpected error thrown from a page or a Server Action reaches `onRequestError`, and one from a Route Handler reaches `withErrorReference`; each logs it once with the request and a reference code, so logging it on the way up only duplicates it. Catch an unexpected error only to turn it into a Farsi message, and then call `captureError(error, { message: 'saving the search failed', fields: { searchId } })`, which logs it and hands it to every reporter.
- Throw `Error` objects (a subclass when callers must tell failures apart), with `{ cause }` when wrapping, so the chain survives: `throw new Error('crawl page 3 failed', { cause: error })`.
- The visitor never sees a message or stack. An error screen shows «کد پیگیری» through `useErrorReference` (`src/components/layout/error-reference.tsx`); a component boundary made with `catchError` does the same, or calls `reportBrowserError(error, 'boundary')` itself when the error has no digest.
- A Route Handler exports each method through `withErrorReference('/api/…', handler)` (`src/server/observability/route-errors.ts`; lint requires it). An unexpected error then answers 500 with a Farsi message and the reference on its log line; an expected failure is a response the handler returns itself, with a Farsi message, never `error.message`.

## Tests

- Replace the app's logger module with `recordingLogger` from `@/server/observability/recording-logger` (`vi.mock`) and assert on `recordedLines`; the logger is otherwise silent under Vitest.
- `e2e/tests/app/observability.spec.ts` checks the whole path against a production build; a change to request errors, the error screens, the intake or source maps runs it.
