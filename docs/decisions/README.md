# Architecture Decision Records (ADRs)

Binding decisions. Numbered `NNNN-kebab-slug.md`, dated, immutable once accepted: to change a decision, write a new ADR that supersedes the old one and link both ways.

- Create one with the `/adr` skill or copy `0000-template.md`.
- Status values: `proposed` → `accepted` | `rejected` | `superseded by ADR-NNNN`.
- Keep it to one screen: context, decision, consequences. Long analysis goes in `docs/research/` and is linked.
- Reference ADRs from tasks (`backlog task edit CS-51 --ref docs/decisions/0001-....md`) and from code comments where the decision constrains implementation.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-backlog-md-for-in-repo-task-tracking.md) | Track work in-repo with Backlog.md; docs/ holds knowledge | accepted |
| [0002](0002-browser-automation-with-playwright.md) | One pinned Playwright for tests, the agent's browser and site capture; CLI, not MCP | accepted |
| [0003](0003-bare-minimum-nextjs-16-and-react-19.md) | Next.js 16 and React 19 for the web app, kept bare; everything else arrives with the task that needs it | accepted; React version superseded by 0009; its deferred data stack decided by 0011 to 0013; its deferred monitoring reopened for logging and error reporting by 0016 |
| [0004](0004-frontend-structure-and-enforcement.md) | Thin `app/` over `src/features`, server-only data layer, no barrels, enforced by lint and the build | proposed |
| [0005](0005-styling-and-component-primitives.md) | Tailwind CSS v4 with lint-enforced logical utilities; shadcn/ui on Base UI and React Aria dates, both deferred | proposed |
| [0006](0006-used-cars-modeled-on-cargurus.md) | Build "Torob for X" as a used-car search engine modeled on CarGurus and Autolist | accepted; its "Divar cannot be crawled" risk superseded by 0008 point 3 |
| [0007](0007-data-search-and-ingestion-stack.md) | PostgreSQL as the record, Elasticsearch as the index, a separate ingestion worker, LLM steps with evaluations | superseded by 0011 |
| [0008](0008-crawl-only-what-sources-allow.md) | Crawl politely and stop on any block; sources' robots.txt and terms are recorded but not followed, for the demo | accepted (2026-09-28); its point 5 made concrete by 0017; its point 6 superseded for 429 responses by 0018 |
| [0009](0009-react-19-3.md) | Pin React 19.3.0 so unit tests run the React line the pages use | accepted |
| [0010](0010-store-listing-photos-in-arvancloud.md) | Store the listing photos the crawler may download in ArvanCloud Object Storage | accepted |
| [0011](0011-postgresql-for-records-search-vectors-and-jobs.md) | PostgreSQL 18 is the only data service: records, search, vectors and the job queue | accepted; its point 5 made concrete by 0018 |
| [0012](0012-kysely-and-sql-migrations.md) | Kysely on node-postgres, plain SQL migrations with dbmate, types generated from the database | accepted |
| [0013](0013-data-modeling-rules.md) | One listing table for every origin, integrity in the database, everything named | accepted |
| [0014](0014-money-in-toman-and-jalali-in-the-interface.md) | Whole tomans in bounded `bigint` columns; prices in full digits, words only inside sentences and on scales; Jalali only in the interface, from the platform's calendar | proposed |
| [0015](0015-yekan-bakh-self-hosted-never-committed.md) | Set every screen in Yekan Bakh, self-hosted through next/font/local, and never commit the font | proposed |
| [0016](0016-structured-logs-and-error-reporting.md) | Structured logs and error reporting in a shared package: pino behind our own logger, OpenTelemetry trace ids, no vendor yet | proposed |
| [0017](0017-live-bounded-replayable-listing-index.md) | Keep a live, bounded index of listings, kept fresh within a request budget, with frozen releases for evaluation | accepted by delegation (2026-09-28) |
| [0018](0018-source-lanes-request-pacing-and-rate-limits.md) | Run each source's crawl jobs in its own lane, pace every request in PostgreSQL, and cool down on a 429 before stopping | accepted (2026-09-29) |
| [0019](0019-reach-language-models-through-metis-ai.md) | Reach every language model through Metis AI, with the key in the environment, and keep working when it is down | proposed (choosing Metis is the owner's decision of 2026-09-29) |
