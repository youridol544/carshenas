# ADR-0011: PostgreSQL 18 is the only data service: records, search, vectors and the job queue

- Status: accepted; its point 5 is made concrete by ADR-0018 (2026-09-29: one pg-boss lane per crawled source, request pacing in PostgreSQL)
- Date: 2026-09-27 (decided by the owner on 2026-09-27)
- Deciders: Pedrum
- Related: supersedes ADR-0007; ADR-0003, ADR-0008, ADR-0010, ADR-0012, ADR-0013; tasks CS-4, CS-6, CS-8, CS-11, CS-14, CS-15, CS-16, CS-23; `docs/research/2026-09-27-postgresql-only-data-stack.md` and its appendix

## Context

ADR-0007 proposed PostgreSQL as the record and Elasticsearch as a derived search index. On 2026-09-27 the owner questioned the index: "introudcion elastic to system only adds complexity. very costy in deployments and it makes polyglot persistance issues for now", and "i dont want to use elastic only because torob team uses it". The research measured PostgreSQL's own search on synthetic Persian listings: at 300,000 listings a complete search call (query, first 20 results, facets, total) took p95 92 ms with one client and 78 ms at 100 calls per second; at 1,000,000, p95 116 ms with sampled facets for broad queries. Facet counts are the expensive part, and sorting by a computed relevance score is slow where sorting by an indexed column is not. Elasticsearch would add a JVM service of about 4 GB, a synchronisation pipeline with a window of stale results, and download terms that name Iran as a prohibited destination.

## Decision

1. **PostgreSQL 18 is the system of record and the only data service**, run from the pinned image `pgvector/pgvector:0.8.6-pg18`. Locally, `pnpm db:up` starts it from `compose.yaml` with the settings in `db/postgresql.conf` (written for a 4 GB VPS) and the roles in `db/bootstrap/` (`docs/runbooks/local-database.md`).
2. **Search runs in PostgreSQL**: the `simple` text-search configuration over a Persian normaliser (Arabic ي and ك, the zero-width non-joiner, three digit scripts), a generated `tsvector` with a GIN index, an alias table applied with `ts_rewrite` for Latin-typed and variant names, `pg_trgm` and a vocabulary for typos, facets that are precomputed, cached or sampled rather than counted live for broad queries, default sorts on indexed columns with composite indexes that lead with the equality column, and keyset pagination. The `database` skill's `references/search.md` has the design.
3. **No search engine now.** OpenSearch (Apache-2.0; never Elasticsearch, whose terms exclude Iran) or ParadeDB is added only when one of the measured triggers in the research note fires on production data after the cheaper fix listed beside it has been tried, and then only as an index derived from PostgreSQL and rebuilt from it.
4. **Vectors live in the same database** with pgvector: `halfvec` columns in side tables, exact search inside a block (a make or a model) first, an HNSW index only when a measurement needs one, with iterative scans for filtered queries and recall checked against exact search. Duplicate photos are compared first by a 64-bit perceptual hash stored as `bigint`.
5. **Background work runs in a worker process outside Next.js** (CS-6), fed by **pg-boss 12** on the same database: one queue per job kind, a per-source concurrency limit for crawling, follow-up jobs enqueued in the same transaction as the rows they need, dead letters, and schedules in `Asia/Tehran`. The worker's guardrails are in the research note.
6. **LLM steps keep ADR-0007's point 4**: versioned prompts that carry the glossary, outputs validated against a strict schema with a confidence per field and a review queue below the threshold, results cached by input hash, numbers a user sees always from the database, and no AI step without a labelled evaluation set and a reported accuracy (CS-9).
7. **Listing photos** stay as ADR-0010 decided.

## Alternatives considered

- **Elasticsearch as a derived index (ADR-0007)**: better text relevance, a maintained Persian analyser and fast aggregations, none of which CS-14's criteria need; a second store to feed, monitor, back up and host inside Iran, and terms that exclude Iran.
- **ParadeDB `pg_search`**: BM25 inside PostgreSQL, but AGPL and single-node in its community edition. It is the first candidate if a trigger fires.
- **Meilisearch or Typesense**: simple, but another service with less control over Persian analysis.
- **A vector database (Qdrant)**: unnecessary at this scale; one database keeps writes transactional.
- **Redis with BullMQ, or graphile-worker**: Redis is one more service; graphile-worker (the runner-up) holds a crashed job's lock for four hours and schedules only in UTC.
- **PostgreSQL 17**: lacks what our rules use from 18: `uuidv7()`, `RETURNING old/new`, `NOT NULL … NOT VALID`, virtual generated columns and `WITHOUT OVERLAPS`.

## Consequences

- Positive: one service to run, back up, secure and pay for; no dual writes, so search sees a committed change at once; the whole model is one schema that constraints, tests and agents can read.
- Negative / risks: facets need precomputation and caching; ranking by text relevance is weak, so default sorts stay on indexed columns (deal score first); we maintain the Persian normaliser and aliases ourselves and must evaluate them on real queries (CS-14); vector index builds share the machine's memory (`shm_size` is set in `compose.yaml`); pg-boss adds its own schema.
- Follow-ups: CS-14 builds search in PostgreSQL; CS-6 adds the worker and pg-boss; CS-11 adds vectors; CS-22 runs the database checks in CI; CS-23 hosts PostgreSQL 18 with backups inside Iran and re-derives `db/postgresql.conf` for the real VPS.
