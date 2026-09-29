---
id: doc-1
title: Task renumbering of 2026-09-29
type: other
created_date: '2026-09-28 21:30'
updated_date: '2026-09-28 22:13'
---
# Task renumbering of 2026-09-29

On 2026-09-29 the owner asked for the open tasks to be numbered in the order they will be done, so that work goes one number at a time: CS-32, then CS-33, and so on to CS-77. The owner's product plan of the same day added ten tasks to that order:
- accounts;
- worker observability;
- body-type icons;
- shared filters and catalogues;
- the home page;
- the inbox;
- marked listings;
- search files;
- crawl requests;
- proactive matching.

The owner then added the AI foundation, before any task that calls a model (CS-42 to CS-47):
- Metis AI;
- research on prompting and agents;
- the choice of the AI layer;
- the layer itself;
- a model for each step;
- the Claude Code skill, rules and reviewer for AI features.

The backlog CLI cannot change an ID, so each open task was recreated under its new number with the same content. Its references to other open tasks were rewritten, and «ad» became «listing», the glossary's term.

- **The old copies:**
  - Tasks committed before (CS-6 to CS-25 and CS-29) are archived. Each ends with "continued as CS-n".
  - Tasks first created on 2026-09-28 were never committed, and took their final numbers directly.
- **Done tasks** (CS-1 to CS-5, CS-26 to CS-28, CS-30, CS-31) keep their numbers.
- **What was updated:** the living documents — AGENTS.md, README, the data model, the product documents, ADR-0017, the two research notes of 2026-09-28, the runbooks, the Claude rules and skills, and comments in code and configuration.
- **What still uses the old numbers:**
  - applied migrations, and the generated `db/schema.sql` and `db-types.ts`;
  - ADR-0001 to ADR-0016;
  - done tasks;
  - research notes before 2026-09-28;
  - git history.

  Read an old number through this table.

| Old | Now | Title |
|---|---|---|
| CS-6 | CS-33 | Crawl Divar listings into raw snapshots |
| CS-21 | CS-36 | Create the GitHub repository and push main |
| CS-23 | CS-37 | Deploy the database, the worker and the web app on an Iranian server |
| CS-22 | CS-38 | Set up CI to run lint, typecheck and tests on every push |
| CS-9 | CS-48 | Hand-labelled evaluation set and extraction evaluation harness |
| CS-10 | CS-50 | Canonical make, model and trim catalogue and name matching |
| CS-12 | CS-51 | Market value from comparable listings and deal ratings |
| CS-8 | CS-52 | Extract condition and price facts from listing text with an LLM and the domain glossary |
| CS-7 | CS-54 | Add Bama as the second source |
| CS-11 | CS-55 | Cross-site duplicate detection |
| CS-25 | CS-56 | Teardown of CarGurus, Autolist and Jabama: home, search, listing and valuation pages |
| CS-14 | CS-59 | PostgreSQL listing search and search API |
| CS-29 | CS-60 | Decide on listing photos, and store any allowed ones in ArvanCloud Object Storage |
| CS-16 | CS-61 | Search page: every crawled listing, curated filters and catalogues, best deals first |
| CS-15 | CS-62 | Plain-Farsi search into structured filters |
| CS-17 | CS-64 | Listing page: market-value gauge, comparables, explanation and also-listed-on |
| CS-19 | CS-65 | Paste a listing link for an instant deal rating |
| CS-18 | CS-67 | Model page with market price trend |
| CS-13 | CS-74 | Benchmark market value against published price tables |
| CS-24 | CS-75 | Record the five-minute demo and submit the application |
| CS-20 | CS-76 | Notifications outside the site: a Bale or Telegram bot |
