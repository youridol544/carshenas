# How should the worker schedule crawl jobs per source, pace requests to each host and back off, so sources run in parallel and no job waits on a rate limit?

- Date: 2026-09-29
- Asked by / for: Pedrum, starting CS-32: "clean seperation of worker and jobs … divar, bama, and khodro45 crawling jobs, they must be able to done in parallel without blocking eachother … crawl must be aware of rate limit status to not to exceed it, handling it gracefully so it does not happen that lots of jobs get blocked for rate limiting … backoff strategies or whatever which works well." The owner also asked for ideas from the most used open-source crawlers.
- Outcome: **ADR-0018** (accepted by the owner on 2026-09-29): one lane per crawled source on a pg-boss singleton queue, request pacing in PostgreSQL, failures sorted by cause and retried at one layer, and a 429 that cools a lane down and stops the source only when it repeats. Built in CS-32.

## Questions

1. How do the best-known crawlers keep a slow or blocked host from holding up the others, and how do they space requests to one host?
2. How do job queues limit work per key (a tenant, a host), and what happens to a job that meets the limit?
3. What does pg-boss 12 guarantee for "one job per source at a time", and can a job wait or go back to the queue without spending an attempt?
4. Which retry and backoff rules hold up in production, and at how many layers should a crawler retry?
5. How can a rate limit hold across worker processes with only PostgreSQL?
6. What do 429 and `Retry-After` mean, and how do crawlers react to them?

## Sources

Collected on 2026-09-29 by two research agents and by the agent that wrote this note; nothing was sent to a listing source. Markers: **via sub-agent** (a research agent read it at this address and quoted it), **read here** (read in this session), **lab** (measured in this session).

**Crawler design, the textbook and the paper:**

- Manning, Raghavan and Schütze, *Introduction to Information Retrieval*, Cambridge University Press 2008, §20.2.3 "The URL frontier", via sub-agent: <https://nlp.stanford.edu/IR-book/html/htmledition/the-url-frontier-1.html>. The standard graduate text on crawling.
- Najork and Heydon, "High-performance web crawling", Compaq SRC Research Report 173, 2001, via sub-agent: <https://www.cs.cornell.edu/courses/cs685/2002fa/mercator.pdf>. The Mercator crawler's authors on running it in production.
- Heydon and Najork, "Mercator: A scalable, extensible Web crawler", *World Wide Web* 2, 1999, via sub-agent: <https://link.springer.com/article/10.1023/A:1019213109274>.

**Crawler source code and documentation** (versions as of 2026-09-29), via sub-agent:

