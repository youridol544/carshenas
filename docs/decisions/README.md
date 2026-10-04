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
| [0003](0003-bare-minimum-nextjs-16-and-react-19.md) | Next.js 16 and React 19 for the web app, kept bare; everything else arrives with the task that needs it | accepted; React version superseded by 0009; its deferred data stack decided by 0011 to 0013; its deferred monitoring reopened for logging and error reporting by 0016; its deferred authentication decided by 0020 |
| [0004](0004-frontend-structure-and-enforcement.md) | Thin `app/` over `src/features`, server-only data layer, no barrels, enforced by lint and the build | proposed |
| [0005](0005-styling-and-component-primitives.md) | Tailwind CSS v4 with lint-enforced logical utilities; shadcn/ui on Base UI and React Aria dates, both deferred | proposed |
| [0006](0006-used-cars-modeled-on-cargurus.md) | Build "Torob for X" as a used-car search engine modeled on CarGurus and Autolist | accepted; its "Divar cannot be crawled" risk superseded by 0008 point 3 |
| [0007](0007-data-search-and-ingestion-stack.md) | PostgreSQL as the record, Elasticsearch as the index, a separate ingestion worker, LLM steps with evaluations | superseded by 0011 |
| [0008](0008-crawl-only-what-sources-allow.md) | Crawl politely and stop on any block; sources' robots.txt and terms are recorded but not followed, for the demo | accepted (2026-09-28); its point 5 made concrete by 0017; its point 6 superseded for 429 responses by 0018; its point 4 changed by 0025 |
| [0009](0009-react-19-3.md) | Pin React 19.3.0 so unit tests run the React line the pages use | accepted |
| [0010](0010-store-listing-photos-in-arvancloud.md) | Store the listing photos the crawler may download in ArvanCloud Object Storage | superseded by 0025 |
| [0011](0011-postgresql-for-records-search-vectors-and-jobs.md) | PostgreSQL 18 is the only data service: records, search, vectors and the job queue | accepted; its point 5 made concrete by 0018; its point 7 follows 0025 |
| [0012](0012-kysely-and-sql-migrations.md) | Kysely on node-postgres, plain SQL migrations with dbmate, types generated from the database | accepted |
| [0013](0013-data-modeling-rules.md) | One listing table for every origin, integrity in the database, everything named | accepted |
| [0014](0014-money-in-toman-and-jalali-in-the-interface.md) | Whole tomans in bounded `bigint` columns; prices in full digits, words only inside sentences and on scales; Jalali only in the interface, from the platform's calendar | proposed |
| [0015](0015-yekan-bakh-self-hosted-never-committed.md) | Set every screen in Yekan Bakh, self-hosted through next/font/local, and never commit the font | proposed |
| [0016](0016-structured-logs-and-error-reporting.md) | Structured logs and error reporting in a shared package: pino behind our own logger, OpenTelemetry trace ids, no vendor yet | proposed |
| [0017](0017-live-bounded-replayable-listing-index.md) | Keep a live, bounded index of listings, kept fresh within a request budget, with frozen releases for evaluation | accepted by delegation (2026-09-28); the photo clause of its point 10 replaced by 0025 |
| [0018](0018-source-lanes-request-pacing-and-rate-limits.md) | Run each source's crawl jobs in its own lane, pace every request in PostgreSQL, and cool down on a 429 before stopping | accepted (2026-09-29) |
| [0019](0019-reach-language-models-through-metis-ai.md) | Reach every language model through Metis AI, with the key in the environment, and keep working when it is down | accepted (2026-09-29) |
| [0020](0020-username-and-password-accounts.md) | Accounts are a username and a password, checked by our own code, with sessions in PostgreSQL and a superadmin that only a command can make | accepted (2026-09-29) |
| [0021](0021-ai-layer-on-the-ai-sdk.md) | Call models through the AI SDK's core and provider packages, under a thin layer of our own | accepted (2026-09-29) |
| [0023](0023-superadmin-section-database-role.md) | The superadmin section works through its own database role, and changes a curated row only through a function that records which superadmin changed it, and when | accepted on the recommendation (2026-09-29) |
| [0025](0025-show-listing-photos-from-the-sources-addresses.md) | Show listing photos from the source's own addresses, and keep only those addresses | accepted (2026-09-30) |
| [0026](0026-notifications-inbox-written-through-one-function.md) | Keep buyers' notifications in one inbox table, written only through one function that honours mutes and deduplicates, with each kind declared once in code | accepted on the recommendation (2026-09-30) |
| [0027](0027-search-filters-as-declarative-definitions.md) | Define search filters and catalogues once, as data in `@carshenas/search`, over one row contract (`listing_filter_row`), with one schema and one serialisation | accepted by delegation (2026-10-01) |
| [0028](0028-search-table-kept-fresh-by-marks.md) | Serve search from a table of searchable listings (details read, seen within 48 hours) that the worker keeps fresh by marking changed listings, with keyset pages and counted facets | accepted by delegation (2026-10-01), revised 2026-10-02 |
| [0029](0029-plain-farsi-search-code-first-model-behind-a-switch.md) | Understand a typed sentence with code first, ask a model only for what code cannot settle, and keep the model behind a master switch that is off | accepted by delegation (2026-10-02) |
| [0030](0030-listing-explanation-written-by-templates.md) | Write the listing page's explanation by code from stored facts through templates, with no language model | accepted by delegation (2026-10-02) |
| [0031](0031-search-files-keep-a-stored-search-and-read-matches-live.md) | Search files keep one stored search per account and read their matches live, with a state, a last look and a limit | accepted by delegation (2026-10-03) |
| [0032](0032-model-pages-and-a-trend-from-our-own-valuation-history.md) | Model pages at /models/<make>/<model>, with a price trend built only from our own daily valuation history | accepted by delegation (2026-10-03) |
| [0033](0033-marked-listings-followed-by-a-worker-job.md) | Keep a buyer's marked listings in one table with a database cap, and tell them of changes from a worker job that writes through the notification function | accepted by delegation (2026-10-03) || [0035](0035-search-file-alerts-matched-by-watermark-one-digest-per-run.md) | Match search files by a watermark after each search refresh, and tell the buyer once per file per run, with spacing, a daily cap and a per-file mute | accepted by delegation (2026-10-03) |
| [0033](0033-marked-listings-followed-by-a-worker-job.md) | Keep a buyer's marked listings in one table with a database cap, and tell them of changes from a worker job that writes through the notification function | accepted by delegation (2026-10-03) |
| [0034](0034-pasted-links-answered-from-our-own-data.md) | Answer a pasted link from our own data, by code, and keep the links we have not seen as wanted | accepted by delegation (2026-10-03) |
| [0035](0035-search-file-alerts-matched-by-watermark-one-digest-per-run.md) | Match search files by a watermark after each search refresh, and tell the buyer once per file per run when it holds a good deal or a price drop, with spacing, a daily cap and a per-file mute | accepted by delegation (2026-10-03) |
| [0036](0036-crawl-requests-are-a-queue-the-superadmin-decides.md) | Crawl requests are a queue the superadmin decides: one request per model or trim, asked on purpose, decided through a function that records who, notifying each buyer once; an approval queues a model and crawls nothing | accepted by delegation (2026-10-03) |
| [0037](0037-tracked-models-are-a-table-the-superadmin-changes-through-a-function.md) | Tracked models are a table the superadmin changes through a function that records who; an approved crawl request tracks its model; tracking decides where requests and the paid step are spent, never what stays on screen | accepted by delegation (2026-10-03) |
| [0038](0038-model-photos-are-an-address-the-superadmin-gives.md) | A model's photo is an https address the superadmin gives, shown from its own host with the body type's sample as the fallback, never stored | accepted by delegation (2026-10-03) |
| [0040](0040-mileage-in-thousands-read-by-words-then-by-price.md) | Read a mileage typed in thousands by the listing's words first and the asking price second, store the reading, and say so on every screen | accepted by delegation (2026-10-03) |
| [0042](0042-product-copy-voice.md) | Write every string a person reads as a calm, direct expert friend: «شما» with plain standard verbs, one idea per sentence, nothing a buyer cannot check or act on | accepted by delegation (2026-10-04) |
| [0043](0043-search-by-sentence-in-one-step.md) | Search by sentence in one step: a server action reads the sentence by code, the page goes to the canonical address with the sentence kept in it, and the words that would empty the results are left out | accepted by delegation (2026-10-04) |
