# Vectors and photo hashes in PostgreSQL (pgvector 0.8.6 on PostgreSQL 18)

Embeddings live in the same database as everything else (owner, 2026-09-27; ADR-0011): `halfvec` side tables, exact search inside blocks first, an approximate index only when a measured query needs it, and duplicate photos found by a 64-bit perceptual hash rather than by embeddings. Nothing here is installed yet: CS-11 (duplicate detection) and CS-29 (photos) build it, and the embedding model is chosen with CS-8 (it must run or be reachable from Iran). The numbers come from the performance pass's lab (appendix `performance.md`, P-35 to P-45, and "Recommended pgvector setup"); what is marked **[lab 2026-09-27]** was checked on this repository's PostgreSQL 18.6 while writing this file. The vendored Tiger Data guide (`vendor/pgvector-semantic-search.md`) is useful background; where it differs, this file wins (`vendor/VENDORED.md` lists why).

## Installing it

- The image `pgvector/pgvector:0.8.6-pg18` already contains the extension. **`vector` is not a trusted extension**: `CREATE EXTENSION vector` run as `carshenas_migrate` failed with "Must be superuser to create this extension" [lab 2026-09-27]. So a superuser creates it before the migration that uses it: in `db/bootstrap/create-database.psql` for local and `pnpm db:check` databases, and in the server's bootstrap for production. The migration then only uses the type. (`pg_trgm`, `btree_gist`, `fuzzystrmatch` and `unaccent` are trusted and can be created by a migration.)
- The schema tests run in PGlite: add pgvector there with the separate package `@electric-sql/pglite-pgvector` (it carried pgvector 0.8.1 in the harness lab) in `schema-test-database.ts`.
- Pin the version and read the changelog before upgrading: 0.8.3 fixed possible HNSW corruption during vacuum and 0.8.4 a "graph not repaired" error; never go below 0.8.4. (Andrew Kane, pgvector changelog) [P-43]
- `shm_size: 1gb` in `compose.yaml` is for this: a parallel HNSW build on the default 64 MB `/dev/shm` failed with "could not resize shared memory segment … No space left on device". Keep `shm_size` at least `maintenance_work_mem` for the build. (pgvector README) [P-34]

## Decide whether you need an approximate index at all

Duplicate candidates are already narrowed by make, model and roughly year (CS-10's catalogue), so the search is "exact distance within a block of hundreds". In the lab a B-tree filter matching 977 of 50,000 rows followed by an exact cosine sort had **recall 1.000 in 5 ms**, and the planner chose that plan by itself once the B-tree existed; a whole-table exact scan of 50,000 × 512 took 58 ms as `halfvec`. Add HNSW only for a user-facing "similar listings across the whole market" query, or when an unfiltered exact scan passes about 100 ms. pgvector's exact search has perfect recall; an approximate index changes results. (Andrew Kane, Supabase) [P-35, H-18]

## The table

```sql
CREATE TABLE listing_embedding (
  listing_id bigint NOT NULL,
  kind       text NOT NULL CONSTRAINT listing_embedding_kind_valid CHECK (kind IN ('text', 'image')),
  model      text NOT NULL CONSTRAINT listing_embedding_model_format CHECK (model ~ '^[a-z0-9._-]+@[0-9-]+$'),
  embedding  halfvec(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_embedding_pkey PRIMARY KEY (listing_id, kind, model),
  CONSTRAINT listing_embedding_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE
);
COMMENT ON TABLE listing_embedding IS 'One embedding per listing, kind and model version; derived and rebuildable (CS-11).';
```

- **A narrow side table**, so crawler updates on `listing` never rewrite vectors and vectors never slow listing scans; its primary key starts with `listing_id`, so it also serves the cascade from `listing` (our foreign-key index rule). (Andrew Kane) [P-36, P-9]
- **`halfvec`**: half the size of `vector` with no measurable recall loss in the lab (0.998 against float32 truth). A 768-dimension `halfvec` is 1,544 bytes and stays inline [lab 2026-09-27]; above about 1,000 dimensions a row passes 2 kB and is TOASTed, which made exact scans five times slower (354 ms against 79 ms), so then `ALTER COLUMN embedding SET STORAGE PLAIN`. Choose a model of at most about 1,024 dimensions. Index limits: `vector` 2,000, `halfvec` 4,000, `bit` 64,000. [P-36, P-41]
- **Record the model and its version in every row**: vectors from different models are not comparable, and a model change means re-embedding into new rows, a new partial index, a switch of reads, then deletion of the old rows. [P-36, P-43]
- **NULL and, for cosine, zero vectors are never found.** A listing whose embedding failed is invisible to similarity search, so failures go to the review queue, not to a NULL column. [P-42]
- The generated Kysely type for `halfvec` is a string; add a `typeMapping` or an override in `.kysely-codegenrc.json` with the table, and a pool `onConnect` hook that registers pgvector's types (the `pgvector` npm package, `pgvector/pg`'s `registerTypes`, pinned) when CS-11 adds the first vector column. Not yet built or verified in this repository.

