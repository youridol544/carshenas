# Can PostgreSQL alone be Carshenas's data stack, and how should the code talk to it?

- Date: 2026-09-27
- Asked by / for: Pedrum, for CS-4: "introudcion elastic to system only adds complexity. very costy in deployments and it makes polyglot persistance issues for now", "i dont want to use elastic only because torob team uses it in their team. let's see if we can do it all using postgres", and "what kind of db communication our app has? raw sql? prisma? drizzle? find the best one and the winner."
- Outcome: PostgreSQL 18 is the only data service, for records, search, vectors and the job queue (ADR-0011, superseding ADR-0007); the code talks to it through Kysely on node-postgres, with plain SQL migrations under dbmate and types generated from the database (ADR-0012); the modeling rules are ADR-0013. All nine open decisions were taken by the owner on 2026-09-27 (below) and built in CS-4.

## Questions

1. Can PostgreSQL alone serve Carshenas's search at the planned scale (Persian text with its spelling variants, Latin-typed names, typos, filters, five sorts, facet counts, a p95 under 300 ms), and what would Elasticsearch add, cost and risk?
2. How should the web app and the ingestion worker talk to PostgreSQL: raw SQL, a query builder, or an ORM (Prisma, Drizzle), and which library wins?
3. Which migration tool and which PostgreSQL job queue?
4. Does any of it depend on services that cannot be reached from Iran?

## Method

Six research passes ran on 2026-09-26 and 2026-09-27; two of them answer these questions, and the other four (the craft questions) are summarised in `2026-09-27-database-craft.md`.

- **Search (pass A)**: PostgreSQL's full-text search, `pg_trgm`, `fuzzystrmatch` and `unaccent`, measured on a synthetic but realistically noisy listing table at 100,000, 300,000 and 1,000,000 rows with `pgbench` (single client and an 8-client mixed workload), against Elasticsearch's and OpenSearch's documentation, licences, sanctions terms, memory needs and the published experience of teams that moved in either direction.
- **Access layer, migrations and queue (pass B)**: the same schema and five operations (idempotent snapshot insert, filtered full-text search with keyset paging, facet counts, a `SKIP LOCKED` dequeue, and mapping three constraint violations) implemented in postgres.js, Kysely, Drizzle and Prisma, plus a Next.js 16.3.5 build; migration tools and queues in their own labs; network activity logged at install and run time.

Every source was fetched; quotes are verbatim and at most 25 words; reasoning without a source is marked as inference. **Versions**: both labs ran PostgreSQL 17.11 with pgvector 0.8.6, the image already pulled at the time; the owner then chose PostgreSQL 18, and every number below is as measured on 17.11. The kept lab SQL was re-run for correctness, not timing, on PostgreSQL 18.6 on 2026-09-27. CS-4's implementation runs PostgreSQL 18.6 with pgvector 0.8.6 (`pgvector/pgvector:0.8.6-pg18`).

The passes are kept, unedited apart from local paths, in [`2026-09-27-database-research/`](2026-09-27-database-research/README.md): `search.md` and `access-layer.md` for this note, with every quote, link, date and the lab SQL.

## Findings

### 1. Search: PostgreSQL alone meets CS-14's criteria at the planned scale

The measured stack is PostgreSQL's built-in full-text search with the `simple` configuration over an IMMUTABLE Persian normaliser (Arabic ي and ك to Persian, the zero-width non-joiner, three digit scripts, digits split from letters), a stored generated `tsvector` with a GIN index, an alias table applied with `ts_rewrite` for Latin-typed and variant names ("peugeot 206", «صندوقدار»), and a vocabulary table for typo correction («پزو»، «دتا»). About 150 lines of SQL; `lab/search/` in the appendix has it.

