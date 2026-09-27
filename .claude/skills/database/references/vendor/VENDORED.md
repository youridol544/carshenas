# Vendored database guidance

One third-party file, copied at a pinned commit on 2026-09-27 under Apache-2.0 (licence and NOTICE alongside, as Apache-2.0 section 4 requires). It is reference reading for the `database` skill, not a skill of its own. **`../../SKILL.md` and the project references (`../craft.md`, `../vectors.md`) take precedence** wherever they disagree.

Copied, not installed: pg-aiguide's Claude Code plugin routes questions to a hosted MCP server (`mcp.tigerdata.com`), a US service that also sends every question off the machine. To update the file, re-copy it at a new commit, read the diff, and change the table below. Why this file and nothing else from the database skills we read: `docs/research/2026-09-27-database-research/harness.md`, entries 1 to 16.

| File | Source | Commit | Edits made here |
|---|---|---|---|
| `pgvector-semantic-search.md` | github.com/timescale/pg-aiguide, `skills/pgvector-semantic-search/SKILL.md` | `b236d3583fb51f5ef009d2c95d4fc361df748280` (2026-09-25) | YAML frontmatter removed so it cannot register as a skill; a one-line HTML comment added at the top naming the source, the commit and the change |
| `LICENSE.pg-aiguide`, `NOTICE.pg-aiguide` | the same repository's `LICENSE` (Apache-2.0) and `NOTICE` | same | none |

Checked on 2026-09-27: its HNSW index with `halfvec_cosine_ops` (also on an empty table), `SET LOCAL hnsw.ef_search`, `hnsw.iterative_scan = relaxed_order` and `hnsw.max_scan_tuples` ran on PostgreSQL 18.6 with pgvector 0.8.6; the harness pass had already run its `binary_quantize` generated column on 0.8.6. Its examples use a neutral `items` table.

Where Carshenas differs (our rules win; reasons and measurements in `../vectors.md` and `../craft.md`):

- **"Use HNSW indexes by default" and the golden path.** We start with exact search inside a block that a B-tree narrows (recall 1.00 in 5 ms in the lab) and add HNSW only for whole-table similarity or when an exact scan passes about 100 ms (owner decision of 2026-09-27; P-35).
- **`CREATE EXTENSION IF NOT EXISTS vector;` "in each database".** `vector` is not a trusted extension: our migration role cannot create it ("Must be superuser", measured), so the superuser bootstrap does, and versioned migrations never use `IF NOT EXISTS` (H-4).
- **Unnamed `CREATE INDEX ON items …`.** Every index is named `<table>_<meaning>_idx`, and on a table with rows it is built `CONCURRENTLY`, alone in a `transaction:false` migration with no `SET` lines (a second statement makes the build fail with 25001, measured).
- **Session `SET hnsw.ef_search = 100`.** On pooled connections a session setting leaks into the next request: use `SET LOCAL` or `set_config(…, true)` inside the query's transaction (P-42).
- **Bulk loading with `SET maintenance_work_mem = '4GB'` and `max_parallel_maintenance_workers = 7`.** Our VPS has about 4 GB and 2 cores: at most half the RAM (1 GB), 2 workers, Docker `shm_size` at least `maintenance_work_mem`, and in a `transaction:false` migration the settings go on the connection (`../vectors.md`; P-34, P-38).
- **The embedding in the main table** (`items.embedding`). We keep embeddings in a narrow side table (`listing_embedding`) so crawler updates never rewrite vectors and vectors never slow listing scans; a `halfvec(1536)` row is about 3 kB and would be TOASTed, which made exact scans five times slower (P-36). We aim for a model of at most about 1,024 dimensions.
- **Its recall and RAM tables** ("~95%" at `ef_search` 40; vectors per GB of RAM) are orders of magnitude, not guarantees. Our lab measured recall@10 of 0.87 at 40 on structured vectors and 0.08 on random ones: recall is measured on our own labelled pairs (P-37, P-39, P-41).
- **Cosine by default.** Fine; with unit-length embeddings inner product ranks the same and is fastest (P-42).
- **"Partitioning by time using hypertables" and pgvectorscale's StreamingDiskANN** need TimescaleDB extensions that are not in our image and are not planned.
- **Photos.** The guide does not cover them; we detect duplicate photos with a 64-bit perceptual hash and an exact Hamming search, not embeddings (P-45).