## Queries

```sql
-- Duplicate candidates: exact distance inside a block that a B-tree narrows first.
SELECT e.listing_id, e.embedding <=> $1::halfvec(768) AS distance
FROM listing_embedding e
JOIN listing l ON l.id = e.listing_id
WHERE l.model_id = $2
  AND l.model_year_sh BETWEEN $3 - 1 AND $3 + 1
  AND e.kind = 'text' AND e.model = 'e5-base@2026-10'   -- literals, so a partial index can apply
ORDER BY e.embedding <=> $1::halfvec(768)
LIMIT 20;
```

- **`ORDER BY <distance operator> LIMIT n`, with the operator matching the index's operator class** (`halfvec_cosine_ops` needs `<=>`), and the query vector cast explicitly (`$1::halfvec(768)`). Compute `1 - distance` only in the select list. With unit-length embeddings, inner product (`<#>`) is the fastest and ranks the same. (Andrew Kane) [P-42]
- **Settings per query, inside the query's transaction**: `SELECT set_config('hnsw.ef_search', '100', true)` (or `SET LOCAL`), which holds only until commit and is safe under a transaction pooler [lab 2026-09-27]. A session `SET` on a pooled connection leaks into the next request. In Kysely, a named helper in `src/server/db/sql-helpers.ts` (`kysely.md`).
- **Candidates are confirmed**, never trusted: structured fields (make, model, year, mileage, city), the photo hash, and a distance threshold that comes from CS-9's labelled pairs.

## When an approximate index is justified

- **HNSW with the default build options** (`m = 16`, `ef_construction = 64`), one **partial** index per kind and model, built after the backfill, `CONCURRENTLY`, alone in a `transaction:false` migration, in the worker's quiet hours:

  ```sql
  -- migrate:up transaction:false
  -- squawk-disable-assume-in-transaction
  -- squawk-ignore require-lock-timeout, require-statement-timeout
  CREATE INDEX CONCURRENTLY listing_embedding_text_e5_hnsw_idx
    ON listing_embedding USING hnsw (embedding halfvec_cosine_ops)
    WHERE kind = 'text' AND model = 'e5-base@2026-10';

  -- migrate:down transaction:false
  DROP INDEX CONCURRENTLY listing_embedding_text_e5_hnsw_idx;
  ```

  The build wants `maintenance_work_mem` of at least the index size (never above half the RAM) and `max_parallel_maintenance_workers = 2`. A `transaction:false` file cannot carry `SET` lines (a second statement makes PostgreSQL wrap the string in a transaction and the concurrent build fails with 25001), so put them on the connection for that run: `dbmate --url "$DATABASE_MIGRATE_URL&maintenance_work_mem=1GB&max_parallel_maintenance_workers=2" up` [lab 2026-09-27: both settings reached the migration session]. With 64 MB the lab build printed "hnsw graph no longer fits into maintenance_work_mem" and took 190 s; with 1 GB, 57 s. (Andrew Kane, Neon) [P-37, P-38]
- **Recall is a property of our data, not of pgvector.** The same HNSW index had recall@10 of 0.87 at `ef_search` 40, 0.978 at 100 (2.5 ms) and 0.999 at 200 on structured vectors, and 0.077 to 0.48 on random ones; IVFFlat needed `probes = 20` for 0.95 and suits only static data. Start at `ef_search = 100`; raise `m` only if recall plateaus. [P-37, P-39]
- **Size before you build**: about 1.3 kB per row for a 512-dimension `halfvec` index, so about 2 kB at 768; 300,000 listings is roughly 600 MB, which fits an 8 GB VPS and strains a 4 GB one. Then a binary-quantised expression index with re-ranking: 18 MB instead of 65 MB, recall 0.913 re-ranking the top 100 and 0.976 the top 200. If latency rises while CPUs idle, the index no longer fits in memory. [P-41]

