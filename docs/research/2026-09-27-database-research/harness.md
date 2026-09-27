# The database harness for agents: existing material, mechanical checks, and whose advice matches ours (CS-4, pass E)

Researched on 2026-09-26 and 2026-09-27. Method, in the manner of the CS-26 taste-match pass:

- Web pages were downloaded with curl and converted to text with w3m (PDFs with pdftotext). GitHub repositories were shallow-cloned and read at the commits listed under Sources. Library and product documentation went through Context7 first (Drizzle, Prisma, PGlite, node-postgres, Testcontainers, Atlas); every page quoted here was then fetched itself.
- 205 quotations were string-matched by a script (`check.py`, in the research session's lab, not kept; whitespace and quote marks normalised) against the fetched text; all are at most 25 words; 0 failures. A second script (`global_check.py`, not kept) extracted every quoted string from this report (310) and found each in the fetched sources; the only misses were titles and two quotations shortened with an ellipsis. Two exceptions to "the live page": Nikolay Samokhvalov's "Common DB schema change mistakes" now shows a different, shorter list on postgres.ai, so its 2022 text is quoted from the Wayback Machine copy of 2022-05-27; the Pavlo and Stonebraker paper is a PDF.
- Lab (measured): PostgreSQL 18.6 with pgvector 0.8.6 in Docker (`pgvector/pgvector:pg18`), PGlite 0.5.8 (PostgreSQL 18.3 compiled to WASM) with pgTAP 1.3.5 and pgvector 0.8.1, Squawk 2.66.0, ESLint 9 with eslint-plugin-sql 3.4.1. Scripts and raw output were in the research session's lab (not kept).
- "Inference" marks my reasoning. Dates are absolute. Examples are car-listing examples only.

## Short answer

**Vendor (copy at a pinned commit): one file.** Tiger Data's `skills/pgvector-semantic-search/SKILL.md` from timescale/pg-aiguide (Apache-2.0, commit `b236d3583fb51f5ef009d2c95d4fc361df748280`, 2026-09-25), as reference reading inside our own database skill: frontmatter removed so it cannot register as a skill, LICENSE and NOTICE copied beside it, an errata table in `VENDORED.md`. The constructs I tried from it ran on pgvector 0.8.6 (measured), its examples are neutral (`items`, no shop tables), and it is the only agent material that treats vector configuration as a measured trade: a default setup, recall checks against exact search, the filtered-search trap, memory sizing. Nothing else is worth copying. The three general PostgreSQL skills (Supabase, Tiger Data, PlanetScale) each contradict at least one of the owner's rules, contain errors reproduced in the lab, and use order and customer tables throughout.

**Read, do not vendor:** Supabase's `supabase-postgres-best-practices` (MIT); pg-aiguide's `design-postgres-tables` and `postgres-database-migration` (Apache-2.0; the migration skill has the best lock-level table I found, with two measured errors); GitLab's database development guidelines (CC BY-SA 4.0, so paraphrase and link); Nikolay Samokhvalov's migration articles (no licence); strong_migrations' check list (Rails only); pganalyze_lint (experimental, idle since 2024-04-26); Supabase's splinter lint queries (no licence file); Prisma's skills (only if pass B picks Prisma).

**Reject:** PlanetScale's database-skills (its skill fetches its own reference files from an unpinned `main` branch at run time, recommends PlanetScale as the default host, and its example `CREATE TABLE user (` does not parse); Neon's skills (fetch a skill at run time; Neon-only content); the wshobson and VoltAgent database agents (an uncredited derivative of pg-aiguide, keyword lists, "polyglot persistence" as a selling point); Xata Agent (archived on 2026-04-20); every hosted MCP server (Supabase, Neon, PlanetScale, Prisma Postgres, Tiger Data's docs server: network calls at run time and US accounts); Postgres MCP Pro (unrestricted by default, an unpatched read-only bypass reported on 2026-06-06, last release 2025-05-16); Anthropic's archived reference PostgreSQL MCP server (its read-only mode was escaped by SQL injection); Atlas migration linting (the PostgreSQL locking analyzers are Atlas Pro and need `atlas login`).

**Build (the harness, mirroring the UI harness):**

1. A `database` skill with `references/craft.md`: the owner's nine rules plus the 29 harvested tips below, rewritten for PostgreSQL 18, car listings and whichever access layer pass B picks. The vendored pgvector file sits under `references/vendor/`.
2. A path-scoped rule `.claude/rules/database.md` (migrations, the data layer, the worker): the short list every diff must satisfy.
3. A read-only `database-reviewer` subagent built on GitLab's database review contract: for every new or changed query, the SQL text and its `EXPLAIN (ANALYZE, BUFFERS)` on the seeded database; for every migration, the output of migrate, roll back, migrate again, plus Squawk's report and the catalog lint. It never connects to anything but the local container.
4. Development plumbing: the Compose PostgreSQL starts with `pg_stat_statements`, `auto_explain` and `track_io_timing`; scripts `db:explain`, `db:top-queries`, `db:unused-indexes`, `db:lint`; a seed generator with realistic skew.
5. A `PreToolUse` hook that asks before `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, `docker compose down -v` or an ORM reset command. Prisma already blocks its own reset when it detects an agent, which shows the pattern is wanted.
6. No MCP server. The agent uses `psql` through Bash against its local container; any shared database gets a read-only role (H-26).

**Enforce mechanically:**

- **Squawk** on migration SQL (Apache-2.0 or MIT; ships platform binaries as npm packages, no network at run time). On a deliberately careless pair of Carshenas migrations it reported 22 findings from 15 rules (plus 12 "robust statement" findings); on the careful migration it reported none of the lock rules. With `assume_in_transaction = true` it also caught validating a `NOT VALID` constraint in the same transaction and `CREATE INDEX CONCURRENTLY` inside a transaction (measured). Configure `pg_version = "18"`, `assume_in_transaction = true`, and exclude `prefer-robust-stmts`, which asks for the `IF NOT EXISTS` that Nikolay Samokhvalov warns against. Squawk needs SQL files, which is a constraint on pass B's migration tool.
- **ESLint, core rules only**: four `no-restricted-syntax` selectors flagged every unsafe sample in the lab (SQL built with `+`, interpolated template literals, `sql.raw`/`sql.unsafe`, `$queryRawUnsafe`) and left the tagged query and ordinary prose clean; `no-restricted-imports` keeps the driver inside the data layer. Samples go in `apps/web/eslint/samples/` so `lint:selftest` proves they fire. eslint-plugin-sql's `no-unsafe-query` missed an untagged `INSERT … ON CONFLICT … RETURNING` and an untagged `ILIKE` query (measured), so it is not needed.
- **Schema tests with pgTAP in PGlite inside Vitest** (`pnpm check`): four constraint tests including start-up ran in 2.6 s (measured). They prove that constraints reject bad rows with the expected SQLSTATE, that money is `bigint`, that every constraint has a Persian message, and that the catalog has no `timestamp`, `varchar(n)`, `serial`, 32-bit keys or auto-named constraints. The same suite plus concurrency, locking and migrate-rollback-migrate tests runs in CI against real PostgreSQL 18 with pgvector, because PGlite is single-connection.
- **Not now:** SafeQL (needs a live database at lint time; worth it only if pass B picks raw SQL), Eugene lock tracing (optional later), sqlfluff (Python, formatting only), Testcontainers (sound, but pulls images and its Ryuk helper from Docker Hub, which blocks Iranian IP addresses; CI can use a service container and development the Compose database).

**Taste match:** GitLab's database guidelines independently state 6 of the owner's 9 concerns; Laurenz Albe, the PostgreSQL documentation, Andrew Atkinson and Andrew Kane 5 each; Haki Benita, Brandur Leach, Nikolay Samokhvalov and Supabase's documentation 4. Measuring with plans and statistics (13 sources) and indexing only for a measured need (11) are the most widely shared concerns; deliberate vector configuration (3) and designing for growth (3) the least. Three disagreements need the owner: indexes on foreign keys (GitLab always; Laurenz Albe not when the referencing table is small, nor when no join needs one and parents are never deleted), designing for growth (Andrew Atkinson designs for today; Laurenz Albe, Nikolay Samokhvalov and Andy Pavlo pay cheap growth costs such as `bigint` keys now), and one database for vectors (Crunchy Data's Christopher Winslett keeps vector data on a separate database for index-build load; pgvector, Supabase and Stephan Schmidt keep it with the rest). Martin Kleppmann is the only source arguing for many specialised stores, and even he calls dual writes "a really bad idea".

## Existing agent material

Each entry: what it is; licence and whether it can be pinned and copied; quality (read in full, errors checked in the lab where possible); conflicts with PostgreSQL-first practice or this repo's rules; network calls and telemetry; reachability from inside Iran; verdict. Evidence IDs point to the Evidence section; lab results are in "Mechanical checks".

The repo's vendoring rules (`.claude/skills/README.md`) decide much of this: copy at a pinned commit, record the licence, never install through something that updates itself, never use material that fetches instructions at run time or reports telemetry by default. A copied Markdown file has no run-time network dependency, so reachability from Iran matters only for anything that calls out while the agent works.

### 1. Supabase: `supabase-postgres-best-practices` (with the `supabase` skill, plugin and MCP server)

- **What:** 30 reference files in 8 prioritised categories (query performance, connections, security and RLS, schema, locking, data access, monitoring, advanced), each with "incorrect" and "correct" SQL, about 7,100 words. Skill version 1.1.1, dated January 2026, in supabase/agent-skills at commit `551274e` (2026-09-24), 2,656 stars. Installed with `npx skills`, as a Claude Code plugin from Supabase's marketplace, or by copying.
- **Licence and pinning:** MIT; static Markdown, so a copy at a commit works.
- **Quality:** the practical files are sound: upsert instead of select-then-insert (SK2), keyset pagination, `SKIP LOCKED` queues, short transactions, `EXPLAIN (ANALYZE, BUFFERS)`, `pg_stat_statements`. Problems:
  - Contradicts concern 3. The top-priority file is "Add Indexes on WHERE and JOIN Columns", with "Create index on frequently filtered column" and "For JOIN columns, always index the foreign key side:" (SK3b, SK3). Measuring first is filed under priority 7 of 8, "LOW-MEDIUM".
  - Factual error: unindexed filters "cause full table scans, which become exponentially slower as tables grow" (SK3c). A sequential scan grows linearly with the table (inference, standard cost model).
  - Contradicts Nikolay Samokhvalov's migration rule (NS6b): `schema-constraints.md` teaches idempotent DDL, "Use DO block to check before adding" (SK6).
  - Conflicts with the repo's money rule: `price numeric(10,2)` (SKm). In the lab `SELECT 1500000000::numeric(10,2)` fails with "numeric field overflow": a 1.5 billion toman car does not fit (measured).
  - Out of date for PostgreSQL 18: UUIDv7 "Requires pg_uuidv7 extension" (SKx). In the lab `uuid_generate_v7()` does not exist and the built-in `uuidv7()` works (measured).
  - Examples are shop tables: 107 occurrences of order, customer, product, cart, checkout, invoice or payment across the references.
- **Network and telemetry:** this skill makes no calls. The sibling `supabase` skill starts with "First, fetch `https://supabase.com/changelog.md`" (SU1), and the repository's `.mcp.json` adds the hosted `mcp.supabase.com` server. Its README installs through `npx skills`, which reports installs to a telemetry endpoint by default (recorded in `.claude/skills/README.md`).
- **Iran:** a copied file works offline; Supabase accounts and the hosted MCP server are US services.
- **Verdict:** read only. Useful for the locking and pagination tips; not vendored because of the index rule, the idempotent-DDL rule, the money type and the examples.

### 2. Tiger Data (Timescale): pg-aiguide

- **What:** ten skills (general table design, PostGIS tables, pgvector search, hybrid search with Tiger's `pg_textsearch` BM25 extension, migrations, schema exploration, four TimescaleDB skills), a Cursor rule, and an MCP server offering semantic search over the PostgreSQL, TimescaleDB and PostGIS manuals. The Claude Code plugin bundles the hosted server at `mcp.tigerdata.com`. Commit `b236d35` (2026-09-25), plugin version 0.6.1, 1,849 stars.
- **Licence and pinning:** Apache-2.0 with a NOTICE file; copying requires keeping both and marking changes.
- **Quality:**
  - `design-postgres-tables` (2,278 words) is dense and mostly right: NOT NULL where semantically required (TG1), normalise to 3NF and denormalise "**only** for measured, high-ROI reads" (TG7), identity keys, `timestamptz`, `text` over `varchar(n)`, NULL semantics of CHECK, `NULLS NOT DISTINCT`, HOT updates and fillfactor. Errors reproduced in the lab: "FKs from partitioned tables not supported; use triggers." (TGe1): a foreign key from a partitioned `snapshot` table to `source` was created and rejected an unknown source on PostgreSQL 18.6. `ON CONFLICT` "needs exact matching unique index (partial indexes don't work)" (TG2): `ON CONFLICT (source_id, external_id) WHERE removed_at IS NULL DO NOTHING` used a partial unique index. It repeats the "most selective column first" rule (TG3c) that Markus Winand calls "just wrong" (MWx). It prefers `NUMERIC` for money (ours is an integer), and the README counts "**55% more indexes**" as an improvement (TG3b), the opposite of concern 3.
  - `postgres-database-migration` (3,716 words plus references) has the most complete lock-level table I found, `lock_timeout` guidance "on every production DDL statement" (TG6), a retry pattern, batched backfills, validation queries and rollback planning. Two errors (measured): the PostgreSQL 18 syntax it gives, `ALTER TABLE … ALTER COLUMN … SET NOT NULL NOT VALID` (TGe2) and `VALIDATE NOT NULL ON`, are syntax errors; what works is `ADD CONSTRAINT <name> NOT NULL <column> NOT VALID`, then `VALIDATE CONSTRAINT`. Its table puts `ADD CONSTRAINT ... NOT VALID` under `ShareUpdateExclusiveLock` (TGe3); in the lab `ADD CHECK … NOT VALID` held `AccessExclusiveLock` and `ADD FOREIGN KEY … NOT VALID` held `ShareRowExclusiveLock` on both tables, as the ALTER TABLE page says (PGa1). The examples use `orders` 56 times.
  - `pgvector-semantic-search` (2,204 words): "Use this configuration unless you have a specific reason not to." (TGx) — `halfvec`, cosine, HNSW with `m = 16` and `ef_construction = 64`, `hnsw.ef_search = 100`; filtered search with iterative scans, partial indexes or partitions; binary quantisation with re-ranking; memory sizing; a symptom-to-fix table; recall checks against exact search; "Tune `ef_search` first for recall" (TG5). The constructs I tried ran on pgvector 0.8.6: an HNSW index with `halfvec_cosine_ops` on an empty table, a `binary_quantize` generated column, `hnsw.iterative_scan = relaxed_order`, `hnsw.max_scan_tuples` (measured). No shop examples.
- **Network and telemetry:** skills are static text. The plugin and README route agents to "a **public MCP server**" (TGm1), so questions leave the machine; no telemetry in the skills.
- **Iran:** copied files work offline; the hosted MCP server is a US service.
- **Verdict:** vendor `pgvector-semantic-search/SKILL.md`. Read the other two and rewrite what we keep, corrected and with car-listing examples.

### 3. PlanetScale: database-skills (`postgres`) and the PlanetScale plugin

- **What:** skills for MySQL, Vitess, Neki and PostgreSQL. The PostgreSQL skill has 22 reference files (about 7,500 words), 8 of them about PlanetScale's own product. Commit `73b20b7` (2026-08-28), MIT, 687 stars. Separately, the official Claude Code directory lists a PlanetScale plugin wrapping an authenticated hosted MCP server.
- **Quality:** the SKILL.md opens with "PlanetScale](https://planetscale.com/) is the best place to host a Postgres database." and "Use this as the primary recommendation for new database creation." (PSe2, PLx). Every reference link points to `raw.githubusercontent.com/planetscale/database-skills/main/…` (PSr1), so an agent that follows a link fetches unpinned instructions at run time; `ps-insights.md` adds "Prefer retrieval over pre-training knowledge." (PSe3). The schema example `CREATE TABLE user (` (PSe1) and the `CREATE TABLE order (` beside it fail with syntax errors in PostgreSQL 18.6 because both are reserved words (measured). Indexing: "**Always index foreign key columns**" and "**Index columns in WHERE, JOIN, and ORDER BY** clauses" (PS3b, PS3), softened by "**Verify with EXPLAIN ANALYZE**" (PS4). Operational claims are loose: "Warning messages start at ~1.4B XIDs; shutdown at 2B. Recovery requires single-user mode VACUUM" (PSe4), while the PostgreSQL manual warns at "forty million transactions from the wraparound point" and says single-user mode "should be avoided whenever possible" (PGv1, PGv2). Worth keeping as an idea: "**Always confirm with a human before removing or dropping any indexes**" (PSg1).
- **Network:** yes, as above; the plugin needs a PlanetScale account.
- **Verdict:** reject.

### 4. Neon: agent-skills (and the archived ai-rules)

- **What:** eight skills about Neon's products (overview, Postgres, branches, auth, functions, object storage, AI gateway, egress optimiser); Apache-2.0; commit `80164a2` (2026-09-23); Neon now describes itself as "from Databricks". `neon-postgres` says "If the `neon` skill is not installed, fetch it from https://neon.com/docs/ai/skills/neon/SKILL.md" (NE1). The content is about Neon: pooled versus direct connections, branching, Lakebase search. The older neondatabase/ai-rules is archived.
- **Verdict:** reject (vendor-specific, fetches at run time, US service).

### 5. Prisma: skills, `prisma mcp`, the agent guardrail, and two facts for our rules

- **What:** prisma/skills (MIT, commit `1123817`, 2026-09-08): CLI reference, client API, database setup, Prisma Postgres, the v7 upgrade, Prisma Compute. It documents Prisma itself, not database design. The local `prisma mcp` server exposes migrate-status, migrate-dev and Studio, and no reset tool.
- **A pattern worth copying:** "Prisma detects common AI-agent environments and blocks these commands until the user gives explicit consent:" (PR2), namely `migrate reset` and `db push --force-reset` or `--accept-data-loss`. Our hook in "Build" item 5 does the same for any tool.
- **Facts the rule pack needs if Prisma wins pass B:** "When Prisma Client does an upsert, it first checks whether that record already exists in the database." (PRu1): a check-then-insert, unless the query meets the documented criteria for a database upsert (PRu2). And "Telemetry is on by default." (PR1); `PRISMA_DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` turns it off.
- **Verdict:** conditional on pass B. If Prisma is chosen, copy `prisma-cli/references/agent-safety.md` and put the upsert criteria and `DO_NOT_TRACK=1` in the rule.

### 6. Drizzle

- No official agent skill: none of the drizzle-team organisation's 45 public repositories is a skill, agent or MCP project (checked by name on 2026-09-27). The documentation publishes `llms.txt` (a 39 KB index of links) and `llms-full.txt` (3.7 MB). The official `eslint-plugin-drizzle` (0.2.3, Apache-2.0) offers `enforce-delete-with-where` and `enforce-update-with-where` (Context7, drizzle-orm-docs `eslint-plugin.mdx`). Two third-party "Drizzle best practices" skills are indexed by Context7; not reviewed.
- **Verdict:** documentation through Context7, as the repo already does; add `eslint-plugin-drizzle` if Drizzle wins.

### 7. Kysely

- `llms.txt` (80 links) and `llms-full.txt` (310 KB) on kysely.dev; no agent skill. **Verdict:** Context7.

### 8. Postgres MCP Pro (crystaldba/postgres-mcp)

- **What:** a Python MCP server (MIT, 3,342 stars): `list_schemas`, `list_objects`, `get_object_details`, `execute_sql`, `explain_query` (optionally with HypoPG hypothetical indexes), `get_top_queries` from `pg_stat_statements`, `analyze_workload_indexes` and `analyze_query_indexes` (a greedy search over HypoPG costs modelled on Microsoft's Anytime algorithm), and `analyze_db_health` (checks adapted from PgHero). The design idea is good: deterministic tools rather than health queries an LLM improvises.
- **Risks:** "**Unrestricted Mode**: Allows full read/write access to modify data and schema." (PM2) is the default, and issue #164 asks to change it. Issue #178 (2026-06-06) reports a restricted-mode bypass: "SELECT * FROM pg_read_file('/etc/passwd') returns the file." (PM1); the fix (#200) was not merged at the last commit (2026-08-15); the last release is v0.3.0 of 2025-05-16. The experimental LLM index tuning calls OpenAI (PM3). No telemetry in the source (searched). The Docker image comes from Docker Hub.
- **Verdict:** reject for now. Use the idea, HypoPG plus `pg_stat_statements`, in our own scripts on the local container.

### 9. Anthropic's reference PostgreSQL MCP server (archived)

- Datadog Security Labs (Santiago Mola, 2025-08-21) showed that it wrapped each query in a read-only transaction but ran stacked statements, so `COMMIT; DROP SCHEMA public CASCADE;` escaped the read-only transaction. "May 29, 2025: Anthropic archives server-postgres and other MCP servers deemed not ready for production use." (DD3). "Users should avoid using the now deprecated Postgres MCP server when connecting to any database where write operations should be prevented." (DD1). Their mitigation: "using a Postgres user with restricted privileges. You should definitely do this." (DD2).
- **Verdict:** reject. The lesson (H-26): read-only is a database role, not a parser or a transaction wrapper.

### 10. DBHub (Bytebase)

- MIT, version 1.3.1, 3,568 stars. Two tools by default (`execute_sql`, `search_objects`) and an opt-in `explain_sql`; "**Guardrails**: Read-only mode, row limiting, and query timeout to prevent runaway operations" (DB1). Read-only bypasses for SQL Server (#349) and MySQL functions (#376 to #379) were fixed in 2026-06 and 2026-07. No telemetry found in `src`. It is the example in Claude Code's own MCP documentation, which advises: "Use a read-only database user in the connection string so the queries Claude runs can’t modify data" (CC1).
- **Verdict:** not needed now, since `psql` through Bash does the same on a local container. If a structured tool is wanted later, pin a version (the documented `npx -y @bytebase/dbhub` is unpinned) and connect with a read-only role.

### 11. pganalyze

- libpg_query (BSD-3-Clause: PostgreSQL's parser as a library; SafeQL depends on its npm port). pganalyze_lint (BSD-3-Clause, marked experimental, last push 2024-04-26): run your test suite, read `pg_stat_statements`, cost candidate indexes with HypoPG and pick a set with a constraint-programming model; its README warns against relying on it alone because local data is small. The Index Advisor is part of the paid service; pg_stat_plans is a new extension (2026). Lukas Fittl's own writing is in the taste match.
- **Verdict:** read only; its "read the workload after a test run" idea is H-11.

### 12. Xata: pgroll and Xata Agent

- pgroll (Apache-2.0, v0.16.3 of 2026-09-08) runs expand-and-contract migrations that serve the old and new schema at once; it has no agent material, and it is more machinery than a one-developer prototype needs (inference); the migration tool is pass B's decision. Xata Agent (Apache-2.0) was archived on 2026-04-20; its playbooks are short prompts for monitoring RDS and Aurora, and the slow-query playbook tells the model to invent parameter values for EXPLAIN.
- **Verdict:** pgroll to pass B; Xata Agent rejected.

### 13. Anthropic's official plugin directory

- anthropics/claude-plugins-official at commit `fa59bc9` (2026-09-25) lists 314 plugins. Ten are PostgreSQL-related (aiven, alloydb, alloydb-omni, cloud-sql-postgresql, cockroachdb, databases-on-aws, neon, planetscale, prisma, supabase), and each is tied to one vendor's product or hosted service. None is a vendor-neutral design or migration-review skill. Entries are pinned by SHA, but the marketplace itself follows its default branch (`.claude/skills/README.md`).
- **Verdict:** nothing to install.

### 14. Community agents: wshobson/agents and VoltAgent

- wshobson/agents (MIT, 40,003 stars, commit `9b15b34`): a `database-design` plugin with `database-architect` and `sql-pro` agents and a `postgresql-table-design` skill. 79 of the 123 long lines of pg-aiguide's `design-postgres-tables` (64%) appear verbatim in that skill, and I found no credit to Tiger Data in its files, which Apache-2.0 requires (the derivation is my inference from the overlap). The architect agent sells "**Hybrid architectures**: Polyglot persistence, multi-database strategies, data synchronization" (WS1).
- VoltAgent/awesome-claude-code-subagents (MIT, commit `82b7382`): `postgres-pro` is keyword lists with invented targets such as "Query performance < 50ms achieved" (VO1), and it grants write tools.
- **Verdict:** reject both.

### 15. Human review processes to copy in spirit

- GitLab's database review guidelines: reviewers need "Raw SQL for all changed or added queries (as translated from ActiveRecord queries)." and "Query plans for each raw SQL query included in the merge request…" (GL6, HT17), and "must review the output of both migrating (db:migrate) and rolling back (db:rollback) for all migrations." (GL6b). Licence CC BY-SA 4.0: paraphrase and link, do not copy.
- Nikolay Samokhvalov, "Common DB schema change mistakes" (2022, 18 cases) and the postgres-howtos collection (no licence).
- strong_migrations (Andrew Kane, MIT), "Catch unsafe migrations in development" (AK6): its list of dangerous operations reads as a review checklist; the code is Rails-only.
- Supabase splinter (no licence file): SQL checks for unindexed foreign keys, missing primary keys, unused and duplicate indexes, bloat and more. Ideas for our catalog lint, to be written ourselves.
- **Verdict:** the `database-reviewer` adopts GitLab's contract; the craft reference cites the rest.

### 16. Claude Code's own tools

- This environment offers `/security-review` and `/code-review`; neither is specific to databases (inference from their descriptions). They stay; the `database-reviewer` adds the database depth.

## Mechanical checks

### What the lab showed

All runs on 2026-09-27. Scripts and raw output were in the research session's lab (not kept): `claims.sql`/`claims.out`, `locks.sql`/`locks.out`, `hashurl*.sql`, `pgvector.sql`, `squawk/`, `eslint-sql/`, `pglite/`.

**Claims in agent material, checked on PostgreSQL 18.6 with pgvector 0.8.6:**

| # | Claim (source) | Result |
|---|---|---|
| L1 | `CREATE TABLE user (…)` and `CREATE TABLE order (…)` (PlanetScale `schema-design.md`) | Both fail: `syntax error at or near "user"` / `"order"` (reserved words) |
| L2 | `price numeric(10,2)` (Supabase `schema-data-types.md`) | `SELECT 1500000000::numeric(10,2)` fails: `numeric field overflow` |
| L3 | "partial indexes don't work" with ON CONFLICT (pg-aiguide) | Works when the conflict target repeats the predicate: `ON CONFLICT (source_id, external_id) WHERE removed_at IS NULL DO NOTHING` returned no row and left 1 row |
| L4 | "FKs from partitioned tables not supported" (pg-aiguide) | A foreign key from partitioned `snapshot` to `source` was created and rejected `source_id = 2` with `violates foreign key constraint "snapshot_source_id_fkey"` |
| L5 | `ALTER COLUMN … SET NOT NULL NOT VALID` and `VALIDATE NOT NULL ON` (pg-aiguide, PostgreSQL 18) | Both are syntax errors; `ADD CONSTRAINT t5_c_not_null NOT NULL c NOT VALID` then `VALIDATE CONSTRAINT t5_c_not_null` work |
| L6 | `ADD CONSTRAINT … NOT VALID` takes `ShareUpdateExclusiveLock` (pg-aiguide) | `ADD CHECK … NOT VALID` held `AccessExclusiveLock`; `ADD FOREIGN KEY … NOT VALID` held `ShareRowExclusiveLock` on both tables; `VALIDATE CONSTRAINT` held `ShareUpdateExclusiveLock` (plus `RowShareLock` on the referenced table for a foreign key) |
| L7 | UUIDv7 needs the pg_uuidv7 extension (Supabase) | `uuid_generate_v7()` does not exist; built-in `uuidv7()` works |
| L8 | pgvector skill constructs (pg-aiguide) | `halfvec(4)` column, HNSW `halfvec_cosine_ops` index on an empty table, `binary_quantize` generated column, `hnsw.iterative_scan = relaxed_order`, `hnsw.max_scan_tuples` all accepted; the plan for a filtered query showed `Filter: (model_id = 3)` under the HNSW index scan |
| L9 | Unique URL key options (for H-16) | `sha256(convert_to(url, 'UTF8'))` in a generated column fails: `generation expression is not immutable` (`convert_to` is STABLE); `md5(url)::uuid` works, as does `ON CONFLICT … DO UPDATE` on it; `EXCLUDE USING hash (url WITH =)` rejects duplicates but `ON CONFLICT DO UPDATE not supported with exclusion constraints` |
| L10 | A unique violation names the constraint | `ERROR: 23505 … CONSTRAINT NAME: snap_m_source_id_url_md5_key` (psql verbose); node-postgres exposes it as `err.constraint` (Context7, node-postgres integration test) |

**Squawk 2.66.0** (`npx squawk-cli@2.66.0 --pg-version 18`) on three Carshenas-style migrations:

| File | Default run | With `--assume-in-transaction` |
|---|---|---|
| `0001_create_sources_and_snapshots.sql` (`serial`, `int` keys, `varchar(255)`, `timestamp`, `char(64)`, an index on the new table) | 10 findings: `ban-char-field`, `prefer-bigint-over-int` ×3, `prefer-identity`, `prefer-text-field`, `prefer-timestamp-tz`, `require-concurrent-index-creation`, `require-lock-timeout`, `require-statement-timeout`; plus 3 `prefer-robust-stmts` | 9 findings; the index on a table created in the same transaction is no longer flagged, `prefer-robust-stmts` disappears |
| `0002_add_listing_columns_unsafely.sql` (required column, plain index, FK and CHECK without NOT VALID, UNIQUE constraint, type change, rename, plain DROP INDEX) | 12 findings: `adding-required-field`, `require-concurrent-index-creation`, `adding-foreign-key-constraint`, `constraint-missing-not-valid` ×3, `disallowed-unique-constraint`, `changing-column-type`, `renaming-column`, `require-concurrent-index-deletion`, `require-lock-timeout`, `require-statement-timeout`; plus 9 `prefer-robust-stmts` | 12 findings, same rules |
| `0003_add_listing_columns_safely.sql` (timeouts set, `NOT VALID` then `VALIDATE`, `CREATE INDEX CONCURRENTLY IF NOT EXISTS`) | only 5 `prefer-robust-stmts` | 3 findings, all correct: `constraint-missing-not-valid` ×2 ("Using `NOT VALID` and `VALIDATE CONSTRAINT` in the same transaction will block all reads while the constraint is validated."), `ban-concurrent-index-creation-in-transaction` |

What Squawk cannot see (by design, inference from its rule list): whether an invariant has a constraint at all, naming conventions, money types, foreign keys without supporting indexes, duplicate or invalid indexes. The catalog lint below covers those.

**ESLint on twelve samples** (JavaScript files shaped like our data-layer code; eslint 9, `eslint-plugin-sql` 3.4.1 versus four core `no-restricted-syntax` selectors):

| Sample | eslint-plugin-sql `no-unsafe-query` | Core selectors |
|---|---|---|
| A `` db.query(`SELECT * FROM listing WHERE make_id = ${makeId}`) `` | flagged | flagged |
| B untagged `` `INSERT … ON CONFLICT … DO NOTHING RETURNING id` `` with interpolation | **missed** | flagged |
| C untagged `` `SELECT … WHERE title ILIKE '%${q}%'` `` | **missed** | flagged |
| D untagged `` `SELECT id, price_toman::bigint … ANY(${…}::bigint[])` `` | flagged | flagged |
| E `'SELECT … external_id = \'' + externalId + '\''` | missed (not a template) | flagged |
| F `` db.$queryRawUnsafe(`…${makeId}`) `` | flagged | flagged |
| G `` sql.raw(`listing_${makeId}`) `` | not covered | flagged |
| I, J SQL template literals stored in variables | not run | flagged |
| H tagged `` sql`…${makeId}` `` | clean | clean |
| K prose `` `Selected ${id} listings` ``, L tagged `` sql`…${id}` `` | not run | clean |

The plugin recognises SQL by parsing it with a generic parser (`src/utilities/isSqlQuery.ts`), so PostgreSQL-only syntax is invisible to it. The core selectors were in the lab's `eslint-sql/eslint.config.js` (not kept) and are quoted under "Recommended wiring"; their limit is SQL fragments that do not start the literal (for example `` `WHERE id = ${id}` ``), which the driver-import restriction and review must catch (inference).

**pgTAP in PGlite** (the lab's `pglite/constraints.test.mjs`, not kept): PGlite 0.5.8 reported PostgreSQL 18.3, pgTAP 1.3.5 and pgvector 0.8.1; `plan(4)` with `throws_ok` for SQLSTATEs 23505 (duplicate listing per source), 23514 (non-positive price) and 23503 (unknown source) plus `col_type_is('listing', 'price_toman', 'bigint')` printed `ok 1` to `ok 4` in 2,591 ms including start-up. "PGlite is single user/connection." (PL1), so races, locks and `SKIP LOCKED` need a real server.

### Candidates

| Tool | Licence, version | Fits a Next.js pnpm monorepo? | What it catches | Costs and risks | Verdict |
|---|---|---|---|---|---|
| **Squawk** | Apache-2.0 or MIT; 2.66.0 (2026-09-23) | Yes: `squawk-cli` with per-platform binaries as optional npm dependencies, no download at install | Lock-heavy and breaking DDL, missing timeouts, `NOT VALID`/`CONCURRENTLY` misuse, type rules (table above) | Needs SQL files; `prefer-robust-stmts` conflicts with H-4; initial migration needs `-- squawk-ignore-file` for timeout rules or a baseline | **Adopt** |
| Atlas `migrate lint` | Apache-2.0 community build; standard build under Atlas's MSA | Go binary | Destructive and data-dependent changes (community); the PostgreSQL lock analyzers PG1xx/PG3xx, constraint deletion and transaction checks are marked Atlas Pro on the analyzers page | "Running atlas login unlocks Atlas Pro features such as migration linting, testing, and CI/CD integration." (AT1), then "a license is required" after 30 days (AT2); US cloud account | Reject |
| Eugene | MIT; 0.8.3 (2026-03-11) | Rust binary or Docker image | Static lint plus `trace`, which runs migrations against a real database and reports the locks actually taken | Small single-maintainer project | Read; revisit if migrations grow complex |
| strong_migrations | MIT | Ruby only | Rails migrations | n/a | Read its check list |
| **pgTAP** | PostgreSQL-style permissive licence (README) | In PGlite via `@electric-sql/pglite-pgtap` 0.0.9 (Apache-2.0); in Docker via the PGDG package `postgresql-18-pgtap` | Constraints, types, names, privileges, functions | pg_prove is Perl; call `runtests()` or `plan()`/`finish()` from Vitest instead | **Adopt** |
| **PGlite** | Apache-2.0; 0.5.8 | Yes: npm, no Docker, pgvector and pgTAP packages | Real PostgreSQL parser, planner and constraints in unit tests | Single connection; extension versions lag (pgvector 0.8.1 vs 0.8.6) | **Adopt** for fast schema tests |
| Real PostgreSQL in CI | — | GitHub Actions service container `pgvector/pgvector:pg18`, or Compose | Concurrency, locks, `EXPLAIN`, migrate-rollback-migrate | Docker Hub blocks Iranian IP addresses (DH1): fine on GitHub's runners, a mirror for machines in Iran | **Adopt** in CI |
| Testcontainers | MIT; 12.1.0 | Yes | Same as above, per test file | Pulls images and `testcontainers/ryuk:0.14.0` (TC1) from Docker Hub unless `TESTCONTAINERS_HUB_IMAGE_NAME_PREFIX` points at a mirror (TC2) | Optional |
| Schema diff: `pg_dump --schema-only` + git diff | PostgreSQL | Yes | Drift between migrations and the committed schema snapshot | none | **Adopt** |
| pgschema, stripe/pg-schema-diff, migra | Apache-2.0, MIT, Unlicense (migra is marked deprecated) | Go/Python binaries | Declarative diffs and plans | Another tool and model; pass B's call | Read |
| **ESLint core selectors** | MIT (ESLint) | Yes, flat config already in `apps/web/eslint.config.mjs` | SQL concatenation, interpolated SQL templates, unsafe raw APIs (measured) | Fragments not starting with a keyword | **Adopt** with self-test samples |
| eslint-plugin-sql | BSD-3-Clause; 3.4.1 | Yes | Untagged SQL templates it can parse | Missed ON CONFLICT and ILIKE (measured) | Skip |
| eslint-plugin-drizzle | Apache-2.0; 0.2.3 | Yes | `delete`/`update` without `.where()` | Drizzle only | If Drizzle |
| SafeQL `@ts-safeql/eslint-plugin` | MIT; 5.4.1 | Yes, with typed linting | Validates raw SQL against the real schema and infers result types; "you need to specify either a" `databaseUrl` or a `migrationsDir` (SQ1) | A running database during `pnpm lint` | If pass B picks raw SQL |
| Catalog lint (our own SQL, run as pgTAP/Vitest) | ours | Yes | See "Recommended wiring" | Maintenance | **Adopt** |
| plpgsql_check | MIT | Extension | PL/pgSQL bugs | Only if we write functions | Later |
| sqlfluff | MIT | Python | Formatting and style | Python toolchain for style only | Reject |
| HypoPG, Dexter, pganalyze_lint | PostgreSQL licence, MIT, BSD-3-Clause | Extension or CLI on the dev database | "What if" index costs from the measured workload | Custom image with `postgresql-18-hypopg` | Optional, in `db:` scripts |

### Recommended wiring (inference; to be confirmed when CS-4 is implemented)

1. **`.squawk.toml`** at the repo root, and `squawk` over migration files changed against `origin/main` in `pnpm check` (all files in CI):

   ```toml
   pg_version = "18.0"
   assume_in_transaction = true          # the runner wraps each file in a transaction
   excluded_rules = ["prefer-robust-stmts"]  # asks for IF NOT EXISTS; see H-4
   ```

   Non-transactional files (CONCURRENTLY) start with `-- squawk-disable-assume-in-transaction`.

2. **ESLint** in the data-layer and worker packages (samples under `apps/web/eslint/samples/` with `// expect: no-restricted-syntax` so `lint:selftest` proves each selector fires):

   ```js
   'no-restricted-syntax': ['error',
     { selector: "BinaryExpression[operator='+'] > Literal[value=/^\\s*(select|insert|update|delete|with)\\b/i]",
       message: 'SQL built by string concatenation: use parameters.' },
     { selector: ":not(TaggedTemplateExpression) > TemplateLiteral[expressions.length>0]:has(TemplateElement[value.raw=/^\\s*(select|insert\\s+into|update|delete\\s+from|with)\\s/i])",
       message: 'Values interpolated into SQL text: use the sql tag or parameters.' },
     { selector: "CallExpression[callee.property.name=/^\\$(queryRawUnsafe|executeRawUnsafe)$/]", message: 'Unsafe raw query.' },
     { selector: "CallExpression[callee.object.name='sql'][callee.property.name=/^(raw|unsafe)$/]", message: 'sql.raw/sql.unsafe bypasses parameters.' },
   ],
   ```

   plus `no-restricted-imports` for the driver (`pg`, `postgres`, the ORM client) everywhere except the data-layer package and the worker, in line with ADR-0004's boundaries.

3. **Schema tests** (Vitest; PGlite locally, the real server in CI): apply all migrations to an empty database, then pgTAP assertions for each invariant (`throws_ok` with the SQLSTATE and constraint), plus catalog lint queries that fail on: tables without a primary key; columns of type `timestamp without time zone`, `varchar(n)`, `char(n)`, `money`, `real`/`double precision` for money-named columns; `integer` keys or foreign keys; `serial` defaults; constraints whose names break the convention; constraints with no entry in the Persian message map (H-6); `NOT VALID` constraints left unvalidated; INVALID indexes; duplicate indexes. Foreign keys without a supporting index are **reported, not failed** (H-7).

4. **CI job** (GitHub Actions, outside Iran): service container `pgvector/pgvector:pg18` started with `-c shared_preload_libraries=pg_stat_statements`; migrate up, roll back the newest migration, migrate again; `pg_dump --schema-only` diffed against the committed snapshot; the schema tests; concurrency tests (two sessions inserting the same listing, a job claimed twice with `SKIP LOCKED`); Squawk on all files.

5. **Claude Code hook** (`PreToolUse` on Bash): ask before commands matching `DROP (DATABASE|SCHEMA)`, `TRUNCATE`, `docker compose down -v`, `migrate reset`, `db push --force-reset|--accept-data-loss`.

## Taste-match table and evidence

**Scoring,** as in CS-26: a source gets 1 point for each owner concern it clearly and independently states in its own published work. **✓** counts. **~** means related but not the same idea, or a table of contents without the text, and does not count. **✗** means the source recommends the opposite. **·** means not found in what I fetched. Concerns 1 and 6 bundle several habits; a ✓ needs the core idea (invariants belong in constraints; at least one of reading the SQL, naming constraints or reviewing migrations stated as practice), and the evidence line says which part is covered. Cells cite evidence IDs from the next section.

**Column key.** 1 invariants in database constraints, application checks only for good messages · 2 insert and handle the database's rejection rather than check first · 3 index only when a measured query needs it, and know how to tell · 4 measure with plans and statistics, not guesses · 5 configure vectors in PostgreSQL deliberately · 6 senior habits (read the SQL, name constraints, review migrations) · 7 solid modelling fundamentals · 8 PostgreSQL for everything until a measured need proves otherwise, no polyglot persistence · 9 model for future growth (crawled listings now, native listings later).

| Source (role; why credible) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Score |
|---|---|---|---|---|---|---|---|---|---|---|
| **GitLab database development guidelines** (the rules GitLab's database reviewers apply to changes to GitLab's own PostgreSQL schema) | ✓GL1 | ✓GL2 | ✓GL3 | ✓GL4 | · | ✓GL6 | ✓GL7 | · | ~GL9 | **6** |
| **Laurenz Albe** (CYBERTEC; listed among PostgreSQL contributors on postgresql.org) | ✓LA1 | ~LA2 | ✓LA3 | ✓LA4 | · | · | ✓LA7 | · | ✓LA9 | **5** |
| **PostgreSQL documentation** (version 18, current) | ✓PG1 | ✓PG2 | ✓PG3 | ✓PG4 | · | ✓PG6 | · | · | · | **5** |
| **Andrew Atkinson** (author of "High Performance PostgreSQL for Rails", 2024) | ✓AA1 | · | ✓AA3 | ✓AA4 | · | · | ✓AA7 | ✓AA8 | ✗AA9 | **5** |
| **Andrew Kane** (author of pgvector, PgHero, Dexter, strong_migrations) | · | · | ✓AK3 | ✓AK4 | ✓AK5 | ✓AK6 | · | ✓AK8 | · | **5** |
| **Haki Benita** (self-described application DBA; long-form PostgreSQL articles with measurements) | ✓HB1 | ✓HB2 | ✓HB3 | ✓HB4 | · | ~HB6 | · | · | · | **4** |
| **Brandur Leach** (ex-Heroku and Stripe; co-author of the River PostgreSQL job queue) | ✓BL1 | ✓BL2 | · | · | · | ~BL6 | ✓BL7 | ✓BL8 | ~BL9 | **4** |
| **Nikolay Samokhvalov** (Postgres.ai founder; listed among PostgreSQL contributors; Postgres.fm co-host; "1000+ migrations designed/reviewed/executed") | · | · | · | ✓NS4 | · | ✓NS6 | ✓NS7 | · | ✓NS9 | **4** |
| **Supabase documentation and engineering blog** (a PostgreSQL platform's own guides; not its agent skill) | · | · | ✓SD3 | ✓SD4 | ✓SD5 | · | · | ✓SD8 | · | **4** |
| **Craig Kerstiens** (ex-Heroku Postgres, Citus, Crunchy Data; Postgres Weekly) | · | · | ✓CK3 | ✓CK4 | · | · | · | ✓CK8 | · | **3** |
| **Markus Winand** ("SQL Performance Explained", use-the-index-luke.com) | · | · | ✓MW3 | ✓MW4 | · | ~MW6 | · | · | · | **2** |
| **Lukas Fittl** (pganalyze founder; listed among PostgreSQL contributors; "5mins of Postgres") | · | · | ✓LF3 | ✓LF4 | · | · | · | ~LF8 | · | **2** |
| **Michael Christofides** (pgMustard; Postgres.fm co-host) | · | · | ✓MC3 | ✓MC4 | · | · | · | · | · | **2** |
| **Crunchy Data** (Christopher Winslett's pgvector posts; the "Why Postgres" page) | · | · | · | ✓CD4 | ✓CD5 | · | · | ~CD8 | · | **2** |
| **Andy Pavlo** (CMU database group; with Michael Stonebraker, SIGMOD Record 2024) | · | · | · | · | · | · | · | ✓AP8 | ✓AP9 | **2** |
| **Stephan Schmidt** ("Just Use Postgres for Everything") | · | · | · | · | · | · | · | ✓SS8 | · | **1** |
| **Dan McKinley** ("Choose Boring Technology") | · | · | · | · | · | · | · | ✓DM8 | · | **1** |
| **Bill Karwin** ("SQL Antipatterns", vol. 1, 2022; free excerpt and contents only) | ~BK1 | · | ~BK3 | · | · | · | ✓BK7 | · | · | **1** |
| **Martin Kleppmann** (free blog posts only; "Designing Data-Intensive Applications" not fetched) | · | · | · | · | · | · | · | ✗MK8 | · | **0** |
| **Sources stating it** | 6 | 4 | 11 | 13 | 3 | 4 | 6 | 8 | 3 | |
| *Agent material, for comparison* | | | | | | | | | | |
| pg-aiguide skills (Tiger Data) | ✓TG1 | ~TG2 | ~TG3 | ✓TG4 | ✓TG5 | ✓TG6 | ✓TG7 | ~TG8 | ~TG9 | 5 |
| PlanetScale `postgres` skill | ✓PS1 | ~PS2 | ✗PS3 | ✓PS4 | · | ✓PS6 | ✓PS7 | · | ✓PS9 | 5 |
| Supabase `supabase-postgres-best-practices` skill | ~SK1 | ✓SK2 | ✗SK3 | ✓SK4 | · | ✗SK6 | ✓SK7 | · | ✓SK9 | 4 |

What the table shows:

- **Strongest matches:** GitLab (6), then Laurenz Albe, the PostgreSQL documentation, Andrew Atkinson and Andrew Kane (5), then Haki Benita, Brandur Leach, Nikolay Samokhvalov and Supabase's own documentation (4). The harvested tips come from these nine.
- **The owner's view on measurement is mainstream.** Concern 4 is stated by 13 sources and concern 3 by 11. The opposite advice (index every WHERE and JOIN column, always index foreign keys) appears in two agent skills (Supabase, PlanetScale) and not in any practitioner's own writing. GitLab names it as the traditional answer it moved away from (GL3).
- **Concern 5 has the thinnest support:** only pgvector's own README, Supabase's documentation and Crunchy Data's posts treat vector indexes as a configured trade-off. The vendored pg-aiguide file and our own recall measurements will carry this concern.
- **Concern 2 is stated most precisely by Haki Benita,** who adds the caveat that makes it usable: catching unique violations is right when duplicates are rare, `ON CONFLICT` when they are common (H-1).
- **Concern 1's second half (application checks only for good messages) is stated by nobody directly.** The PostgreSQL manual comes closest: constraint names can "communicate helpful constraint information to client applications" (PG6), which H-6 turns into the mechanism.
- **Disagreements that need the owner:**
  - Foreign-key indexes: GitLab "you must always add an index first" (GL1b) and both skills say always; Laurenz Albe says a small referencing table needs none, and none is needed when you never join that way or delete from the parent (LA3). Recommendation in H-7.
  - Designing for growth: Andrew Atkinson says to "prefer rigidity initially, design for today, then leverage the flexibility available to evolve later, as opposed to designing for a hypothetical future state." (AA9) and even "For small databases, use integer primary keys." (AA9b); Laurenz Albe (LA9), Nikolay Samokhvalov (NS9) and Andy Pavlo (AP9) pay for growth where it is cheap now and expensive later. Carshenas's native listings are a stated plan, not a hypothetical, so the two views meet at a rule of thumb: decide now what is cheap now and painful to change later, and build the rest when it is needed (inference; H-25).
  - One database for vectors: Christopher Winslett (Crunchy) says "continue to host your vector data on a physically separate database." because of index build load (CD8); pgvector (AK8), Supabase (SD8) and Stephan Schmidt (SS8) keep vectors with the rest. Measure HNSW build time and its effect on crawler writes before splitting.
  - Polyglot persistence: Martin Kleppmann: "There is no one database or tool that can do everything that our application requires" (MK8), against eight sources. Even he argues that keeping several stores in sync by dual writes is a bad idea: "But I'd like to argue that it's a really bad idea, because it has some fundamental problems. The first problem is race conditions." (MK8b); if a search engine is ever added, it is fed from PostgreSQL's log or an outbox, never by writing to both (inference, consistent with ADR-0007's "derived index").
  - `IF NOT EXISTS` in migrations: Nikolay Samokhvalov (NS6b) against Squawk's `prefer-robust-stmts` (SW2) and Supabase's skill (SK6). H-4.
  - Composite index column order: Markus Winand calls "most selective column first" a myth (MWx); pg-aiguide and its wshobson copy teach it (TG3c).
- **Agent skills score like practitioners because checklists touch many topics.** Their ✗ on concern 3 and, for Supabase, on migration idempotence are exactly where the owner's taste differs from generic advice, which is why they are read, not vendored.

## Evidence

Format: ID (concern) — author — title — URL — date — "quote". Living documentation pages have no page date and were read on 2026-09-27.

**GitLab database development guidelines** (living; CC BY-SA 4.0)
- GL1 (1) — "Foreign keys and associations" — https://docs.gitlab.com/development/database/foreign_keys/ — "When creating tables that reference records from other tables, an FK should be added to maintain data integrity."
- GL1b (conflict, 3) — same page — "when adding a foreign key, you must always add an index first"
- GL2 (2) — "SQL query guidelines" — https://docs.gitlab.com/development/sql/ — "With concurrent processes in mind, there is a race condition which may lead to trying to insert two similar records." (about `.find_or_create_by`, which "is not atomic"; the page offers `upsert`, GitLab's `safe_find_or_create_by`, which retries after the unique-violation error, and Rails' `create_or_find_by`, which inserts first and reads only if that fails)
- GL3 (3) — "Adding database indexes" — https://docs.gitlab.com/development/database/adding_database_indexes/ — "Traditionally the answer to this question has been to add an index for every column used for filtering or joining data." (followed by "it can actually have a negative impact"); and "The table is small (less than 1,000 records) and it's not expected to exponentially grow in size." (a case where "an index might not be required")
- GL4 (4) — same page — "Always examine the query plans for new or updated queries."
- GL6 (6, read the SQL; review migrations) — "Database review guidelines" — https://docs.gitlab.com/development/database_review/ — "Raw SQL for all changed or added queries (as translated from ActiveRecord queries)."; GL6b — "database reviewers must review the output of both migrating (db:migrate) and rolling back (db:rollback) for all migrations."; naming: "Constraint naming convention" — https://docs.gitlab.com/development/database/constraint_naming_convention/ — "The intent is not to retroactively change names in existing databases but rather ensure consistency of future changes." (HT16)
- GL6c (6) — "Foreign keys and associations" — "adding the column, adding an FK constraint and validating the constraint should be done in separate transactions."
- GL7 (7) — "Strings and the Text data type" — https://docs.gitlab.com/development/database/strings_and_the_text_data_type/ — "text columns should always have a limit set"; GL7b — foreign keys page — "When adding a new foreign key, you should define it as bigint."
- GL9 (~9) — "Adding database indexes" — "Consider adding an index if a table is expected to grow, and your query has to filter a lot of rows." (growth as an input to indexing, not to modelling)

**Laurenz Albe** (CYBERTEC blog; dates from each page's published metadata)
- LA1 (1) — "Triggers to enforce constraints in PostgreSQL" — https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/ — 2019-04-25 — "When checking constraints, PostgreSQL also checks rows that would normally not be visible to the current transaction." and "guarantees that constraints are not vulnerable to this race condition." (LA1b)
- LA2 (~2) — same — "Sometimes you want to enforce a condition on a table that cannot be implemented by a constraint." (then shows that trigger- and application-level checks race; about constraints, not about inserting first)
- LA3 (3) — "Foreign Key Indexing and Performance in PostgreSQL" — https://www.cybertec-postgresql.com/en/index-your-foreign-key/ — 2018-10-10 — "If the source table is small, you don't need the index, because then a sequential scan is probably cheaper than an index scan anyway."; LA3b — "Get rid of your unused indexes!" — https://www.cybertec-postgresql.com/en/get-rid-of-your-unused-indexes/ — 2018-04-12 — "Everybody knows that a database index is a good thing because it can speed up SQL queries. But this does not come for free."
- LA4 (4) — "How to interpret PostgreSQL EXPLAIN ANALYZE output" — https://www.cybertec-postgresql.com/en/how-to-interpret-postgresql-explain-analyze-output/ — 2021-05-27 — "it shows how many 8kB-blocks each step reads, writes and dirties. You always want this." (about BUFFERS); LA4b — "Find the lowest node where the estimated row count is significantly different from the actual row count."
- LA7 (7) — "UUID, serial or identity columns for PostgreSQL auto-generated primary keys?" — https://www.cybertec-postgresql.com/en/uuid-serial-or-identity-columns-for-postgresql-auto-generated-primary-keys/ — 2021-05-20 (updated 2022-05-14) — "You should always use bigint."
- LA9 (9) — same — "it is quite complicated to change the primary key column from integer to bigint in a big table inside an active database"

**PostgreSQL 18 documentation** (living; current version 18, 19 in beta on 2026-09-24)
- PG1 (1) — "5.5. Constraints" — https://www.postgresql.org/docs/current/ddl-constraints.html — "Constraints give you as much control over the data in your tables as you wish."; PG1b (6) — "This clarifies error messages and allows you to refer to the constraint when you need to change it." (about naming a constraint)
- PG2 (2) — "INSERT" — https://www.postgresql.org/docs/current/sql-insert.html — "The optional ON CONFLICT clause specifies an alternative action to raising a unique violation or exclusion constraint violation error."; PG2b — "13.4. Data Consistency Checks at the Application Level" — https://www.postgresql.org/docs/current/applevel-consistency.html — "It is very difficult to enforce business rules regarding data integrity using Read Committed transactions"
- PG3 (3) — "11.1. Introduction" (indexes) — https://www.postgresql.org/docs/current/indexes-intro.html — "Therefore indexes that are seldom or never used in queries should be removed."; PG3b — "11.12. Examining Index Usage" — https://www.postgresql.org/docs/current/indexes-examine.html — "Using test data for setting up indexes will tell you what indexes you need for the test data, but that is all."
- PG4 (4) — "11.12. Examining Index Usage" — "Always run ANALYZE first." and "So you should time your query with and without indexes." (PG4b)
- PG6 (6; also the second half of 1) — "CREATE TABLE" — https://www.postgresql.org/docs/current/sql-createtable.html — "constraint names like col must be positive can be used to communicate helpful constraint information to client applications."

**Andrew Atkinson** (andyatkinson.com)
- AA1 (1) — "CORE Database Schema Design: Constraint-driven, Optimized, Responsive, and Efficient" — https://andyatkinson.com/constraint-driven-optimized-responsive-efficient-core-db-design — 2025-06-09 — "Use NOT NULL for columns by default. Create foreign key constraints for table relationships by default."
- AA3 (3) — "PostgreSQL Tips, Tricks, and Tuning" — https://andyatkinson.com/postgresql-tips — living — "saw immediate value in identifying unused and duplicate indexes we could remove."
- AA4 (4) — "Puny to Powerful PostgreSQL Rails Apps" (RailsConf 2022 resources) — https://andyatkinson.com/pg-puny-powerful — 2022-05-18 — "Work on high impact queries via statistics with pg_stat_statements"
- AA7 (7) — "CORE Database Schema Design" — 2025-06-09 — "Relational data is initially stored in a normalized form to eliminate duplication, but later denormalizations can be performed when read access is more important."
- AA8 (8) — "Hacking Postgres Podcast, Season 2, Ep. 1" — https://andyatkinson.com/blog/2024/04/15/hacking-postgres-podcast-andrew-atkinson — 2024-04-15 — "operating a Redis instance or cluster does carry more operational cost for the team, as it's another piece of infrastructure" (followed by "What if we used Postgres for those things instead?")
- AA9 (✗9) — "CORE Database Schema Design" — "prefer rigidity initially, design for today, then leverage the flexibility available to evolve later, as opposed to designing for a hypothetical future state."; AA9b — "For small databases, use integer primary keys."

**Andrew Kane** (READMEs, living; repositories pushed 2026-08-15 to 2026-09-26)
- AK3 (3) — Dexter README — https://github.com/ankane/dexter — "Dexter needs a connection to your database and a source of queries (like pg_stat_statements) to process." (indexes proposed from the measured workload, costed with HypoPG)
- AK4 (4) — pgvector README — https://github.com/pgvector/pgvector — "Use existing tools like pg_stat_statements or PgHero to monitor performance."
- AK5 (5) — pgvector README — "By default, pgvector performs exact nearest neighbor search, which provides perfect recall."; AK5b — "Unlike typical indexes, you will see different results for queries after adding an approximate index."; AK5c — "Monitor recall by comparing results from approximate search with exact search."
- AK6 (6, review migrations) — strong_migrations README — https://github.com/ankane/strong_migrations — "Catch unsafe migrations in development"
- AK8 (8) — pgvector README — "Store your vectors with the rest of your data."

**Haki Benita** (hakibenita.com)
- HB1 (1) — "Unconventional PostgreSQL Optimizations" — https://hakibenita.com/postgresql-unconventional-optimizations — 2026-01-20 — "there's a check constraint on the field - no row can ever have the value "Pro", the database makes sure of that!"
- HB2 (2) — "How to Get or Create in PostgreSQL" — https://hakibenita.com/postgresql-get-or-create — 2024-08-05 — "In processes where duplicates rarely happen, it's perfectly fine to rely on catching unique constraint violations to implement "get or create" functionality."; HB2b (the race when checking first) — "in the fraction of a millisecond between the time we checked that the tag does not exist and the time we actually inserted it"
- HB3 (3) — "Some SQL Tricks of an Application DBA" — https://hakibenita.com/sql-tricks-application-dba — 2020-07-27 — "if the database is not going to use the index to filter active users, why should we index them in the first place?"
- HB4 (4) — same — "This comes in handy when you want to see what an execution plan looks like without some index."
- HB6 (~6) — same — "I'm a DBA that knows how to develop applications, and not a developer that knows his way around the database." (an identity, not a stated habit)

**Brandur Leach** (brandur.org)
- BL1 (1) — "Building Robust Systems with ACID and Constraints" — https://brandur.org/acid — 2017-05-16 — "You can get away without constraints and schemas, but only by internalizing a nihilistic understanding that your production data isn't cohesive."
- BL2 (2) — same — "You could put a uniqueness check on the table itself (or on an index) which would prevent a duplicate record from being inserted." (after showing that an application check fails under concurrent sign-ups)
- BL6 (~6) — "How We Went All In on sqlc/pgx for Postgres + Go" — https://brandur.org/sqlc — 2021-09-08 — "This is fine for simple queries, but provides little in the way of confidence that queries actually work." (about SQL as bare strings; he prefers SQL files checked by a generator)
- BL7 (7) — "Soft Deletion Probably Isn't Worth It" — https://brandur.org/soft-deletion — 2022-07-19 — "Another consequence of soft deletion is that foreign keys are effectively lost."
- BL8 (8) — "Building Robust Systems with ACID and Constraints" — "In almost every case the right answer is probably to just use Postgres."; BL8b — "River: a Fast, Robust Job Queue for Go + Postgres" — https://brandur.org/river — 2023-11-20 — "No ElastiCache, no Redis, no bespoke queueing components, just Postgres."
- BL9 (~9) — "Building Robust Systems with ACID and Constraints" — "the next ten years will be about keeping it running correctly by minimizing bugs and data consistency problems" (long-term correctness rather than growth in scope)

**Nikolay Samokhvalov** (postgres.ai)
- NS4 (4) — "EXPLAIN (ANALYZE) needs BUFFERS to improve the Postgres query optimization process" — https://postgres.ai/blog/20220106-explain-analyze-needs-buffers-to-improve-the-postgres-query-optimization-process — 2022-01-06 — "When optimizing a query, temporarily forget about TIMING. Use BUFFERS."; NS4b — "Timing is volatile. Data volumes are stable."
- NS6 (6, review migrations) — "Common DB schema change mistakes" — https://postgres.ai/blog/20220525-common-db-schema-change-mistakes (quoted from https://web.archive.org/web/20220527134728/https://postgres.ai/blog/20220525-common-db-schema-change-mistakes, because the live page now carries a different list) — 2022-05-25 — "you should have retry logic with low lock_timeout"; NS6b (about `IF NOT EXISTS`) — "If this code is used not for benchmarking or testing scripts but to define some application schema, this approach is usually a bad idea."; NS6c — "If you start testing the chain DO-UNDO-DO (apply the change, revert it, and re-apply again), it can help"; naming — "it is usually better to take control over names, making cleanup implementation straightforward." (HT18)
- NS7 (7) — same — "In most cases, it doesn't make sense to use int4 PKs when defining a new table"
- NS9 (9) — same — "using int8 always, even if you don't expect your table to grow right now – things may change if the project is successful."

**Supabase documentation and blog** (docs living)
- SD3 (3) — "Query Optimization" — https://supabase.com/docs/guides/database/query-optimization — "If creating an index does not reduce the cost of the query plan, remove it."
- SD4 (4) — same — "Use the explain command to understand the query's execution."
- SD5 (5) — "Going to production" (AI) — https://supabase.com/docs/guides/ai/going-to-prod — "Prefer inner-product to L2 or Cosine distances if your vectors are normalized"; SD5b — "You don't have to create indexes in these cases and can use sequential scans instead." (small collections)
- SD8 (8) — Egor Romanov — "pgvector vs Pinecone: cost and performance" — https://supabase.com/blog/pgvector-vs-pinecone — 2023-10-10 — "a combination of Postgres and pgvector serves as a better alternative to single-purpose databases like Pinecone for AI tasks."

**Craig Kerstiens**
- CK3 (3) — "Understanding Postgres Performance" — https://www.craigkerstiens.com/2012/10/01/understanding-postgres-performance/ — 2012-10-01 — "if you're not somewhere around 99% on any table over 10,000 rows you may want to consider adding an index." (percentage of scans that used an index, from `pg_stat_user_tables`)
- CK4 (4) — "More on Postgres Performance" — https://www.craigkerstiens.com/2013/01/10/more-on-postgres-performance/ — 2013-01-10 — "This simple query will show a few very key pieces of information that allow you to begin optimizing" (a `pg_stat_statements` query)
- CK8 (8) — interview by LambdaClass, "The big old reliable elephant: talking about Postgres with Craig Kerstiens" — https://blog.lambdaclass.com/the-big-old-reliable-elephant-talking-about-postgres-with-craig-kerstiens/ — 2017-04-26 — "The only one that really comes to mind is graph databases." (answering "In which cases wouldn't you use PostgreSQL?"); CK8b — "it's not using it for the idea you might one day migrate."

**Markus Winand** (use-the-index-luke.com; undated pages, copyright 2010–2026)
- MW3 (3) — "Preface: Developers Need to Index" — https://use-the-index-luke.com/sql/preface — "The most important information for indexing is how the application queries the data."
- MW4 (4) — "Getting an Execution Plan" (PostgreSQL) — https://use-the-index-luke.com/sql/explain-plan/postgresql/getting-an-execution-plan — "A PostgreSQL execution plan is fetched by putting the explain command in front of an SQL statement."
- MW6 (~6) — Preface — "Database indexing is, in fact, a development task."
- MWx (conflict with pg-aiguide) — "Myth: Put the most selective column leftmost" — https://use-the-index-luke.com/sql/myth-directory/most-selective-first — "there is the myth that you should always put the most selective column to the first position; that is just wrong."

**Lukas Fittl**
- LF3 (3) — "SE Radio 583: Lukas Fittl on Postgres Performance" — https://se-radio.net/2023/09/se-radio-583-lukas-fittl-on-postgres-performance/ — 2023-09-27 — "they're not really looking at the whole query workload." (why engineers pick the wrong indexes; the motivation for workload-based index advice)
- LF4 (4) — same — "buffers are a special option that you can pass when you're doing explain analyze."
- LF8 (~8) — same — "I think there's a trend towards making everything a distributed database. And I think that is actually not a good choice sometimes."

**Michael Christofides**
- MC3 (3) — "Why isn't Postgres using my index?" — https://www.pgmustard.com/blog/why-isnt-postgres-using-my-index — 2021-09-28 — "If a table is small (very roughly 100 rows or fewer), Postgres may estimate that it will be faster to read the table sequentially"
- MC4 (4) — same — "Bad estimates can sometimes be quickly resolved by manually running ANALYZE on the tables involved."; MC4b — "Postgres assumes that two columns are independent by default."

**Crunchy Data**
- CD4 (4) — Christopher Winslett — "Performance Tips Using Postgres and pgvector" — https://www.crunchydata.com/blog/pgvector-performance-for-developers — 2023-05-05 — "To understand query execution with vector data, get familiar with EXPLAIN."
- CD5 (5) — Christopher Winslett — "HNSW Indexes with Postgres and pgvector" — https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector — 2023-09-01 — "A smaller ef_search value will result in faster queries at the risk of inaccuracy."
- CD8 (~8, conflict) — same — "continue to host your vector data on a physically separate database."; CD8b — "Why Postgres" — https://www.crunchydata.com/why-postgres — undated — "a large set of built-in functions you can use to simplify your data stack"

**Andy Pavlo** (with Michael Stonebraker) — "What Goes Around Comes Around... And Around..." — SIGMOD Record 53(2) — https://db.cs.cmu.edu/papers/2024/whatgoesaround-sigmodrec2024.pdf — June 2024
- AP8 (8) — "Such indexes are a feature, not the foundation of a new system architecture." (about vector indexes); AP8b — "Their search features have improved recently and are generally on par with the special-purpose systems above." (full-text search in relational systems)
- AP9 (9) — "a RDBMS may be a better choice, even for simple applications, because they offer a path forward if the application's complexity increases."

**Stephan Schmidt** — "Just Use Postgres for Everything" — https://www.amazingcto.com/postgres-for-everything/ — updated 2025-12-13
- SS8 (8) — "Use Postgres with pgvector for embeddings and AI similarity search instead of specialized vector databases."; SS8b — "Reduce the moving parts, speed up development, lower the risk and deliver more features in your startup is “Use Postgres for everything”."

**Dan McKinley** — "Choose Boring Technology" — https://mcfunley.com/choose-boring-technology — 2015-03-30
- DM8 (8) — "The problem with “best tool for the job” thinking is that it takes a myopic view of the words “best” and “job.”"

**Bill Karwin** — "SQL Antipatterns, Volume 1" (Pragmatic Bookshelf, 2022)
- BK7 (7) — free excerpt "31 Flavors" — https://media.pragprog.com/titles/bksap1/31flavors.pdf — undated excerpt — "The problems with using ENUM or a check constraint arise when the set of values is not fixed."
- BK1 (~1), BK3 (~3) — table of contents — https://pragprog.com/titles/bksap1/sql-antipatterns-volume-1/ — "Antipattern: Leave Out the Constraints"; "Antipattern: Using Indexes Without a Plan" (chapter text is paid and was not read, so not counted)

**Martin Kleppmann** — "Using logs to build a solid data infrastructure (or: why dual writes are a bad idea)" — https://martin.kleppmann.com/2015/05/27/logs-for-data-infrastructure.html — 2015-05-27
- MK8 (✗8) — "There is no one database or tool that can do everything that our application requires – we use the best tool for the job"; MK8b (about dual writes) — "But I'd like to argue that it's a really bad idea, because it has some fundamental problems. The first problem is race conditions."

**Agent material** (files at the commits listed in Sources)
- pg-aiguide: TG1 (1) "Add **NOT NULL** everywhere it’s semantically required"; TG2 (~2, and wrong per L3) "**Requires UNIQUE index** on conflict target columns—`ON CONFLICT (col1, col2)` needs exact matching unique index (partial indexes don't work)."; TG3 (~3) "Create **indexes for access paths you actually query**: PK/unique (auto), **FK columns (manual!)**, frequent filters/sorts, and join keys." with README TG3b "**55% more indexes** (including partial/expression indexes)" and TG3c "Put most selective/frequently filtered columns first."; TG4 (4) "Always validate filtered queries by measuring p95/p99 latency and tuples visited under realistic load."; TG5 (5) "Tune `ef_search` first for recall; only increase `m` if recall plateaus and memory allows."; TG6 (6) "Use this on every production DDL statement." (about `lock_timeout`); TG7 (7) "denormalize **only** for measured, high-ROI reads where join performance is proven problematic"; TG8 (~8) "scaling to millions of rows without leaving the database"; TG9 (~9) "prefer `BIGINT` unless storage space is critical"
- PlanetScale: PS1 (1) "Add `NOT NULL` to as many columns as possible"; PS2 (~2) "Apps **must** handle "could not serialize access" with retry logic."; PS3 (✗3) "**Index columns in WHERE, JOIN, and ORDER BY** clauses" and PS3b "**Always index foreign key columns** — PostgreSQL does not auto-create these"; PS4 (4) "**Verify with EXPLAIN ANALYZE** — confirm indexes are actually used"; PS6 (6) "Constraints: `{table}_{column}_{type}` (e.g., `order_status_check`)"; PS7 (7) "Keep tables normalized; denormalize only for proven hot read paths"; PS9 (9) "Use `BIGINT` for all IDs and foreign keys, even on small tables"
- Supabase skill: SK1 (~1) "Row Level Security (RLS) enforces data access at the database level"; SK2 (2) "Using separate SELECT-then-INSERT/UPDATE creates race conditions. Use INSERT ... ON CONFLICT for atomic upserts."; SK3 (✗3) "For JOIN columns, always index the foreign key side:" and SK3b "Create index on frequently filtered column"; SK4 (4) "EXPLAIN ANALYZE executes the query and shows actual timings, revealing the true performance bottlenecks."; SK6 (✗6) "Use DO block to check before adding"; SK7 (7) "Strings: use text, not varchar(n) unless constraint needed"; SK9 (9) "IDs: use bigint, not int (future-proofing)"

## Harvested tips

These 29 tips go beyond the owner's nine concerns: techniques, thresholds and traps stated by the strongest matches (GitLab, Laurenz Albe, the PostgreSQL manual, Andrew Atkinson, Andrew Kane, Haki Benita, Brandur Leach, Nikolay Samokhvalov, Supabase's documentation), corroborated where noted by the next tier and by the lab. Table and column names are illustrative until pass F settles the data model; the access-layer API is left to pass B, so TypeScript examples use node-postgres error fields (verified through Context7) or plain SQL.

### H-1: Re-crawl with `INSERT … ON CONFLICT` and a change guard, not by catching unique violations

- Topic: writes, idempotency
- Why: catching `unique_violation` is race-free, but a failed INSERT has already written the row, so every duplicate leaves a dead tuple; `ON CONFLICT` checks first and leaves none; and `ON CONFLICT … DO UPDATE` that rewrites an unchanged row creates a new row version anyway. Our crawler sees most listings again every day, so duplicates are the normal path.
- How:

  ```sql
  INSERT INTO listing_source_record AS r (source_id, external_id, content_hash, payload, fetched_at)
  VALUES ($1, $2, $3, $4, now())
  ON CONFLICT (source_id, external_id)
  DO UPDATE SET content_hash = EXCLUDED.content_hash, payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at
  WHERE r.content_hash IS DISTINCT FROM EXCLUDED.content_hash
  RETURNING id;   -- a row comes back only when something was inserted or changed
  ```

  In the lab, three calls (new, unchanged, changed) returned `1`, nothing, `1`, and the table statistics showed one insert and one update (measured, the lab's `tips.sql`, not kept). Record "seen again" cheaply and separately (for example one row per crawl run, or `last_seen_at` bumped only when older than a day; inference). If the arbiter is a partial unique index, repeat its predicate: `ON CONFLICT (source_id, external_id) WHERE removed_at IS NULL` (measured, L3). Exclusion constraints cannot be `DO UPDATE` arbiters (measured, L9). Whatever access layer pass B picks must express `ON CONFLICT … WHERE`; Prisma's `upsert` becomes `INSERT … ON CONFLICT` only when its documented criteria hold (PRu1, PRu2).
- Sources: Haki Benita — "How to Get or Create in PostgreSQL" — https://hakibenita.com/postgresql-get-or-create — 2024-08-05 — "The table contains a dead tuple for every attempt to insert a tag that already existed." / "Size is the same and no dead tuples" / "We once again have a bloat issue!" (about a no-op `DO UPDATE`). PostgreSQL 18 — INSERT — https://www.postgresql.org/docs/current/sql-insert.html — living — "The optional ON CONFLICT clause specifies an alternative action to raising a unique violation or exclusion constraint violation error."
- Confidence: high (Haki measured sizes with autovacuum off; the lab confirmed the arbiter rules).
- Conflicts: Haki himself: catching the violation is "perfectly fine" where duplicates are rare (HB2), so it stays right for user actions such as saving the same search twice. Supabase's `data-upsert.md` updates without a change guard.

### H-2: Update only rows whose value actually changes

- Topic: writes
- Why: an UPDATE writes a new version of every row it matches, changed or not. Haki's example touched 10,000 rows instead of 1,010,000 and went from 1.58 s to 0.30 s, leaving less for vacuum.
- How: Persian normalisation of existing titles touches only rows that need it: `UPDATE listing SET title = translate(title, 'يك', 'یک') WHERE title ~ '[يك]';` A nightly revaluation writes `SET market_value_toman = $2 WHERE id = $1 AND market_value_toman IS DISTINCT FROM $2`. Batch jobs in TypeScript compare hashes before sending updates.
- Sources: Haki Benita — "Some SQL Tricks of an Application DBA" — https://hakibenita.com/sql-tricks-application-dba — 2020-07-27 — "To speed up an UPDATE command it's best to make sure you only update what needs updating." / "Only 10,000 rows needed to update."
- Confidence: high
- Conflicts: none found.

### H-3: Put `lock_timeout` and `statement_timeout` at the top of every migration that locks an existing table, and retry on lock timeout

- Topic: migrations
- Why: a migration waiting for an ACCESS EXCLUSIVE lock queues every later query on that table behind it, reads included, for as long as it waits. A short lock timeout turns that outage into a retry. Here the likely blocker is a long worker transaction, such as a batch of LLM extractions (inference).
- How: the migration runner (or the first lines of each file) sets `SET lock_timeout = '2s'; SET statement_timeout = '60s';` and retries the migration a few times with jitter when it fails with SQLSTATE `55P03` (lock_not_available). Files that only create new tables, and `CONCURRENTLY` operations, are exempt (Nikolay). Squawk's `require-lock-timeout` and `require-statement-timeout` enforce the settings (measured).
- Sources: Nikolay Samokhvalov — "Common DB schema change mistakes" (Wayback copy of 2022-05-27) — https://postgres.ai/blog/20220525-common-db-schema-change-mistakes — 2022-05-25 — "you should have retry logic with low lock_timeout". Squawk docs — `require-lock-timeout` — https://github.com/sbdchd/squawk/blob/master/docs/docs/require-lock-timeout.md — commit 75031c2 — "You must configure a `lock_timeout` to safely apply migrations." Tiger Data pg-aiguide — `postgres-database-migration` — commit b236d35 — "Use this on every production DDL statement."
- Confidence: high
- Conflicts: pg-aiguide describes two schools (50–100 ms with many retries, or 3–5 s with few); at our traffic either works (inference).

### H-4: Keep `IF [NOT] EXISTS` out of versioned migrations, and prove each migration with migrate, roll back, migrate

- Topic: migrations
- Why: `IF NOT EXISTS` lets a migration "succeed" against a table that differs from what it expects, hiding drift instead of revealing it; running the chain do-undo-do in CI exposes such misuse.
- How: plain `CREATE TABLE snapshot (…)`. CI migrates an empty database to the latest version, rolls back the newest migration, migrates again, then diffs `pg_dump --schema-only` against the committed snapshot (see Mechanical checks). In `.squawk.toml`, exclude `prefer-robust-stmts` and set `assume_in_transaction = true` when the runner wraps each file in a transaction.
- Sources: Nikolay Samokhvalov — as H-3 — "If this code is used not for benchmarking or testing scripts but to define some application schema, this approach is usually a bad idea." / "If you start testing the chain DO-UNDO-DO (apply the change, revert it, and re-apply again), it can help"
- Confidence: high
- Conflicts: Squawk `prefer-robust-stmts` — "A non-robust migration that fails after partially applying may fail again when retried." (SW2); Supabase's `schema-constraints.md` — "Use DO block to check before adding" (SK6). Both assume re-running a half-applied file; a runner that wraps each file in a transaction removes that case (inference).

### H-5: Split `NOT VALID` from `VALIDATE`, and give `CREATE INDEX CONCURRENTLY` a migration of its own

- Topic: migrations, locks
- Why: `NOT VALID` skips the scan; `VALIDATE CONSTRAINT` scans under a weaker lock, but only if it runs in a later transaction. `CONCURRENTLY` cannot run inside a transaction, and a failed build leaves an INVALID index behind.
- How: `0012`: `ALTER TABLE listing ADD CONSTRAINT listing_price_toman_check CHECK (price_toman > 0) NOT VALID;` `0013`: `ALTER TABLE listing VALIDATE CONSTRAINT listing_price_toman_check;` `0014` (non-transactional, starts with `-- squawk-disable-assume-in-transaction`): drop a leftover INVALID index of the same name if one exists, then `CREATE INDEX CONCURRENTLY listing_model_id_model_year_idx ON listing (model_id, model_year);`. Measured lock levels: `ADD CHECK … NOT VALID` held AccessExclusiveLock briefly, `ADD FOREIGN KEY … NOT VALID` ShareRowExclusiveLock on both tables, `VALIDATE` ShareUpdateExclusiveLock (L6). Squawk flags validation in the same transaction and CONCURRENTLY inside one (measured).
- Sources: PostgreSQL 18 — ALTER TABLE — https://www.postgresql.org/docs/current/sql-altertable.html — living — "Although most forms of ADD table_constraint require an ACCESS EXCLUSIVE lock, ADD FOREIGN KEY requires only a SHARE ROW EXCLUSIVE lock." and, for VALIDATE CONSTRAINT, "This command acquires a SHARE UPDATE EXCLUSIVE lock." GitLab — "Foreign keys and associations" — https://docs.gitlab.com/development/database/foreign_keys/ — living — "adding the column, adding an FK constraint and validating the constraint should be done in separate transactions." Nikolay Samokhvalov — as H-3 — "a failed CREATE INDEX CONCURRENTLY leaves an invalid index behind."
- Confidence: high (documentation and lab agree)
- Conflicts: pg-aiguide's lock table lists `ADD CONSTRAINT ... NOT VALID` under ShareUpdateExclusiveLock (TGe3); wrong for CHECK (measured). Early on our tables are small, so this protects habits more than uptime; it costs nothing because the linter and reviewer check it (inference).

### H-6: Name every constraint on purpose, and turn names into Persian messages in one place

- Topic: constraints, errors
- Why: PostgreSQL puts the violated constraint's name into the error, so the name can carry meaning to the application; explicit names also make cleanup scripts reliable and keep the schema consistent. This is the missing half of concern 1: the application validates for friendly field messages, the constraint guarantees, and its name becomes the fallback message.
- How: one convention; PostgreSQL's own suffixes (`_pkey`, `_key`, `_fkey`, `_check`, `_excl`, `_idx`) make hand-written and generated names look alike (inference). In the data layer:

  ```ts
  const constraintMessages = {
    listing_source_record_source_id_external_id_key: 'این آگهی قبلاً ثبت شده است',
    listing_price_toman_check: 'قیمت باید بیشتر از صفر باشد',
  } as const satisfies Record<string, string>;
  // node-postgres DatabaseError: err.code === '23505' | '23503' | '23514', err.constraint === '<name>'
  ```

  A schema test reads `pg_constraint` and fails when a constraint has no entry, or when a name breaks the convention. The Zod schema in the action still checks input first (`.claude/rules/server-actions-data.md`); the constraint is the guarantee behind it.
- Sources: PostgreSQL 18 — CREATE TABLE — https://www.postgresql.org/docs/current/sql-createtable.html — living — "constraint names like col must be positive can be used to communicate helpful constraint information to client applications." PostgreSQL 18 — Constraints — https://www.postgresql.org/docs/current/ddl-constraints.html — living — "This clarifies error messages and allows you to refer to the constraint when you need to change it." Nikolay Samokhvalov — as H-3 — "it is usually better to take control over names, making cleanup implementation straightforward." GitLab — "Constraint naming convention" — https://docs.gitlab.com/development/database/constraint_naming_convention/ — living — "The intent is not to retroactively change names in existing databases but rather ensure consistency of future changes."
- Confidence: high (error fields measured, L10)
- Conflicts: GitLab's convention uses prefixes (`check_<table>_<column>`, `fk_…`); PlanetScale's uses `{table}_{column}_{type}` (PS6). Pick one.

### H-7: Index a foreign key only when a join, a filter, or deletes on the parent need it

- Topic: indexing
- Why: PostgreSQL does not need an index on the referencing column. It helps when you look up the children of a few parents, and when parents are deleted or their keys change. When the referencing table is small, or when no query joins that way and parents are never deleted, it is only write cost.
- How: `snapshot.source_id` references `source` (a handful of rows, never deleted): no single-column index; a composite `(source_id, fetched_at DESC)` only if the "latest snapshots per source" query needs it, shown by a plan. `listing_photo.listing_id`: index it, because photos load per listing and are deleted when a source asks for removal (ADR-0008, item 8). List unindexed foreign keys by table size (Laurenz Albe's query) as a report in the catalog lint, never as a failure.
- Sources: Laurenz Albe — "Foreign Key Indexing and Performance in PostgreSQL" — https://www.cybertec-postgresql.com/en/index-your-foreign-key/ — 2018-10-10 — "If the source table is small, you don't need the index, because then a sequential scan is probably cheaper than an index scan anyway."
- Confidence: medium-high
- Conflicts: GitLab — "when adding a foreign key, you must always add an index first" (GL1b); Supabase's and PlanetScale's skills say always (SK3, PS3b). An owner decision.

### H-8: Find unused indexes from statistics after real traffic, and know what distorts the counts

- Topic: indexing, measurement
- Why: indexes cost space and writes and prevent HOT updates; the manual says seldom-used ones should go. But `EXPLAIN ANALYZE` increments the scan counters, a statistics reset hides history, and unique or primary-key indexes enforce constraints even with zero scans.
- How: a monthly `pnpm db:unused-indexes` with the read-only role: `pg_stat_user_indexes` with `idx_scan < 10`, excluding indexes that back constraints, printed with `pg_stat_database.stats_reset`. Dropping happens in a reviewed migration with `DROP INDEX CONCURRENTLY`, after a human agrees. For Carshenas, an index on a column the crawler updates daily (such as `last_seen_at`) would stop HOT updates on the busiest write path (inference).
- Sources: Laurenz Albe — "Get rid of your unused indexes!" — https://www.cybertec-postgresql.com/en/get-rid-of-your-unused-indexes/ — 2018-04-12 — "Indexes prevent HOT updates." and, in his reply of 2021-12-15 on the same page, "Since EXPLAIN (ANALYZE) executes the query, it will of course increase the index scan count." PostgreSQL 18 — Indexes, Introduction — https://www.postgresql.org/docs/current/indexes-intro.html — living — "Therefore indexes that are seldom or never used in queries should be removed."
- Confidence: high
- Conflicts: none; PlanetScale's "**Always confirm with a human before removing or dropping any indexes**" (PSg1) agrees.

### H-9: Read plans with `EXPLAIN (ANALYZE, BUFFERS)` and `track_io_timing`, starting at the first bad row estimate

- Topic: measurement
- Why: BUFFERS shows the 8 kB blocks each node touches; timing moves with the cache while block counts are stable, so optimise blocks and check time at the start and end; the lowest node whose estimate is far from the actual row count usually explains the rest.
- How: `SET track_io_timing = on;` then `EXPLAIN (ANALYZE, BUFFERS) SELECT … FROM listing WHERE model_id = $1 AND city_id = $2 AND price_toman < $3 AND delisted_at IS NULL ORDER BY deal_score DESC LIMIT 24;` with realistic values (Peugeot 206 in Tehran under 500,000,000 toman). For parameterised statements, `PREPARE` and `EXPLAIN EXECUTE` (Markus Winand's PostgreSQL page). `EXPLAIN ANALYZE` executes the statement, so wrap data changes in `BEGIN … ROLLBACK`. The review note records estimated against actual rows and shared hit/read, not only milliseconds.
- Sources: Laurenz Albe — "How to interpret PostgreSQL EXPLAIN ANALYZE output" — https://www.cybertec-postgresql.com/en/how-to-interpret-postgresql-explain-analyze-output/ — 2021-05-27 — "it shows how many 8kB-blocks each step reads, writes and dirties. You always want this." / "Find the lowest node where the estimated row count is significantly different from the actual row count." Nikolay Samokhvalov — "EXPLAIN (ANALYZE) needs BUFFERS to improve the Postgres query optimization process" — https://postgres.ai/blog/20220106-explain-analyze-needs-buffers-to-improve-the-postgres-query-optimization-process — 2022-01-06 — "Timing is volatile. Data volumes are stable."
- Confidence: high
- Conflicts: none.

### H-10: Measure on realistic, production-sized data, analysed first

- Topic: measurement, test data
- Why: plans depend on table size and value distribution. Tiny tables make sequential scans the right answer, and indexes tuned on test data only fit the test data. Without ANALYZE the planner guesses.
- How: a seed generator producing a few hundred thousand listings with realistic skew (city, make and model shares taken from CS-6's first crawl once it exists; inference), or a restore of sanitised crawled snapshots; `ANALYZE` after loading; performance claims come only from this dataset, never from the fixtures.
- Sources: PostgreSQL 18 — "Examining Index Usage" — https://www.postgresql.org/docs/current/indexes-examine.html — living — "Always run ANALYZE first." / "Using test data for setting up indexes will tell you what indexes you need for the test data, but that is all." Michael Christofides — "Why isn't Postgres using my index?" — https://www.pgmustard.com/blog/why-isnt-postgres-using-my-index — 2021-09-28 — "If a table is small (very roughly 100 rows or fewer), Postgres may estimate that it will be faster to read the table sequentially" / "…and you have a lot more data in production, you may need to consider testing on a more realistic dataset."
- Confidence: high
- Conflicts: none.

### H-11: Enable `pg_stat_statements` and `auto_explain` from the first migration, and read the workload after every end-to-end run

- Topic: measurement
- Why: `pg_stat_statements` ranks normalised statements by the time they cost in total; `auto_explain` logs the plans of slow statements as they happen. Reading the workload after a test run is pganalyze_lint's idea, a cheap early signal even on small data (inference).
- How: Compose `command: postgres -c shared_preload_libraries=pg_stat_statements,auto_explain -c pg_stat_statements.track=all -c auto_explain.log_min_duration=200ms -c auto_explain.log_analyze=on -c auto_explain.log_buffers=on -c track_io_timing=on`; the first migration runs `CREATE EXTENSION pg_stat_statements`; after `pnpm e2e`, `pnpm db:top-queries` prints the top 20 by `total_exec_time` with `calls`, `mean_exec_time`, `rows` and `shared_blks_read`.
- Sources: Craig Kerstiens — "More on Postgres Performance" — https://www.craigkerstiens.com/2013/01/10/more-on-postgres-performance/ — 2013-01-10 — "This simple query will show a few very key pieces of information that allow you to begin optimizing". Andrew Atkinson — "Puny to Powerful PostgreSQL Rails Apps" — https://andyatkinson.com/pg-puny-powerful — 2022-05-18 — "Work on high impact queries via statistics with pg_stat_statements". Andrew Kane — pgvector README — https://github.com/pgvector/pgvector — living — "Use existing tools like pg_stat_statements or PgHero to monitor performance."
- Confidence: high for the tools; medium for the end-to-end workload idea.
- Conflicts: none.

### H-12: Tell the planner about correlated columns with `CREATE STATISTICS`

- Topic: statistics
- Why: the planner treats conditions on different columns as independent. Make and model are anything but, so `make_id = … AND model_id = …` is underestimated and can pull a plan built for a handful of rows onto thousands (inference).
- How: `CREATE STATISTICS listing_make_id_model_id_stats (dependencies, ndistinct, mcv) ON make_id, model_id FROM listing; ANALYZE listing;` then compare estimated and actual rows in `EXPLAIN ANALYZE` before and after. Candidates: `(province_id, city_id)`, `(model_id, model_year)`, `(model_id, trim_id)`.
- Sources: PostgreSQL 18 — "Statistics Used by the Planner" — https://www.postgresql.org/docs/current/planner-stats.html — living — "The planner normally assumes that multiple conditions are independent of each other, an assumption that does not hold when column values are correlated." Michael Christofides — as H-10 — "Postgres assumes that two columns are independent by default."
- Confidence: medium-high (mechanism documented; benefit to be measured on our data)
- Conflicts: none.

### H-13: Keep CHECK constraints row-local and time-stable; express cross-row rules with composite keys, partial unique indexes or exclusion constraints

- Topic: constraints
- Why: PostgreSQL evaluates CHECK constraints only when a row is written and assumes they always give the same answer; a CHECK that looks at other rows or at the clock silently stops being true. Declarative constraints see concurrent uncommitted rows and cannot race, while triggers and application checks can.
- How: a listing's model must belong to its make: `ALTER TABLE model ADD CONSTRAINT model_make_id_id_key UNIQUE (make_id, id);` and `ALTER TABLE listing ADD CONSTRAINT listing_make_id_model_id_fkey FOREIGN KEY (make_id, model_id) REFERENCES model (make_id, id);`. One canonical listing per duplicate group: `CREATE UNIQUE INDEX listing_duplicate_group_id_canonical_key ON listing (duplicate_group_id) WHERE is_canonical;`. A listing's price periods never overlap: `CREATE EXTENSION btree_gist;` then `ALTER TABLE listing_price ADD CONSTRAINT listing_price_listing_id_valid_during_excl EXCLUDE USING gist (listing_id WITH =, valid_during WITH &&);`. The exclusion constraint rejected an overlapping period in the lab (measured, the lab's `tips.sql`, not kept). Rules no constraint can express run under SERIALIZABLE with a retry on SQLSTATE `40001`.
- Sources: Laurenz Albe — "Breaking your PostgreSQL database with bad CHECK constraints" — https://www.cybertec-postgresql.com/en/bad-check-constraints-postgresql/ — 2023-03-14 — "PostgreSQL assumes that CHECK constraints' conditions are immutable, that is, they will always give the same result for the same input row." Laurenz Albe — "Triggers to enforce constraints in PostgreSQL" — https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/ — 2019-04-25 — "When checking constraints, PostgreSQL also checks rows that would normally not be visible to the current transaction." PostgreSQL 18 — "Data Consistency Checks at the Application Level" — https://www.postgresql.org/docs/current/applevel-consistency.html — living — "It is very difficult to enforce business rules regarding data integrity using Read Committed transactions"
- Confidence: high
- Conflicts: none.

### H-14: Enqueue background jobs in the same transaction as the rows they need

- Topic: worker, queue
- Why: a job queued outside the transaction can start before the rows it needs are committed, or outlive a rollback. With the queue in the same database the enqueue commits or rolls back with the data, and one dependency is easier to run.
- How: in the worker, one transaction inserts the snapshot and the `extract-listing` job (a jobs table, or a PostgreSQL queue that accepts the caller's connection; pass B verifies which libraries can). A Redis-backed queue cannot share the transaction. Keep these transactions short, because long ones hold back vacuum on the job table (Brandur's 2015 "Postgres Job Queues & Failure By MVCC", read, not quoted).
- Sources: Brandur Leach — "Transactionally Staged Job Drains in Postgres" — https://brandur.org/job-drain — 2017-09-20 — "A worker starts running it before its enclosing transaction is committed, and it fails to access data that it expected to be available." Brandur Leach — "River: a Fast, Robust Job Queue for Go + Postgres" — https://brandur.org/river — 2023-11-20 — "When used well, transactions and background jobs are a match made in heaven" / "No ElastiCache, no Redis, no bespoke queueing components, just Postgres."
- Confidence: high for the principle; library specifics are pass B's.
- Conflicts: ADR-0007 still lists BullMQ on Redis as an option.

### H-15: Make health checks run a real query through the application's own pool

- Topic: operations (CS-4 criterion 3)
- Why: a health endpoint that never touches the database stays green during a database outage.
- How: `GET /api/health` runs `SELECT 1` through the web app's pool with a 1 s statement timeout and answers 503 on failure; the worker exposes the same probe and also reads the job table. No versions or secrets in the body. A Route Handler is acceptable here because this is not a page read (inference; check against ADR-0004).
- Sources: Brandur Leach — "Honest health checks that hit the database" — https://brandur.org/fragments/database-health-check — 2023-02-19 — "the health check endpoint was a no-op HTTP handler that ran perfectly fine even when the database was down."
- Confidence: high
- Conflicts: none.

### H-16: Enforce uniqueness of long URLs through a compact generated key, and measure the index first

- Topic: constraints, index size
- Why: a unique B-tree on long URLs stores every URL a second time. Haki measured a hash-based exclusion constraint at a fifth of the B-tree's size, but it cannot be referenced by a foreign key or used as an `ON CONFLICT DO UPDATE` arbiter.
- How: a generated key keeps both properties: `url_md5 uuid GENERATED ALWAYS AS (md5(url)::uuid) STORED` with `CONSTRAINT snapshot_source_id_url_md5_key UNIQUE (source_id, url_md5)`; it worked with `ON CONFLICT … DO UPDATE` and reported the constraint name on conflict (measured, L9, L10). `sha256(convert_to(url, 'UTF8'))` is rejected in a generated column because `convert_to` is STABLE (measured); if a cryptographic hash is wanted, compute it in TypeScript (`createHash('sha256').update(url, 'utf8').digest()`) and store `bytea`. MD5 serves as a key here, not as security (inference). Compare `pg_relation_size` of the options on real crawled URLs before choosing.
- Sources: Haki Benita — "Unconventional PostgreSQL Optimizations" — https://hakibenita.com/postgresql-unconventional-optimizations — 2026-01-20 — "The Hash index is x5 smaller than the corresponding B-Tree index." / "Column cannot be referenced by foreign keys"
- Confidence: medium (depends on real URL lengths)
- Conflicts: none; Haki's own variant (`EXCLUDE USING hash`) suits tables nothing references.

### H-17: Store strings as `text` with CHECK limits, including a Persian normalisation invariant

- Topic: types, constraints
- Why: changing a `varchar(n)` limit takes a heavy lock, while a CHECK limit on `text` can be changed with `NOT VALID` and `VALIDATE`. A CHECK can also prove that the crawler's normalisation ran.
- How: `title text NOT NULL CONSTRAINT listing_title_check CHECK (char_length(title) BETWEEN 1 AND 300)` and `CONSTRAINT listing_title_persian_letters_check CHECK (title !~ '[يك]')` (Arabic yeh and kaf are converted to Persian before insert; the constraint proves it). Squawk's `prefer-text-field` and `ban-char-field` catch the rest (measured).
- Sources: GitLab — "Strings and the Text data type" — https://docs.gitlab.com/development/database/strings_and_the_text_data_type/ — living — "text columns should always have a limit set" / "adding a limit on an existing column or updating their limit does not require the very costly EXCLUSIVE LOCK"
- Confidence: high
- Conflicts: none; Supabase's skill agrees ("Strings: use text, not varchar(n) unless constraint needed", SK7).

### H-18: Treat an approximate vector index as a trade of recall for speed, and measure recall against exact search

- Topic: pgvector
- Why: pgvector searches exactly by default; an approximate index changes results; recall should be monitored against exact search; small collections may need no index at all.
- How: duplicate detection compares a new listing with candidates of the same model and nearby years, often a few hundred rows (inference), so start with exact distance behind a B-tree filter: `WHERE model_id = $1 AND model_year BETWEEN $2 - 1 AND $2 + 1 ORDER BY title_embedding <=> $3 LIMIT 20`. Add HNSW (vendored golden path, `halfvec` when dimensions allow) only when p95 latency requires it. A nightly job samples 200 listings and reports recall@20 of the indexed query against the same query under `SET LOCAL enable_indexscan = off`. With normalised embeddings, use inner product (`<#>`): pgvector's README says "If vectors are normalized to length 1 (like OpenAI embeddings), use inner product for best performance."
- Sources: Andrew Kane — pgvector README — https://github.com/pgvector/pgvector — living — "By default, pgvector performs exact nearest neighbor search, which provides perfect recall." / "Unlike typical indexes, you will see different results for queries after adding an approximate index." / "Monitor recall by comparing results from approximate search with exact search." Supabase — "Going to production" — https://supabase.com/docs/guides/ai/going-to-prod — living — "You don't have to create indexes in these cases and can use sequential scans instead." / "Prefer inner-product to L2 or Cosine distances if your vectors are normalized"
- Confidence: high
- Conflicts: Crunchy Data keeps vector data on a separate database (CD8); measure HNSW build load first.

### H-19: In filtered vector search the filter runs after the index scan: prefilter, or turn on iterative scans

- Topic: pgvector
- Why: HNSW returns `ef_search` candidates and only then applies the WHERE clause, so a selective filter returns too few rows. The lab plan shows `Filter: (model_id = 3)` under the HNSW index scan (L8).
- How: for filtered queries `SET LOCAL hnsw.iterative_scan = relaxed_order` (pgvector 0.8.0 and later) with `hnsw.max_scan_tuples` as the budget; or prefilter through a B-tree and search exactly (H-18); or partial HNSW indexes for the few largest models. Measure tuples visited and p95 latency.
- Sources: Andrew Kane — pgvector README — living — "With approximate indexes, filtering is applied after the index is scanned." / "If a condition matches 10% of rows, with HNSW and the default hnsw.ef_search of 40, only 4 rows will match on average." Tiger Data — pg-aiguide `pgvector-semantic-search` — commit b236d35 — "Always validate filtered queries by measuring p95/p99 latency and tuples visited under realistic load."
- Confidence: high
- Conflicts: none.

### H-20: Use BRIN for append-only time columns once `pg_stats` shows high correlation

- Topic: indexing
- Why: BRIN keeps a minimum and maximum per range of blocks, so it is tiny and works when a column follows the physical order of the table.
- How: `snapshot.fetched_at` and a price-observation table's `observed_at` are appended in time order. Check `SELECT correlation FROM pg_stats WHERE tablename = 'snapshot' AND attname = 'fetched_at';` (close to 1), then `CREATE INDEX CONCURRENTLY snapshot_fetched_at_brin_idx ON snapshot USING brin (fetched_at);` and compare it with a B-tree under `EXPLAIN (ANALYZE, BUFFERS)` for a query over the last seven days of snapshots. Updates move rows and lower the correlation (inference).
- Sources: Haki Benita — "Some SQL Tricks of an Application DBA" — https://hakibenita.com/sql-tricks-application-dba — 2020-07-27 — "a BRIN index can provide a better "value for money" in terms of size and performance compared to a similar B-Tree index."
- Confidence: medium-high
- Conflicts: none.

### H-21: Index the hot subset with a partial index whose predicate the query repeats

- Topic: indexing
- Why: if queries always select the same subset, an index over just that subset is smaller and cheaper to keep up; Haki showed the planner ignoring an index for the common value anyway.
- How: search shows only active listings: `CREATE INDEX CONCURRENTLY listing_active_model_id_price_toman_idx ON listing (model_id, price_toman) WHERE delisted_at IS NULL;`. The query must contain `delisted_at IS NULL` for the planner to use it (inference from the manual's partial-index chapter).
- Sources: Haki Benita — as H-20 — "if the database is not going to use the index to filter active users, why should we index them in the first place?"
- Confidence: high
- Conflicts: none.

### H-22: Try a plan without an index by dropping it inside a transaction and rolling back (development only)

- Topic: measurement
- Why: transactional DDL lets you see the plan without an index and undo the drop.
- How: on the local container only: `BEGIN; DROP INDEX listing_model_id_model_year_idx; EXPLAIN (ANALYZE, BUFFERS) …; ROLLBACK;`. `DROP INDEX` holds an ACCESS EXCLUSIVE lock until the rollback, so never on a shared database (inference). HypoPG does the opposite (a hypothetical index) when installed.
- Sources: Haki Benita — as H-20 — "This comes in handy when you want to see what an execution plan looks like without some index."
- Confidence: high
- Conflicts: none.

### H-23: Review the SQL the access layer sends, with its plan, not the builder code

- Topic: review
- Why: GitLab's database reviewers ask for the SQL text of every changed query and its plan, because the builder call hides what runs.
- How: every task that adds or changes a query records the SQL (whatever pass B's layer offers to print it) and its `EXPLAIN (ANALYZE, BUFFERS)` on the seeded database, before and after for changed queries; the `database-reviewer` stops a diff without them.
- Sources: GitLab — "Database review guidelines" — https://docs.gitlab.com/development/database_review/ — living — "Raw SQL for all changed or added queries (as translated from ActiveRecord queries)." / "Query plans for each raw SQL query included in the merge request along with the link to the query plan following each raw SQL snippet."
- Confidence: high
- Conflicts: none.

### H-24: Prefer hard deletes and an audit row to soft deletion, which quietly disables foreign keys

- Topic: modelling
- Why: a soft-deleted parent is still "there", so foreign keys no longer stop orphans, and every query must remember the flag.
- How: when a source asks us to remove its data (ADR-0008, item 8), hard-delete its source records and photos with `ON DELETE CASCADE` from `listing_source_record`, and write one row to a `data_removal_log (source_id, requested_at, removed_count)`. `listing.delisted_at` stays: it is a business state (the ad left the source), not a deletion.
- Sources: Brandur Leach — "Soft Deletion Probably Isn't Worth It" — https://brandur.org/soft-deletion — 2022-07-19 — "Another consequence of soft deletion is that foreign keys are effectively lost." / "The major benefit of foreign keys is that they guarantee referential integrity."
- Confidence: medium-high
- Conflicts: none among the sources; a design choice for pass F.

### H-25: Keys are `bigint` identity, money is `bigint` toman, public identifiers can use PostgreSQL 18's `uuidv7()`

- Topic: types, growth
- Why: changing `integer` keys to `bigint` on a large live table is painful, 8-byte keys cost little, and "things may change if the project is successful". `numeric(10,2)` overflows at a 1.5 billion toman price (measured, L2).
- How: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`; foreign keys `bigint`; `price_toman bigint NOT NULL CONSTRAINT listing_price_toman_check CHECK (price_toman > 0)` (the unit is CS-2's decision); for identifiers that appear in URLs of native listings later, `public_id uuid NOT NULL DEFAULT uuidv7()` with a unique constraint, built into PostgreSQL 18 (measured, L7). In TypeScript decide once how `int8` is read (node-postgres returns it as a string by default; inference, to confirm in pass B).
- Sources: Laurenz Albe — "UUID, serial or identity columns for PostgreSQL auto-generated primary keys?" — https://www.cybertec-postgresql.com/en/uuid-serial-or-identity-columns-for-postgresql-auto-generated-primary-keys/ — 2021-05-20 — "You should always use bigint." / "it is quite complicated to change the primary key column from integer to bigint in a big table inside an active database". Nikolay Samokhvalov — as H-3 — "using int8 always, even if you don't expect your table to grow right now – things may change if the project is successful."
- Confidence: high
- Conflicts: Andrew Atkinson — "For small databases, use integer primary keys." (AA9b); Supabase's skill uses `numeric(10,2)` for money (SKm) and pg-aiguide and PlanetScale say numeric for money. The repo's integer-money rule wins.

### H-26: Give agents a read-only role on any shared database; never rely on a tool's read-only mode

- Topic: agent safety
- Why: two MCP servers' read-only modes were bypassed (the archived reference server by stacked statements, Postgres MCP Pro by a function in FROM); the fix every source gives is a restricted database user.
- How: the agent's DDL and experiments run only on its local container. For staging or production diagnostics, a role such as `carshenas_agent_ro` with `LOGIN`, `default_transaction_read_only = on`, `statement_timeout = '5s'`, `pg_read_all_stats` and only the SELECT grants it needs; no ownership, no superuser. The `PreToolUse` hook asks before destructive commands.
- Sources: Santiago Mola (Datadog Security Labs) — "MCP vulnerability case study: SQL injection in the Postgres MCP server" — https://securitylabs.datadoghq.com/articles/mcp-vulnerability-case-study-SQL-injection-in-the-postgresql-mcp-server/ — 2025-08-21 — "Users should avoid using the now deprecated Postgres MCP server when connecting to any database where write operations should be prevented." / "using a Postgres user with restricted privileges. You should definitely do this." crystaldba/postgres-mcp issue #178 — https://github.com/crystaldba/postgres-mcp/issues/178 — 2026-06-06 — "SELECT * FROM pg_read_file('/etc/passwd') returns the file." Anthropic — Claude Code MCP docs — https://code.claude.com/docs/en/mcp — living — "Use a read-only database user in the connection string so the queries Claude runs can’t modify data"
- Confidence: high
- Conflicts: none.

### H-27: Model value lists that change as lookup tables; keep CHECK lists for closed sets

- Topic: modelling
- Why: a list of values inside a CHECK or ENUM hurts once the set changes: every change is DDL, and the labels live outside the data.
- How: `fuel_type (code text PRIMARY KEY, label_fa text NOT NULL, sort_order smallint NOT NULL)` with rows for petrol, dual-fuel, hybrid, electric and diesel labelled «بنزینی», «دوگانه‌سوز», «هیبریدی», «برقی», «دیزلی»; `listing.fuel_type text NOT NULL REFERENCES fuel_type (code)`. Closed sets such as `transmission IN ('manual', 'automatic')` stay a CHECK. Body types and sources follow the lookup-table pattern.
- Sources: Bill Karwin — "SQL Antipatterns, Volume 1", excerpt "31 Flavors" — https://media.pragprog.com/titles/bksap1/31flavors.pdf — 2022 (excerpt undated) — "The problems with using ENUM or a check constraint arise when the set of values is not fixed."
- Confidence: medium (a design judgement; Karwin is in the lower tier, but the tip fits concern 7)
- Conflicts: PlanetScale — "Prefer CHECK constraints over ENUM types — they're easier to modify:" (PSen); pg-aiguide — "For business-logic-driven and evolving values (e.g. order statuses) → use TEXT (or INT) + CHECK or lookup table." (TGen).

### H-28: Use PostgreSQL's own features instead of designing for portability

- Topic: access layer
- Why: Craig Kerstiens calls avoiding PostgreSQL features "for the idea you might one day migrate" the biggest mistake he sees; the owner's rules depend on `ON CONFLICT`, partial unique indexes, exclusion constraints, generated columns and pgvector operators.
- How: pass B's access layer must accept parameterised raw SQL fragments for these; the rule forbids portable workarounds (application-side upserts, uniqueness checked in code).
- Sources: Craig Kerstiens (interviewed by LambdaClass) — https://blog.lambdaclass.com/the-big-old-reliable-elephant-talking-about-postgres-with-craig-kerstiens/ — 2017-04-26 — "it's not using it for the idea you might one day migrate." / "The only one that really comes to mind is graph databases."
- Confidence: medium
- Conflicts: none.

### H-29: For bulk backfills, load into an UNLOGGED staging table, then merge; build secondary indexes after the load

- Topic: bulk loading
- Why: constraints and indexes slow bulk loads, and intermediate tables that can be rebuilt need not be written to the WAL.
- How: importing historical snapshots: `CREATE UNLOGGED TABLE snapshot_import (LIKE snapshot INCLUDING DEFAULTS);` fill it with `COPY … FROM STDIN` (the driver's copy stream), validate, then `INSERT INTO snapshot SELECT … FROM snapshot_import ON CONFLICT DO NOTHING;` and drop the staging table. New secondary indexes on a freshly loaded table are built after the load. An unlogged table is emptied after a crash, which is acceptable only because the source files remain (inference).
- Sources: Haki Benita — as H-20 — "Constraints are an important part of relational databases: they keep the data consistent and reliable. Their benefits come at a cost though" / "Intermediate tables that don't need to be restored in case of disaster, and are not needed in replicas, can be set as UNLOGGED"
- Confidence: high
- Conflicts: none.

## Sources consulted

All fetched on 2026-09-26 or 2026-09-27 (Tehran time 2026-09-27). "Living" means a documentation page without a page date.

**Repositories read at a commit** (shallow clones in the research session's lab, not kept)

| Repository | Commit (date) | Licence | Used for |
|---|---|---|---|
| supabase/agent-skills | `551274ed2fe97c8fea1325f7ceb05803a542f8df` (2026-09-24) | MIT | Entry 1, SK*, SU1 |
| timescale/pg-aiguide | `b236d3583fb51f5ef009d2c95d4fc361df748280` (2026-09-25) | Apache-2.0 | Entry 2, TG*, the vendoring candidate |
| planetscale/database-skills | `73b20b7eb64716d8c7100c054f0677c0c6e77e30` (2026-08-28) | MIT | Entry 3, PS* |
| neondatabase/agent-skills | `80164a28443aca7c82ac1a70aed836950d6c29ea` (2026-09-23) | Apache-2.0 | Entry 4 |
| prisma/skills | `1123817e60d15ca0f3af91878923241dee7e3b09` (2026-09-08) | MIT | Entry 5 |
| crystaldba/postgres-mcp | `15c8e33353546148acc2d8bd784551cf3905d1e2` (2026-08-15) | MIT | Entry 8; issues #164, #178 via the GitHub API |
| bytebase/dbhub | `7b9c63b0376b5d9fd998674c025e833d8ba07d0b` (2026-09-21) | MIT | Entry 10 |
| xataio/agent (archived) | `40d6262567497048a239193df7ef5baa46e65bd9` | Apache-2.0 | Entry 12 |
| pgplex/pgschema | `580f4040d0f3c1bfad1497918200c9c1f638a020` (2026-09-20) | Apache-2.0 | Mechanical checks |
| anthropics/claude-plugins-official | `fa59bc9037741ecfa131aa27938272605710d7b2` (2026-09-25) | Apache-2.0 | Entry 13 |
| sbdchd/squawk | `75031c2a63cd8ad339e423e984efc4c671b33e3d` (2026-09-26) | Apache-2.0 or MIT | Rules docs, SW1, SW2 |
| gajus/eslint-plugin-sql | `98d0a99d52becd6e1877552f2280efa52d3c8f47` (2026-01-12) | BSD-3-Clause | ES1, detection code |
| ts-safeql/safeql | `7338ad1cc63dc84affabef19ae4069ecf3cc4387` (2026-06-30) | MIT | SQ1 |
| kaaveland/eugene | `3356eea43f3fa30e2e61d206d5f96c253cd8c6e3` (2026-03-11) | MIT | Mechanical checks |
| wshobson/agents (files by raw URL) | `9b15b34b0bfc13a815cbfc2366e14ea549e09422` | MIT | Entry 14, WS1 |
| VoltAgent/awesome-claude-code-subagents (files by raw URL) | `82b73821baa7a911d5b14cfb6da238b7f0db6b42` | MIT | Entry 14, VO1 |

Repository metadata (licence, stars, last push, archived flag) came from the GitHub API for these and for xataio/pgroll, pganalyze/lint, pganalyze/pg_stat_plans, pganalyze/libpg_query, supabase/splinter, supabase/index_advisor, HypoPG/hypopg, theory/pgtap, okbob/plpgsql_check, ankane/dexter, ankane/pghero, ankane/strong_migrations, adelsz/pgtyped, stripe/pg-schema-diff, djrobstep/migra, graphile/migrate, googleapis/mcp-toolbox, electric-sql/pglite, testcontainers/testcontainers-node, pgvector/pgvector, dalibo/pev2, neondatabase/ai-rules, modelcontextprotocol/servers-archived, drizzle-team (45 repositories). npm versions and dates came from `npm view` (squawk-cli, eslint-plugin-sql, @ts-safeql/eslint-plugin, eslint-plugin-drizzle, @electric-sql/pglite and its pgtap and pgvector packages, testcontainers).

**Context7** (library documentation, then the page itself fetched): `/drizzle-team/drizzle-orm-docs` (ESLint plugin), `/prisma/web` (telemetry, upsert), `/electric-sql/pglite` (extensions, single connection), `/brianc/node-postgres` (DatabaseError fields), `/testcontainers/testcontainers-node` (Ryuk, image prefix), `/ariga/atlas` (analyzers, community edition).

**Pages quoted**

- Agent-tool and product pages: https://securitylabs.datadoghq.com/articles/mcp-vulnerability-case-study-SQL-injection-in-the-postgresql-mcp-server/ (2025-08-21); https://code.claude.com/docs/en/mcp (living); https://atlasgo.io/community-edition and https://atlasgo.io/lint/analyzers (living); https://www.prisma.io/docs/cli/telemetry and https://www.prisma.io/docs/orm/v7/reference/prisma-client-reference (living); https://github.com/crystaldba/postgres-mcp/issues/178 (2026-06-06); https://github.com/docker/hub-feedback/issues/2103 (2021-05-17); https://raw.githubusercontent.com/electric-sql/pglite/main/README.md and https://pglite.dev/extensions/ (living); https://raw.githubusercontent.com/testcontainers/testcontainers-node/main/docs/configuration.md and …/docs/features/images.md (living); https://orm.drizzle.team/llms.txt, https://orm.drizzle.team/llms-full.txt, https://kysely.dev/llms.txt, https://kysely.dev/llms-full.txt, https://www.prisma.io/docs/llms.txt (living); https://pganalyze.com/index-advisor (living); https://www.postgresql.org/community/contributors/ (living).
- PostgreSQL 18 documentation: ddl-constraints, sql-insert, applevel-consistency, indexes-intro, indexes-examine, using-explain, planner-stats, routine-vacuuming, sql-altertable, sql-createtable, errcodes-appendix, transaction-iso, performance-tips (all under https://www.postgresql.org/docs/current/).
- GitLab: database_review, sql, database/adding_database_indexes, database/foreign_keys, database/constraint_naming_convention, database/strings_and_the_text_data_type, database/understanding_explain_plans, database/avoiding_downtime_in_migrations, database/large_tables_limitations, database/ (index) — all under https://docs.gitlab.com/development/.
- Laurenz Albe (CYBERTEC): get-rid-of-your-unused-indexes (2018-04-12), index-your-foreign-key (2018-10-10), triggers-to-enforce-constraints (2019-04-25), uuid-serial-or-identity-columns… (2021-05-20), how-to-interpret-postgresql-explain-analyze-output (2021-05-27), bad-check-constraints-postgresql (2023-03-14). Read, not quoted: Hans-Jürgen Schönig, postgresql-constraints-over-multiple-rows (2021-06-24). The author page returned HTTP 403.
- Andrew Atkinson: constraint-driven-optimized-responsive-efficient-core-db-design (2025-06-09), postgresql-tips (living), pg-puny-powerful (2022-05-18), blog/2024/04/15/hacking-postgres-podcast-andrew-atkinson (2024-04-15).
- Andrew Kane: https://github.com/pgvector/pgvector, https://github.com/ankane/dexter, https://github.com/ankane/strong_migrations (READMEs, living).
- Haki Benita: postgresql-get-or-create (2024-08-05), sql-tricks-application-dba (2020-07-27), postgresql-unconventional-optimizations (2026-01-20); read, not quoted: postgresql-unused-index-size (2021-02-01).
- Brandur Leach: acid (2017-05-16), job-drain (2017-09-20), idempotency-keys (2017-10-27), soft-deletion (2022-07-19), sqlc (2021-09-08), river (2023-11-20), fragments/database-health-check (2023-02-19); read, not quoted: postgres-queues (2015-05-18), text (2021-09-10), fragments/uuid-v7-monotonicity (2024-12-31), articles and fragments indexes.
- Nikolay Samokhvalov: https://postgres.ai/blog/20220106-explain-analyze-needs-buffers-to-improve-the-postgres-query-optimization-process (2022-01-06); https://postgres.ai/blog/20220525-common-db-schema-change-mistakes (live page, now a different ten-item list) and its Wayback copy https://web.archive.org/web/20220527134728/https://postgres.ai/blog/20220525-common-db-schema-change-mistakes.
- Supabase: docs guides database/query-optimization, database/postgres/indexes, database/tables, ai/vector-indexes, ai/vector-indexes/hnsw-indexes, ai/going-to-prod, getting-started/architecture (living); blog pgvector-vs-pinecone (2023-10-10).
- Craig Kerstiens: craigkerstiens.com 2012/10/01 understanding-postgres-performance, 2013/01/10 more-on-postgres-performance; LambdaClass interview (2017-04-26); read, not quoted: 2017/04/30 why-postgres-five-years-later, crunchydata.com "When Did Postgres Become Cool?" (2023-08-09), Changelog podcast #523 "Just Postgres" (2023-01-20, transcript).
- Markus Winand: use-the-index-luke.com sql/preface, sql/where-clause/the-equals-operator/concatenated-keys, sql/myth-directory/most-selective-first, sql/explain-plan/postgresql/getting-an-execution-plan (undated).
- Lukas Fittl: https://se-radio.net/2023/09/se-radio-583-lukas-fittl-on-postgres-performance/ (2023-09-27); read, not quoted: pganalyze 5mins-postgres-benchmarking-indexes (2022-12-15), 5mins-postgres-explain-pg-stat-statements-plan-cache-mode-normalized-query (2022-09-15), the pganalyze blog index.
- Michael Christofides: https://www.pgmustard.com/blog/why-isnt-postgres-using-my-index (2021-09-28), the pgMustard blog index.
- Crunchy Data: blog/pgvector-performance-for-developers (2023-05-05), blog/hnsw-indexes-with-postgres-and-pgvector (2023-09-01), why-postgres (undated).
- Andy Pavlo and Michael Stonebraker: https://db.cs.cmu.edu/papers/2024/whatgoesaround-sigmodrec2024.pdf (SIGMOD Record, June 2024).
- Stephan Schmidt: https://www.amazingcto.com/postgres-for-everything/ (updated 2025-12-13).
- Dan McKinley: https://mcfunley.com/choose-boring-technology (2015-03-30).
- Bill Karwin: https://pragprog.com/titles/bksap1/sql-antipatterns-volume-1/ (table of contents), https://media.pragprog.com/titles/bksap1/31flavors.pdf and intro.pdf (excerpts).
- Martin Kleppmann: logs-for-data-infrastructure (2015-05-27); read, not quoted: turning-the-database-inside-out (2015-03-04).
- Not usable: https://www.arvancloud.ir/fa/dev/docker renders only with JavaScript (12 words of text), so the ArvanCloud registry mirror is mentioned without a quote.

**Lab artefacts** (in the research session's lab, not kept): `claims.sql`/`.out` (L1–L5, L7), `locks.sql`/`.out` (L6), `hashurl.sql`, `hashurl2.sql` (L9, L10), `pgvector.sql`/`.out` (L8), `tips.sql`/`.out` (H-1, H-2, H-12, H-13), `squawk/migrations/*.sql` with `squawk.out` and `squawk-tx.out`, `eslint-sql/` (samples and both configurations), `pglite/constraints.test.mjs`. The PostgreSQL 18.6 container was `carshenas-lab-harness` (`pgvector/pgvector:pg18`); it could not reach apt repositories, so pgTAP was tested through PGlite instead of Docker, and HypoPG was not tested.