- Scrapy 2.19.0: the downloader's `Slot` (<https://github.com/scrapy/scrapy/blob/master/scrapy/core/downloader/__init__.py>), `DownloaderAwarePriorityQueue` (<https://github.com/scrapy/scrapy/blob/master/scrapy/pqueues.py>), AutoThrottle (<https://github.com/scrapy/scrapy/blob/master/scrapy/extensions/throttle.py>), `RetryMiddleware` (<https://github.com/scrapy/scrapy/blob/master/scrapy/downloadermiddlewares/retry.py>), settings (<https://docs.scrapy.org/en/latest/topics/settings.html>).
- Crawlee 3.18.1 and 4.0.0-rc.0 (Apify, TypeScript): `BasicCrawler` (<https://github.com/apify/crawlee/blob/v3.18.1/packages/basic-crawler/src/internals/basic-crawler.ts>), the v4 `ThrottlingRequestManager` (<https://github.com/apify/crawlee/blob/master/packages/basic-crawler/src/internals/throttling_request_manager.ts>), `AutoscaledPool` (<https://github.com/apify/crawlee/blob/v3.18.1/packages/core/src/autoscaling/autoscaled_pool.ts>), the session pool's blocked codes (<https://github.com/apify/crawlee/blob/v3.18.1/packages/core/src/session_pool/consts.ts>).
- Colly v2.2.0 (Go): `LimitRule` (<https://github.com/gocolly/colly/blob/master/http_backend.go>).
- Heritrix 3.17.1 (Internet Archive): the frontier and queue states (<https://heritrix.readthedocs.io/en/latest/glossary.html>, <https://github.com/internetarchive/heritrix3/blob/master/engine/src/main/java/org/archive/crawler/frontier/WorkQueueFrontier.java>), politeness (<https://github.com/internetarchive/heritrix3/blob/master/engine/src/main/java/org/archive/crawler/postprocessor/DispositionProcessor.java>), errors (<https://github.com/internetarchive/heritrix3/blob/master/engine/src/main/java/org/archive/crawler/frontier/AbstractFrontier.java>).
- Apache Nutch (master) and StormCrawler 3.7.0: `nutch-default.xml` (<https://github.com/apache/nutch/blob/master/conf/nutch-default.xml>), `FetchItemQueue` and `FetchItemQueues` (<https://github.com/apache/nutch/tree/master/src/java/org/apache/nutch/fetcher>), `FetcherBolt` (<https://github.com/apache/stormcrawler/blob/main/core/src/main/java/org/apache/stormcrawler/bolt/FetcherBolt.java>).

**Job queues:**

- BullMQ rate limiting and Pro groups, via sub-agent: <https://docs.bullmq.io/guide/rate-limiting>, <https://docs.bullmq.io/bullmq-pro/groups>.
- Sidekiq Enterprise rate limiting, via sub-agent: <https://github.com/sidekiq/sidekiq/wiki/Ent-Rate-Limiting>.
- Oban Pro 1.7.3 Smart engine (PostgreSQL-backed), via sub-agent: <https://oban.pro/docs/pro/1.7.3/Oban.Pro.Engines.Smart.html>.
- Hatchet (PostgreSQL-backed) concurrency and rate limits, via sub-agent: <https://docs.hatchet.run/home/concurrency>, <https://docs.hatchet.run/v1/rate-limits>.
- pg-boss 12.35.0 (Tim Jones, 2026-09-26): the published package's `dist/` (`types.d.ts`, `manager.js`, `plans.js`, `worker.js`, `contractor.js`), read here; the docs at <https://pgboss.io>, via sub-agent.

**Retries, backoff and overload:**

- Marc Brooker, "Exponential Backoff And Jitter", AWS Architecture Blog, 2015-03-04, via sub-agent: <https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/>.
- Marc Brooker, "Timeouts, retries, and backoff with jitter", Amazon Builders' Library, 2019, via sub-agent: <https://d1.awsstatic.com/builderslibrary/pdfs/timeouts-retries-and-backoff-with-jitter.pdf>.
- *Site Reliability Engineering* (Google, O'Reilly 2016), ch. 21 "Handling Overload" and ch. 22 "Addressing Cascading Failures", via sub-agent: <https://sre.google/sre-book/handling-overload/>, <https://sre.google/sre-book/addressing-cascading-failures/>.
- Martin Fowler, "CircuitBreaker", 2014-03-06, after Michael Nygard's *Release It!*, via sub-agent: <https://martinfowler.com/bliki/CircuitBreaker.html>. Microsoft Azure Architecture Center, "Bulkhead pattern", via sub-agent: <https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead>.
- Brandur Leach, "Rate limiting, cells, and GCRA", 2015-09-18, via sub-agent: <https://brandur.org/rate-limiting>.
- PostgreSQL 18 documentation on transaction isolation, date and time functions and advisory locks, via sub-agent: <https://www.postgresql.org/docs/18/transaction-iso.html>, <https://www.postgresql.org/docs/18/functions-datetime.html>, <https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS>.

**HTTP:**

- RFC 6585 §4 (429 Too Many Requests), RFC 9110 §10.2.3 (`Retry-After`), and draft-ietf-httpapi-ratelimit-headers-11 (2026-05-23, still a draft), via sub-agent.

**Lab:** a pg-boss 12.35.0 experiment on the local PostgreSQL 18 on 2026-09-29, in a scratch database (`scratchpad/pgboss/spike-lanes.mjs`, not committed).

## Findings

### 1. Crawlers keep one queue per host and a clock per host, and never let a worker sleep on one host

- The textbook design (IIR §20.2.3, from Mercator) has three goals: "(i) only one connection is open at a time to any host; (ii) a waiting time of a few seconds occurs between successive requests to a host and (iii) high-priority pages are crawled preferentially." "The front queues implement the prioritization, while the back queues implement politeness": each back queue holds URLs of a single host, and a heap keeps, per back queue, "the earliest time t_e at which the host corresponding to that queue can be contacted again." After a fetch, "the new entry t_e could be the current time plus ten times the last fetch time."
- Mercator's authors learned that one thread per server was not enough: their "weak politeness guarantee" still allowed "a stream of requests … to the same host without any pauses between them", so in production "we wait 10 times as long as it took us to download a URL from a host before contacting that host again" (SRC 173 §3.1).
- **Where the gap is measured.** Mercator, Heritrix, Nutch and Colly count it from the end of the previous response; Scrapy and Crawlee count it from when the previous request was sent, so after a response slower than the delay the next request leaves at once. Heritrix's snooze is `delayFactor` (5.0) times the last fetch's duration, clamped between `minDelayMs` (3,000, the same as ADR-0008's floor) and `maxDelayMs` (30,000). Scrapy's AutoThrottle likewise raises the delay with latency and never lets an error page lower it.
- **Jitter.** Scrapy's `DOWNLOAD_DELAY_JITTER` (0.5 by default in 2.19.0) multiplies the delay by `1 ± 0.5`, which goes below the "minimum"; Colly's `RandomDelay` only adds time.
- **Nobody sleeps on a waiting host.** Nutch's `FetchItemQueues.getFetchItem()` walks the host queues and returns the first ready item; StormCrawler keeps queues in a `DelayQueue` ordered by next fetch time; Heritrix "snoozes" a queue; Crawlee v4's `ThrottlingRequestManager` "never waits the backoff out, because a consumer parked in here holds a concurrency slot" and hands back a `readyAt` time instead. Scrapy made `DownloaderAwarePriorityQueue` its default in 2.14.0 because a single priority queue "does not work well with crawling many different domains in parallel": one domain's backlog fills the downloader while that domain waits out its delay.
- **Transient errors back off the whole host.** Heritrix retries connection failures by snoozing the host's queue for `retryDelaySeconds` (900); Nutch doubles a per-queue delay after each exception and, at `fetcher.max.exceptions.per.queue` (5), empties and blocks the host's queue for the cycle, a circuit breaker by another name.
- **Blocks and 429.** Scrapy retries 429 at once with no backoff; Crawlee v3 rotates sessions on 401, 403 and 429 and can "automatically try to bypass any detected bot protection" (both conflict with ADR-0008 point 6); Crawlee v4 backs off on 429, honouring `Retry-After` and otherwise doubling from 2 s up to 60 s, and throws `PersistentRateLimitError` after 900 s of continuous 429s; Heritrix records any HTTP status as a success and never stops on a block by itself.

### 2. Job queues do not claim work that is over a limit, or they put it back without spending an attempt

- BullMQ: a rate-limited job stays in the waiting state; `throw Worker.RateLimitError()` puts the job back without touching `attemptsMade`. BullMQ Pro's groups take turns and each has its own limit, so the other groups "continue to be consumed normally".
- Sidekiq Enterprise reschedules an over-limit job "using a linear backoff policy" and only after 20 such reschedules "(approx one day)" treats it as a retry; its wiki warns that limiters "do not slow down Sidekiq's job processing" and can fail many jobs with `OverLimit`.
- Oban Pro (on PostgreSQL) partitions rate limits by a job argument and "rolls back the attempt on snooze". Hatchet (on PostgreSQL) checks rate limits before it gives a task a worker slot, and requeues a step "until the rate limit is no longer exceeded".
- The Azure bulkhead pattern: "Isolate the elements of an application into pools so that if one element fails, the others continue to function."

### 3. pg-boss 12.35: a singleton queue is an exact lane; group limits are not

Read here in the 12.35.0 source unless marked:

- `groupConcurrency` counts active jobs **per queue name** (`WHERE name = '<queue>' AND state = 'active' AND group_id …`) with a `NOT EXISTS` check that two concurrent fetches can both pass; the docs say the limit may be "slightly exceeded during race conditions", and the CS-4 lab saw 3 active jobs against a limit of 1. `localGroupConcurrency` is tracked in memory per process and per queue. Neither holds a source to one job when its jobs live in several queues or several processes.
- The `singleton` policy is enforced by a unique partial index, `job_i2 ON job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'`; a fetch that loses the race gets 23505, which pg-boss treats as an empty fetch. One queue per source with this policy is therefore an exact "one job at a time" across every process. A job given a `singletonKey` would get its own slot, so lane jobs must never set one.
- Fetches are ordered `priority DESC, created_on`, so priorities order the kinds inside a lane.
- `offWork(queue)` stops a subscription; queued jobs are untouched.
- There is no public way to put a claimed job back without spending an attempt (the internal `restore()` does it but is not exported). `complete()` and `send()` both accept `{ db }`, so completing a job and sending its successor with `fromKysely(trx)` commit or roll back together.
- Retries: `retryLimit` (2 by default), `retryDelay`, `retryBackoff` and `retryDelayMax`; the delay is `retryDelay × (2ⁿ/2 + 2ⁿ/2 × random())`, "equal jitter", capped after the jitter. `perJobResults` lets a handler return `deadletter`, which skips the remaining retries (12.21.0). `heartbeatSeconds` (at least 10) lets the monitor fail the job of a crashed worker before `expireInSeconds` (15 minutes by default).
- Retention: queued jobs are deleted `retentionSeconds` (14 days by default) after their start time, so a long pause loses them unless the queue keeps them longer (via sub-agent).
- Schema: `getConstructionPlans()` and `getMigrationPlans()` export the SQL that installs and upgrades pg-boss's schema (version 43 in 12.35.0); with `migrate: false` the worker only checks the installed version. `create_queue()` is an `INSERT` for queues that are not partitioned, so a worker with DML rights alone can create queues. `REINDEX` during maintenance needs ownership, so `reindex: false` for a worker that does not own the schema.
- **Lab, 2026-09-29.** Two pg-boss instances (two "processes"), each working two singleton queues with `localConcurrency: 3`, 20 jobs per queue (10 at priority 0 sent first, then 10 at priority 5). Result: no lane ever ran two jobs at once (0 overlapping handlers), every priority-5 job ran before any priority-0 job, the two lanes ran at the same time, both instances took jobs from a lane, and after `offWork` on a lane its 18 queued jobs stayed `created` with `retry_count` 0 while the other lane kept running, then drained when work resumed.

### 4. Retry at one layer, back off with jitter, and cap it

- Brooker (2015): full jitter `random(0, min(cap, base·2ⁿ))` does the least work under contention; "'Equal Jitter' is the loser". His Builders' Library article: "retry at a single point in the stack" (retrying at five layers multiplies load "243x"); with capped backoff, clients end up "retrying constantly at the capped rate", so limit the number of retries; circuit breakers "introduce modal behavior into systems that can be difficult to test"; add "some jitter to all timers, periodic jobs, and other delayed work".
- Google SRE: a "per-request retry budget of up to three attempts", "Always use randomized exponential backoff", and "Don't retry permanent errors"; retrying at every layer multiplies ("64 attempts (4^3)"). Client-side adaptive throttling rejects locally when requests outrun accepts.
- Fowler (after Nygard): a half-open breaker lets one "trial call" through, which "will either reset the breaker if successful or restart the timeout if not"; thresholds can differ by error type.

### 5. A rate limit across processes needs one row per host and one atomic statement

- GCRA keeps one timestamp per key, the "theoretical arrival time": a request is allowed when `TAT − τ ≤ now`, then `TAT = max(TAT, now) + T`; no background job drains a bucket (Leach). ADR-0008's rule is GCRA with `T` = the source's interval and `τ` = 0.
- In PostgreSQL an `UPDATE … WHERE <conditions> RETURNING` takes the row lock, and under READ COMMITTED a second updater waits and re-evaluates the `WHERE` against the new row, so there is no check-then-act race (PostgreSQL 18 docs). Use the database's `clock_timestamp()`, never a worker's clock: `now()` is fixed for the whole transaction. A session advisory lock held across an HTTP call ties up a pooled connection and ignores transactions; a lease column that expires survives a crash.

### 6. HTTP

- RFC 6585: 429 means "the user has sent too many requests in a given amount of time" and "MAY include a Retry-After". RFC 9110: `Retry-After` is an HTTP date or a number of seconds; a 503 may carry it too.
- The IETF `RateLimit` and `RateLimit-Policy` headers are still a draft (-11, 2026-05-23); clients "MUST NOT assume that future responses will contain the same RateLimit header fields". Divar sent no rate-limit headers on 2026-09-28 (CS-5).

## Recommendation

Adopted in ADR-0018 and built in CS-32:

1. **Keep jobs apart from the runtime.** A job is a definition (name, payload schema, `run`, retry policy, priority, lane) that never imports the queue library; the runtime claims, traces, logs, retries, dead-letters, paces and shuts down.
2. **One lane per crawled source**: a pg-boss `singleton` queue holding every crawl kind of that source, ordered by ADR-0017's priorities (Mercator's front queues inside one back queue). The database enforces one job per lane across processes; lanes run side by side, so one source never takes another's capacity.
3. **Pace every request through a `crawl_lane` row per source** (Mercator's heap, in PostgreSQL): one atomic statement takes a lease only when the source is enabled, the lane is not cooling down and its next request time has come. The gap runs from the end of the last response, Heritrix-style: five times the response time, never below the source's `min_request_interval_ms` (at least 3 s) and at most 30 s; jitter, if ever added, only adds.
4. **Wait inside a job for at most one gap.** A stopped, paused or cooling lane stops claiming jobs (Crawlee v4, Nutch, Heritrix): queued jobs stay in the queue with their attempts. The one job that met the condition is completed and resent in one transaction, so it keeps its attempts (BullMQ, Oban).
5. **Retry at one layer: the queue.** No retries inside the HTTP client. A job's own failure is retried by pg-boss with exponential backoff and jitter, then dead-lettered; a payload that cannot be read is dead-lettered at once; timeouts, 5xx and dropped connections also feed a per-lane breaker that cools the lane down after three in a row (jittered, doubling from one minute up to an hour) and lets one probe request decide.
6. **Blocks stop the source; 429 cools it down first.** 403, a challenge page or an empty answer stops the source until a human resumes it (ADR-0008 point 6). A 429 is the server asking us to slow down (RFC 6585), so, by the owner's choice of 2026-09-29, the lane waits for `Retry-After` (or 15 minutes), resumes at double the gap for 24 hours, and a second 429 within those 24 hours stops the source. Never rotate user agents, sessions or addresses.

What would change this: a second worker host that must share lanes (still correct, since the lease and the singleton index are in the database, but the breaker's pause would reach the other host one claim late); a source whose terms grant an API with published limits, which would replace the interval with its `RateLimit` policy; or measurements in CS-33 showing that Divar throttles at our floor, which would raise `min_request_interval_ms` rather than change the design.