| Measured (warm, 4 CPUs) | 100,000 | 300,000 | 1,000,000 listings |
|---|---|---|---|
| Search call, one client (query, first 20 results, facets, total) | p95 23 ms | p50 14 ms, p95 92 ms | p50 35 ms, p95 116 ms with sampled facets for broad queries (exact facets: p95 237 ms) |
| Mixed workload, 8 clients | — | p95 78 ms at 100 calls/s | about 45 calls/s at saturation with live facets; search p95 59 ms at 100 calls/s with facets from a cache |
| Browse a model under any of the five sorts | | | p95 0.6 ms; keyset paging under 1 ms |

Three things have to be designed around:

- **Facet counts grow linearly with the rows they count**: over all active listings they took p50 58 ms at 100,000, 213 ms at 300,000 and 581 ms at 1,000,000 (370 ms with a covering index). The worker should precompute the landing page and per-make and per-model counts after each crawl batch, broad queries take facets from a 10 % table sample (errors under 4 % on the top models), and repeated queries read cached facets.
- **Rank by an indexed column, not a computed score.** For 8,960 matches of «پژو ۲۰۶» in Tehran at 300,000 listings, `ts_rank_cd` mixed with deal score and freshness took p95 91 ms; ordering by the indexed deal score took p95 0.41 ms, and the same search as make and model filters (what CS-15 produces) 0.19 ms. Deal score first is also CarGurus's default.
- **The LIMIT trap**: the planner assumes model and price are independent. «بنز E250» cheapest first walked 761,721 index entries (754 ms) until equality-first composite indexes such as `(model_id, asking_price_toman, id)` brought it to 0.09 ms.

What PostgreSQL does not give, with medium confidence that none of it matters for CS-14: BM25 relevance with corpus statistics, a maintained Persian analyser with a stemmer (Elasticsearch 9 indices), Damerau-Levenshtein fuzzy matching inside the engine, fast aggregations over hundreds of thousands of matches, and synonym sets that change without reindexing.

What it avoids:

