---
paths:
  - "apps/worker/**"
---

# The worker: jobs, lanes and the runtime (apps/worker)

Decisions: ADR-0011 point 5 (pg-boss on PostgreSQL), ADR-0018 (lanes, pacing, 429), ADR-0008 (crawl politeness, stop on block), ADR-0016 (logs). Research: `docs/research/2026-09-29-crawl-scheduling-rate-limits-and-backoff.md`. Running and inspecting it: `docs/runbooks/worker.md`. Lint already keeps jobs away from pg-boss, the driver and the pool, `process.env` inside `src/env.ts`, `sql` inside `src/db/`, and `console` out; this file is what lint cannot see.

## Writing a job

- A job is a definition in its own file under `src/jobs/`, listed in `src/jobs/registry.ts`: `defineJob` for work that sends no request to a source (its own queue), `defineLaneJob` for work that does (its source's lane, one job of the lane at a time). Give it a `name` (`<area>.<verb>`, lane jobs `crawl.<verb>`), a zod `payload`, and set `priority` (lane kinds follow ADR-0017's order), `retry`, `timeoutSeconds` and `retentionDays` only when the defaults in `src/runtime/queues.ts` do not fit.
- Keep a job small and resumable: one list page or one listing per job, and the next page as a follow-up job carrying its cursor. A lane's job holds the whole source while it runs, and a buyer's re-check waits behind it.
- Jobs run at least once, sometimes twice (a crash after the work, before the settle): make every write idempotent, an upsert on a natural key or an insert that a unique constraint deduplicates (the `database` skill).
- Enqueue follow-up work with `context.enqueue(job, payload, { transaction })` inside the transaction that writes the rows it needs; never after the commit.
- Count what the job did with `context.count('listings', n)`: the counts go on its one completion line and into the job's stored output. Do not add start or end lines; lines inside a job already carry its id, kind, attempt and trace.
- Honour `context.signal` in anything long (it aborts on shutdown and when pg-boss takes the job back).

## Talking to a source

- Every request goes through the lane: `context.fetch(url, init)` for HTTP (`src/runtime/http.ts`), `context.lane.request(send)` for anything else. Never call `fetch` directly and never retry inside a job: the lane paces, the queue retries (ADR-0018 point 5).
- `context.fetch` returns every ordinary answer, a 404 or a 302 included, read in full. It throws `SourceBlockedError` (401, 403), `SourceThrottledError` (429) and `SourceUnavailableError` (408, 5xx, timeouts, dropped connections); let them propagate, the runtime and the lane react. Recognise a source's own refusals with `detectBlock` (a challenge page, an empty list where listings were expected) so the source stops as for a 403.
- Throw `PermanentJobError` only for input that can never work; any other error is a failure the queue retries and then dead-letters.
- The User-Agent comes from `CRAWLER_USER_AGENT`; a job never sets its own, rotates it, or works around a block (ADR-0008 point 6).
- A lane job that sends requests runs them inside `crawlStep` (`src/jobs/crawl-step.ts`, CS-33): it opens the job's crawl run citing the source's policy check before any request, logs every request in `fetch_log` whatever came back (a refusal with the instant its source was stopped at, its evidence), and closes the run with the job's counts. Log an answer with `run.logAnswer` in the transaction that writes what it said, and close with `run.succeed` there too.
- A source's adapter (`src/sources/<source>/`) is pure: request bodies, answer schemas, refusal detection, and the canonical snapshot (personal data and the viewer's interface left out, phone numbers removed with `replacePhoneNumbers`). Reading and writing Persian digits, amounts and dates is `@carshenas/locale`'s; never a second copy.

## Tests

- Unit tests (`*.test.ts`, node:test, run by `pnpm check`) for pure rules; a local stub source (`src/test-support/stub-source.ts`) for anything HTTP, never a real site.
- Anything that needs the queue or the lanes is a `*.db.test.ts`, run by `pnpm db:check` on a scratch database: use `startTestWorker` and `createTestSource(owner, context)`, stop every worker in `context.after`, and wait for the state you assert (`until`), since a lane closes before its job is settled.