## Filtered vector search

With an approximate index, **the filter runs after the index scan**: HNSW returns `ef_search` candidates and only then applies `WHERE`, so for a filter matching 2 % of rows the lab got 0.9 rows back on average instead of 10 (recall 0.09). Choose by the filter's selectivity: a selective filter (one model, one city and year) goes B-tree first and exact (10 of 10, recall 1.00, 5 ms); a broad filter uses HNSW with `hnsw.iterative_scan = relaxed_order` (10 of 10, recall 0.98, 13 ms; `hnsw.max_scan_tuples`, default 20,000, is the budget); a handful of fixed filter values can get partial indexes. After a relaxed scan, re-sort by exact distance in a `MATERIALIZED` CTE when order matters. Always measure tuples visited and p95 under realistic load. (Andrew Kane: "With approximate indexes, filtering is applied after the index is scanned.") [P-40, H-19]

## Recall is an evaluation, with numbers

Vector search is an AI step under AGENTS.md, so it ships with its accuracy: a fixed set of labelled duplicate pairs (CS-9) and about 100 sampled queries; exact results computed with `SET LOCAL enable_indexscan = off`; recall@10 and the duplicate-pair hit rate reported with every change of model, dimension, index option or `ef_search`, and weekly in production on a sample (target at least 0.95, an inference to confirm). [P-39, H-18]

## Keeping the index healthy

`REINDEX INDEX CONCURRENTLY` before a long vacuum on the embeddings table; batch embedding writes in the worker (each HNSW insert is a graph search); watch index size against RAM and `pg_statio_user_indexes` hit ratios; warm indexes with `pg_prewarm` before measuring. [P-43, P-19]

## Duplicate photos: a 64-bit perceptual hash, not embeddings

Cross-posted listings reuse the same photos, resized, recompressed and sometimes watermarked; a perceptual hash is built for exactly that, while an image embedding also matches different photos of similar cars (two white Pride 131s). The worker computes a 64-bit pHash when it stores a photo (CS-29) and keeps it as `bigint` beside the photo; the Hamming distance is `bit_count((phash # $1)::bit(64))` [lab 2026-09-27: `x'FF'` against `x'F0'` gave 4]. (Neal Krawetz; Manku, Jain and Das Sarma at Google; Meta's PDQ) [P-45]

| Method, 500,000 hashes, 100 near-copies with 0 to 6 bits flipped | Index size | Build | Per query | Found |
|---|---|---|---|---|
| sequential scan, `bit_count` on XOR | none | none | 44 ms | 100 / 100 |
| multi-index hashing: four 16-bit chunks, each probed with its 16 one-bit variants through B-tree expression indexes (exact up to 7 bits) | 60 MB | under 1 s | 0.8 ms | 100 / 100 |
| pgvector HNSW on `phash::bit(64)` with `bit_hamming_ops` | 148 MB | 191 s | 1.1 ms (ef 40) | 92 / 100 |

Start with the sequential scan limited to the same model (a few thousand rows, well under a millisecond); move to multi-index hashing when checks across the whole market matter; skip HNSW for 64-bit hashes (approximate, bigger than the table, slow to build). Calibrate the threshold on labelled Carshenas pairs in CS-11: Krawetz's rule of thumb is up to about 10 bits for a variation, and watermarks and crops move hashes further. If 64-bit hashes miss too many watermarked copies, try Meta's 256-bit PDQ (four times the storage). Image embeddings come later, if at all, as a second candidate source, always confirmed by structured fields. [P-45]

## Hybrid search

Keyword and vector results fuse with reciprocal rank fusion in one SQL statement: two CTEs limited to about 50 rows (the text leg ranked by `ts_rank_cd` or trigram similarity, the vector leg by distance), a `FULL OUTER JOIN` on `id`, score `coalesce(1.0 / (k + kw.rank), 0) + coalesce(1.0 / (k + sem.rank), 0)`, `k` about 60 (pgvector's example; Supabase uses 50), tuned on the evaluation set. Not measured on Persian listings yet. [P-44]
