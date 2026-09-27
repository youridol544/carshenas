# Lab SQL kept from the CS-4 research

The scripts from the research session worth running again. Everything else the passes name (benchmark queries, logs, outputs, per-library projects) was throwaway and was not kept. None of these files is a migration: they build their own tables in a scratch database, and they never touch the `carshenas` database.

| Folder | Pass | Measured on | What it reproduces |
|---|---|---|---|
| `search/` | `../search.md` (pass A) | PostgreSQL 17.11, pgvector 0.8.6 | The Persian normaliser, a synthetic listing table with its generated `tsvector`, the alias table, the typo vocabulary and corrector, the query builder `fa_query_pl`, the facet mitigations (covering index, sampling) and the equality-first sort composites that fix the LIMIT trap |
| `data-model/` | `../data-model.md` (pass F) | PostgreSQL 17.11, pgvector 0.8.6 | The crawled-now model, the additive native-listings migration with before and after fingerprints, 60 constraint cases and a purge for a removal request |
| `performance/` | `../performance.md` (pass D) | PostgreSQL 17.11 | `07-report.sql`: the top statements by total time from `pg_stat_statements`, sequential against index scans per table, and unused indexes |

`search/fa_normalize.sql` is the normaliser on its own; it needs `immutable_unaccent()`, which `search/01-schema.sql` creates, and `01-schema.sql` also contains the normaliser.

## Rerun on PostgreSQL 18

On 2026-09-27 every file here also ran on PostgreSQL 18.6 with pgvector 0.8.6 (the `pgvector/pgvector:0.8.6-pg18` image that `compose.yaml` pins), in a scratch container: the `data-model/` chain exited 0 at every step, its tests reported 60 passed and 0 failed, and the native migration left the fingerprints of `listing`, `listing_price_event` and `snapshot` unchanged; the `search/` scripts all exited 0 with 20,000 generated listings, correcting «پزو ۲۰۶» to `'پژو' & '206'` and rewriting "peugeot 206" to `'206' & ( 'peugeot' | 'پژو' )`. The timings in the passes are from 17.11 and were not re-measured.

To run them against the container that `pnpm db:up` starts, create a scratch database of your own and never pass `-d carshenas`:

```bash
# From the repository root, with `pnpm db:up` running.
psql_lab() { docker compose exec -T postgres psql -U postgres -X --no-psqlrc -v ON_ERROR_STOP=1 "$@"; }
psql_lab -c 'CREATE DATABASE carshenas_lab'

# data-model: the same order as data-model/run.sh
m=docs/research/2026-09-27-database-research/lab/data-model
cat $m/00_extensions.sql $m/01_core.sql $m/03_indexes.sql | psql_lab -d carshenas_lab
cat $m/10_seed_crawled.sql | psql_lab -d carshenas_lab
cat $m/11_queries_crawled.sql | psql_lab -d carshenas_lab
cat $m/12_before_native.sql $m/02_native.sql $m/13_after_native.sql | psql_lab -d carshenas_lab
cat $m/20_seed_native.sql | psql_lab -d carshenas_lab
cat $m/30_tests.sql | psql_lab -d carshenas_lab   # ends with: passed 60, failed 0
cat $m/40_purge.sql | psql_lab -d carshenas_lab
```

For the search lab use a second scratch database (`CREATE DATABASE carshenas_lab_search`) and run, in order: `01-schema.sql`, `02-catalogue.sql`, `03-generate.sql`, then `call generate_listings(300000);` (the passes' size; 20,000 is enough to see the behaviour), then `04-indexes.sql`, `05` to `09`, `CREATE EXTENSION pg_prewarm;`, `13-facet-mitigations.sql`, `14-sort-composites.sql` and `15-match-estimate.sql`. `08-bench-setup.sql` builds the query sets that `09` refreshes.

For `performance/07-report.sql`, run `CREATE EXTENSION pg_stat_statements;` in the scratch database first (the Compose server preloads the library; the extension itself lives only in the `postgres` database), run a workload, then the report. For the application's own database, `pnpm db:top-queries` and `pnpm db:unused-indexes` do the same job.

`data-model/run.sh` is the script the research session used: it expects its own `pgvector/pgvector:pg17` container named `carshenas-lab-model` and recreates `carshenas_lab` there. Use the commands above instead against the Compose container. Removing a scratch database is a `DROP DATABASE`, which the project's command guard leaves to a person (`docs/runbooks/local-database.md`).

`data-model/00_extensions.sql` installs `pgcrypto` only to fake phone HMACs with a lab key; in Carshenas the worker computes the HMAC and the key never enters SQL (ADR-0008 point 7).