- **A second store to keep in sync.** Dual writes drift without an error: "you probably won't even notice that your database and your search indexes have gone out of sync, because no errors occur" (Martin Kleppmann, "Using logs to build a solid data infrastructure", https://martin.kleppmann.com/2015/05/27/logs-for-data-infrastructure.html, 2015-05-27). The cure is an outbox or change data capture plus re-reading shown rows from PostgreSQL anyway; until it catches up, a sold car stays in results and a raised price still matches «زیر ۷۰۰ میلیون».
- **Memory and topology.** About 4 GB of RAM for one node with a 2 GB heap, and Elastic writes "we do not recommend using one-node clusters in production" (Elastic, "Resilience in small clusters", https://www.elastic.co/docs/deploy-manage/production-guidance/availability-and-resilience/resilience-in-small-clusters, undated, read 2026-09-27). The whole 300,000-listing PostgreSQL dataset with every index was 303 MB; 1,000,000 listings with 16 indexes, 1,142 MB.
- **Sanctions.** Elastic's download page: "Such prohibition includes the following countries: Cuba, Iran, North Korea, Syria, Russia, Belarus" (Elastic, "Downloads", https://www.elastic.co/downloads, read 2026-09-27). OpenSearch (Apache 2.0) would be the clean alternative if a search engine is ever needed.
- **Cost.** Iranian clouds price the engines alike: Liara lists 4,125,000 toman a month for 4 GB of managed PostgreSQL or Elasticsearch, so a second store doubles the bill for no measured gain.

Confidence: high up to a few hundred thousand active listings, which is the plan; medium-high at 1,000,000 with precomputed, sampled or cached facets; medium beyond. Snapshots do not count: they never enter the search table.

### 2. The access layer: Kysely on node-postgres

The five operations gave identical results in all four libraries; per-query latency differed by tenths of a millisecond, so speed did not decide.

| | Verdict | Why |
|---|---|---|
| **Kysely 0.29.6 + pg 8.23.0** | **Winner** | Wrote our PostgreSQL-specific queries natively (`ON CONFLICT … RETURNING`, a CTE with `FOR UPDATE SKIP LOCKED` and `UPDATE … FROM`, `count(*) FILTER`, keyset tuples, window functions, JSONB), needing its `sql` template only for the search operators and `now()`: 6 raw fragments across the five operations, against Drizzle's 11. Types come from the migrated database (kysely-codegen, `--verify` catches drift), so the schema can use every PostgreSQL feature. `ReadonlyKysely` made an insert in a read-only module a compile error. 3.5 MB, no install scripts, no telemetry |
| postgres.js 3.4.9 (raw SQL) | Runner-up | Smallest and fastest, but row types are unchecked casts (a `bigint` came back as a string with no warning), and maintenance has slowed: 2 releases and 8 commits in 2026, 311 open issues, one maintainer |
| Drizzle ORM 0.45.3 / Kit 0.31.11 | Not now | Four open defects hit what we need, each reproduced: `CREATE INDEX CONCURRENTLY` cannot run (#860), `drizzle-kit migrate` failed with exit code 1 and no message (#5521, #6121), an edited applied migration was ignored, and a `.desc()` index is emitted `NULLS LAST` so PostgreSQL sorted instead of using it (#5978). 1.0 has been a release candidate since 2026-04-30 |
| Prisma ORM 7.10 | No | Mid-rewrite (`npm i prisma` installs 8.0.0-rc.17 while the client's latest is 7.10.0); its schema language cannot express generated columns, CHECK, HNSW or EXCLUDE, and `migrate diff` wanted to drop our hand-added HNSW index; a CHECK violation surfaced as P2039 with the name only in the message; install downloads an engine from `binaries.prisma.sh` and every CLI command calls `checkpoint.prisma.io`; the lab tree was 363 MB |

What we accept with Kysely: it is 0.x (0.29.0 went ESM-only), so versions are pinned exactly and release notes read before a bump; `sql<T>` is a type assertion, so raw fragments live in small tested helpers; there is less training data than for Prisma or Drizzle, so agents read `https://kysely.dev/llms.txt`; its own migrator (TypeScript, one transaction, no checksums) is not used. The view from the practitioner who asked for it: "Use plain SQL. I mean it. You get excellent SQL out of agents and they can match the SQL they write with the SQL logs." (Armin Ronacher, "Agentic Coding Recommendations", https://lucumr.pocoo.org/2025/6/12/agentic-coding/, 2025-06-12). Kysely keeps that property, since its logged SQL matches the code clause by clause, and adds compile-time errors, which is how ADR-0004 steers agents.

### 3. Migrations: dbmate and Squawk

- **dbmate 2.36** applies plain SQL files with `-- migrate:up` and `-- migrate:down` sections, and `transaction:false` per file for `CREATE INDEX CONCURRENTLY` or `VALIDATE CONSTRAINT`. Such a statement must be alone in its file: PostgreSQL runs a multi-statement query as one transaction, and the lab's file with an extension and a concurrent index failed with 25001.
- dbmate stores only version numbers ("dbmate only stores the version number, not the contents", amacneil, dbmate README, https://github.com/amacneil/dbmate), so an edited applied migration goes unnoticed unless a check compares merged files. Its schema dump runs the host's `pg_dump` and was skipped silently on a major-version mismatch, so the schema file is dumped from inside the container.
- **Squawk 2.66** lints the SQL for statements that lock or break a live table (missing `lock_timeout`, a constraint without `NOT VALID`, a non-concurrent index, a type change); it ships as npm platform binaries with no network use.
- Runner-up: graphile-migrate, which detects edited migrations but whose stable 1.4.1 dates from 2022. Atlas's PostgreSQL lock analysers need Atlas Pro and a login; Drizzle Kit and Prisma Migrate are ruled out above.

### 4. The job queue: pg-boss

**pg-boss 12.35** on PostgreSQL itself (medium confidence over graphile-worker): in one worker process `localGroupConcurrency: 1` held exactly one job per source; it has dead-letter queues, expiry and heartbeat recovery in the open-source version, cron with a time zone (Asia/Tehran ran in the lab), keeps completed jobs for 7 days, and `fromKysely(trx)` enqueues follow-up work in the same transaction as the rows it needs (a rollback removed the job). Guardrails: with `notify: true` also set a short backstop poll (the defaults drained a backlog at 4 jobs per 30 s); `singletonKey` did not deduplicate on a standard queue, so do not rely on it outside singleton or throttled queues; ADR-0008's stop on 403, 429 or a challenge is a per-source pause every handler checks before fetching; `send()` is wrapped in a helper keyed by queue name so payloads are typed; several worker processes that need a hard cap would move to a slot table. Runner-up: graphile-worker 0.18 (simpler, typed payloads, exact serial lanes, but jobs of a crashed worker stay locked for at least four hours and its cron runs in UTC). A hand-written queue would be about 500 to 900 lines with tests (inference); its core `SKIP LOCKED` statement proved correct in the lab (8 workers, 80 jobs, no duplicate claim).

### 5. Reachability from Iran

Kysely, pg, kysely-codegen, dbmate, Squawk and pg-boss contact nothing beyond the npm registry (lab). Prisma contacts `binaries.prisma.sh` and `checkpoint.prisma.io`, and Prisma 8 sends usage data by default. Docker Hub blocks Iranian addresses ("we now block all IP addresses that are located in Cuba, Iran, North Korea, Republic of Crimea, Sudan, and Syria", Docker's 403 message as quoted in werf discussion #6166, https://github.com/werf/werf/discussions/6166, 2024-05-30), which affects the PostgreSQL image and any search engine image alike; Iranian registry mirrors answered on 2026-09-27 (docker.arvancloud.ir, hub.hamdocker.ir and others). The production host's access to the npm registry and an image mirror is CS-23's to verify.

## Triggers for adding a search engine

Add OpenSearch (Apache 2.0) or ParadeDB `pg_search` (inside PostgreSQL, but AGPL and single-node in its community edition) only when one of these fires on production data, after the cheaper fix. PostgreSQL stays the only source of truth either way, and a search engine would be fed from an outbox or the log, never by dual writes. Thresholds are inference, anchored in the appendix.

| # | Measure | Threshold | Try first |
|---|---|---|---|
| 1 | p95 of the search API, excluding the network | above 300 ms for a week, or p99 above 800 ms | `EXPLAIN (ANALYZE, BUFFERS)` of the slow calls, equality-first composites, cached or sampled facets, a read replica |
| 2 | Peak search and browse calls against the measured capacity of the production box | sustained peaks above half the capacity | cache facets per query until the next crawl batch; replicas or CPUs |
| 3 | Active listings in the search table | above 1,000,000 | keep inactive listings and snapshots out; partition by status |
| 4 | Text relevance becomes the product's ranking | common queries match more than 20,000 listings | deal score as the default sort; CS-15 turns text into filters |
| 5 | Live facet counts | p95 above 250 ms after covering index, sampling and precomputation | a facet-count table refreshed by the worker |
| 6 | Typo and synonym quality on a labelled query set | recall below 90 % and at least 5 points worse than Elasticsearch on the same set | grow the alias table from zero-result queries |
| 7 | Search load hurts ingestion | crawl or valuation batches slowed more than 2 times | route reads to a streaming replica |
| 8 | Features only an engine has | relevance tuning on long free text, highlighting at scale, personalisation | ParadeDB if AGPL is acceptable, otherwise OpenSearch |

## Decisions taken by the owner on 2026-09-27

1. **PostgreSQL only**, with no search engine; OpenSearch or ParadeDB only if a recorded trigger fires, and never Elasticsearch (ADR-0011).
2. **Kysely on node-postgres, with plain SQL migrations**: dbmate applies them, kysely-codegen generates the types, Squawk lints them (ADR-0012).
3. **pg-boss** for the job queue, installed with the worker in CS-6 (ADR-0011).
4. **PostgreSQL 18**, from the pinned image `pgvector/pgvector:0.8.6-pg18` (ADR-0011).
5. **One listing table with an origin**: crawled listings now, native listings later through one additive migration, with Carshenas itself as a source and origin-specific data in its own tables (ADR-0013).
6. **Keyed HMAC phone hashes** instead of "salted hashes", with the key outside the database; ADR-0008 point 7 is amended (ADR-0013; the reasons are in `2026-09-27-database-craft.md`).
7. **Index every foreign key by default**; an exception is named in the migration with a constraint comment starting `unindexed:` (ADR-0013).
8. **Vectors in the same database**: `halfvec` in narrow side tables, exact search within a block, HNSW only when a query needs similarity across the table, and 64-bit perceptual hashes for duplicate photos (ADR-0011).
9. **`bigint` identity keys**, random hashed tokens for anything whose possession grants access, and UUIDv7 only for ids minted outside the database (ADR-0013).

## What CS-4 built

- `compose.yaml`: PostgreSQL 18.6 with pgvector 0.8.6 on `127.0.0.1` only, `shm_size: 1gb` for parallel index builds, limits matching a 4 GB, 2-core VPS; `db/postgresql.conf` with the 4 GB settings, `pg_stat_statements`, `auto_explain`, `track_io_timing` and slow-statement logging; `db/bootstrap/` creating the roles (`carshenas_owner`, `carshenas_migrate`, `carshenas_web`, `carshenas_readonly`, timeouts per role) and the database with the builtin C.UTF-8 locale; `example.env` as the template for `.env`.
- `scripts/db.sh` behind `pnpm db:up`, `db:stop`, `db:restart`, `db:migrate`, `db:rollback`, `db:new`, `db:status`, `db:lint`, `db:check`, `db:psql`, `db:top-queries` and `db:unused-indexes` (`docs/runbooks/local-database.md`).
- Four migrations in `db/migrations`: the schema foundations (default read grants, `jsonb_sha256()`, the append-only trigger function), sources with their append-only policy checks, the listing's identity and lifecycle with a transition table and guard trigger, and crawl runs, the append-only fetch log and content-addressed snapshots; `db/schema.sql` dumped from the container.
- `apps/web/src/server/db/`: one pool per process with an `int8` parser that refuses unsafe integers, `database()` and `readDatabase()`, `constraintViolation()` mapping SQLSTATE and constraint name, the health check behind `GET /api/health`, and the generated `db-types.ts`.
- Checks: ESLint rules against SQL built by concatenation or interpolation and against the driver outside `src/server/db`, proven by lint self-test samples; Squawk on every migration's up section and a refusal to edit migrations already on `main` (`pnpm db:lint`, part of `pnpm check`); schema tests in PGlite inside `pnpm check` (constraints by SQLSTATE and name, and the catalog conventions); `pnpm db:check`, which replays every migration up, down and up on a scratch database, compares the schema dump and the generated types, and runs the integration tests against real PostgreSQL.

## Links

- ADR-0011, [`0011-postgresql-for-records-search-vectors-and-jobs.md`](../decisions/0011-postgresql-for-records-search-vectors-and-jobs.md); ADR-0012, [`0012-kysely-and-sql-migrations.md`](../decisions/0012-kysely-and-sql-migrations.md); ADR-0013, [`0013-data-modeling-rules.md`](../decisions/0013-data-modeling-rules.md).
- The appendix, [`2026-09-27-database-research/`](2026-09-27-database-research/README.md), and the companion note on database craft, [`2026-09-27-database-craft.md`](2026-09-27-database-craft.md).
- The data model, [`docs/design/data-model.md`](../design/data-model.md); the `database` skill, `.claude/skills/database/`.
