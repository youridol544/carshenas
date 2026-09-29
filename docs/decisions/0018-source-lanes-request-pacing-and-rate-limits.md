# ADR-0018: Run each source's crawl jobs in its own lane, pace every request in PostgreSQL, and cool down on a 429 before stopping

- Status: accepted on 2026-09-29 by the owner, who chose, among the options put to them: "One lane per source", "Extend CS-32" and, for 429, "Cool down, stop on repeat", whose text read: "Wait for Retry-After, or 15 minutes if it has none, then resume with the gap doubled. A second 429 within 24 hours stops the source until you resume it. This replaces ADR-0008 point 6 for 429 only, through a new ADR."
- Date: 2026-09-29
- Deciders: Pedrum
- Related:
  - ADRs: makes ADR-0011 point 5 concrete (one queue per job kind, a per-source concurrency limit); supersedes ADR-0008 point 6 for 429 responses only (403, challenge pages and empty answers still stop the source); ADR-0016 (logs), ADR-0017 (budget, priorities, degraded mode).
  - Research: `docs/research/2026-09-29-crawl-scheduling-rate-limits-and-backoff.md`.
  - Tasks: CS-32 (built here), CS-33, CS-35, CS-41, CS-54, CS-77.

## Context

The worker will read Divar, Bama and Khodro45, then more sources, from one PostgreSQL-backed queue (pg-boss 12). The owner asked for sources that run in parallel without blocking each other, rate limits that are never exceeded, no pile-up of jobs waiting on a limit, and backoff that works. ADR-0008 allows one request at a time per host, at least three seconds apart, and ADR-0017 orders each source's work by priority. pg-boss's group limits count per queue and can be exceeded under races, so "one queue per job kind" cannot hold a source to one request at a time. Every well-known crawler instead keeps one queue per host with a clock per host and never lets a worker sleep on a waiting host (the research note).

## Decision

1. **Jobs are definitions; the runtime runs them.** A job declares its name, payload schema, `run`, retry policy, priority and whether it runs in a source's lane. Jobs never import pg-boss or the database driver (lint); the runtime claims, traces, logs, retries, dead-letters, paces and drains them.
2. **One lane per crawled source**: the pg-boss queue `crawl.<source>`, policy `singleton`, holding every crawl job of that source in ADR-0017's priority order. Its unique index lets one job run per lane across all processes; each lane has its own subscription, so lanes run side by side. Lane jobs never set a `singletonKey`. Work that sends no request to a source keeps one queue per job kind.
3. **Every request passes the lane's row in `crawl_lane`.** One atomic statement takes a lease only while the source is `enabled`, the lane is not cooling down and its next request time has come. After the response, the next time is set to the end of this one plus a gap of five times its duration, never below `source.min_request_interval_ms` (at least 3 s; twice that for 24 hours after a 429) and at most 30 s.
4. **Waiting.** A job waits inside its handler for at most one gap. When the source is stopped or paused, or the lane is cooling down, the lane stops claiming jobs, queued jobs keep their attempts, and the job that met the condition is completed and resent in one transaction, keeping its attempts.
5. **Failures, retried at one layer.** A job's own failure is retried by pg-boss with exponential backoff and jitter, then moved to the `dead-letter` queue; a payload that cannot be read goes there at once. Timeouts, 5xx and dropped connections also count toward the lane's breaker: three in a row cool the lane down for a jittered time that doubles from one minute to an hour, then one probe request closes it or cools it again.
6. **Blocks and 429.** A 403, 401, or a challenge page or empty answer that the source's adapter reports stops the source (ADR-0008 point 6): `stop_source()` records when and why, and only a human re-enables it. A 429 cools the lane down for its `Retry-After` (at least one gap, at most six hours) or 15 minutes, and doubles the gap for 24 hours; a second 429 within those 24 hours stops the source with reason `rate_limited`. The crawler never rotates user agents, sessions or addresses.
7. **Operations.** pg-boss's schema is installed and upgraded by dbmate migrations from pg-boss's exported SQL and owned by `carshenas_owner`; the worker's role has row access only. The daily budget (CS-35) becomes one more condition of the lease.

## Alternatives considered

- **One queue per job kind with pg-boss `groupConcurrency` per source**: its docs admit the limit can be exceeded in races (the CS-4 lab saw 3 against 1), it counts one queue at a time, and pausing one source would mean filtering every fetch.
- **A hand-written lane loop over `fetch()`**: admits before claiming, but rewrites heartbeats, expiry and shutdown that pg-boss already has; the requeue in point 4 gives the same outcome.
- **Pacing in memory**: simpler, but a second process or a restart during a deploy could send two requests less than the gap apart, and a crash-looping worker would forget its breaker.
- **Stop at the first 429** (ADR-0008 as accepted): the safest reading, but a 429 in the night would leave the index stale until the owner acts, while the server only asked us to slow down.
- **Retry inside the HTTP client as well**: retries at two layers multiply; the queue already retries with backoff.

## Consequences

- Positive: a stalled or stopped source costs the others nothing; the database enforces one request at a time per host whatever runs the worker; host problems never spend a job's attempts; the lane's state is visible for CS-41 and the health check.
- Negative / risks: two statements per request; crawl kinds share a queue, so queue-level views need the job's kind; a job may run twice after a crash (at-least-once), so crawl writes stay idempotent (upserts on natural keys, snapshots by content hash); continuing after a first 429 accepts more risk than ADR-0008 did; a pause longer than a lane queue's retention (30 days) loses queued jobs.
- Follow-ups: CS-33 detects Divar's challenge pages and empty answers, writes `fetch_log`, and uses the lane's HTTP client; CS-35 adds the daily budget to the lease; CS-41 shows lanes, cool-downs and stops; CS-40 resumes a stopped source.
