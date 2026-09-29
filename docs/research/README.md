# Research notes

Executed investigations that inform decisions. One topic per file, named `YYYY-MM-DD-kebab-slug.md`. The `/research` skill adds a row to the index when it writes a note.

## Index

| Note | Question | Outcome |
|---|---|---|
| [2026-09-17 AI-first task management](2026-09-17-ai-first-task-management.md) | How to run project management inside the repo when building AI-first | ADR-0001: Backlog.md in the repo |
| [2026-09-17 Playwright with coding agents](2026-09-17-playwright-with-coding-agents.md) | Browser verification, end-to-end tests, CI and reference-site capture | ADR-0002; `e2e/`, `tools/site-capture/`, the `verify-ui` and `capture-site` skills |
| [2026-09-18 Next.js project structure](2026-09-18-nextjs-project-structure.md) | Project structure and frontend architecture for Next.js 16 App Router | ADR-0004 (proposed) |
| [2026-09-18 Styling and component primitives](2026-09-18-styling-system-and-component-primitives.md) | Styling system and primitives for a Farsi right-to-left app | ADR-0005 (proposed) |
| [2026-09-18 UI/UX design for agents](2026-09-18-ui-ux-design-for-agents.md) | Design knowledge and tooling for Claude Code on a right-to-left product | The `ui-design` skill, the `ui.md` rule, the `design-reviewer` agent |
| [2026-09-21 Gorilla testing](2026-09-21-gorilla-testing-with-playwright.md) | Gorilla, monkey and model-based testing on the Playwright harness | `pnpm gorilla`, the lab self-check, the layout stress matrix, CI and nightly runs |
| [2026-09-21 React 19 and Next.js 16 knowledge](2026-09-21-react-19-nextjs-16-knowledge-for-agents.md) | What makes agents write standard, performant React and Next.js code | The lint stack and its self-test, five rule packs, the `react-patterns` skill |
| [2026-09-26 Torob's product and playbook](2026-09-26-torob-product-and-playbook.md) | What Torob does and which mechanics "Torob for X" must reproduce | The five-step playbook behind the product brief and the milestones |
| [2026-09-26 US vertical search analogues](2026-09-26-us-vertical-search-analogs.md) | Which US startup is the exact product match, vertical by vertical | CarGurus, with Autolist (ADR-0006) |
| [2026-09-26 Iran vertical market landscape](2026-09-26-iran-vertical-market-landscape.md) | Where a Torob-style engine is most valuable and feasible to build in a week | Used cars; villas are the fallback (ADR-0006) |
| [2026-09-26 Car listing sources and crawl policy](2026-09-26-car-listing-sources-and-crawl-policy.md) | Which used-car sources Carshenas can read, and under what rules | ADR-0008 (accepted 2026-09-28): each source's robots.txt and terms recorded, neither followed, by the owner's decision for the demo; Divar's car endpoints confirmed; evidence folder with verbatim robots.txt and quoted terms (CS-5) |
| [2026-09-26 UI craft details](2026-09-26-ui-craft-details.md) | Which small interface details make a product feel good, who says so, and how they apply to a Farsi RTL phone-first app | The `ui-design` craft checklist and its wiring into rules, lint, review and browser checks (CS-26); appendix with six passes and a font lab |
| [2026-09-27 PostgreSQL-only data stack](2026-09-27-postgresql-only-data-stack.md) | Can PostgreSQL alone serve records, Persian search, vectors and the job queue, and which access layer, migration tool and queue win | ADR-0011 (PostgreSQL 18 only, superseding ADR-0007), ADR-0012 (Kysely, dbmate, kysely-codegen, Squawk), pg-boss; the triggers for ever adding a search engine (CS-4); appendix with six passes and lab SQL |
| [2026-09-27 Database craft](2026-09-27-database-craft.md) | Where checks live, inserts against pre-checks, when to index, how to measure, pgvector, modeling lessons, a model ready for native listings, and how to keep Claude Code to it | ADR-0013, the `database` skill, the `database.md` rule, the `database-reviewer` agent and the schema, lint and migration checks (CS-4) |
| [2026-09-27 Money and the Jalali calendar](2026-09-27-money-and-jalali-calendar.md) | How to store and show toman amounts the way Iranian car buyers read them, and which Jalali calendar is correct and maintained well enough for production and future visit booking | ADR-0014 (proposed); the amount-column check in the schema tests; a lab that pins every Jalali implementation against the astronomical calendar (CS-2) |
| [2026-09-27 Persian typeface](2026-09-27-persian-typeface.md) | Which commercial Persian typeface to buy from Fontiran, what its licence allows, how it measures and how it loads | Yekan Bakh 4, bought by the owner; ADR-0015 (proposed); the type roles in `docs/design/design-language.md`; the licensed-font runbook; a layout-shift lab (CS-3) |
| [2026-09-27 RTL and locale architecture](2026-09-27-rtl-and-locale-architecture.md) | The cleanest standard way to build a one-locale, right-to-left Next.js 16 and React 19 app: direction providers, formatters, hydration, bidi isolation, fonts | `apps/web/src/lib/` locale, number, money, date, digit and bidi modules with their tests; corrections to the `ui-design` references (CS-3) |
| [2026-09-28 Production logging and error reporting](2026-09-28-production-logging-and-error-reporting.md) | How to log and report errors in a Next.js 16 app and a Node.js worker so a bug's root cause is found in seconds, with no vendor now and Sentry or OpenTelemetry later | ADR-0016 (proposed); `packages/observability` and its web-app wiring, the logs runbook, the `observability.md` rule pack (CS-30) |
| [2026-09-28 Torob challenge: expectations and the field](2026-09-28-torob-challenge-expectations-and-field.md) | What Torob's reviewers will judge, what other entrants built, and where Carshenas can win | The reviewers' checklist and the map of Torob's ten search problems in `docs/product/challenge.md`; the demo plan on CS-75 |
| [2026-09-28 Listing data and freshness](2026-09-28-listing-data-and-freshness.md) | Live crawler, crawled sample or query-time search of the sources, and how a live index stays fresh within ADR-0008's limits | ADR-0017 (a live, bounded index within a request budget, tracked models, frozen releases); tasks CS-34, CS-35, CS-49, CS-53, CS-66 and CS-73 |
| [2026-09-29 Crawl scheduling, rate limits and backoff](2026-09-29-crawl-scheduling-rate-limits-and-backoff.md) | How the worker schedules crawl jobs per source, paces requests to each host and backs off, so sources run in parallel and no job waits on a rate limit | ADR-0018: one pg-boss singleton lane per source, pacing in PostgreSQL, failures retried at one layer, 429 cools down before it stops; built in CS-32 |
| [2026-09-29 Metis AI](2026-09-29-metis-ai.md) | Which models Metis AI serves, through which API, at what price and under what terms, and whether it works from Iran | ADR-0019 (proposed): Metis's native routes for structured output, the key in the environment only, a fallback when it is down. A lab and evidence folder: 42 of 42 answers from Iran valid against one JSON Schema, eight route and model combinations, the three official SDKs working unchanged, and jev unavailable because Metis's TypeSafe credits were empty (CS-42) |

Template (queries first, findings later, so the note is useful even half-finished):

```markdown
# <Question being answered>

- Date: YYYY-MM-DD
- Asked by / for: task CS-..., or "exploratory"
- Outcome: (fill in last) decision taken / ADR written / no action

## Questions
1. ...

## Sources
- <URL> — who, when, why credible

## Findings
...

## Recommendation
...
```

Write the note with the `/research` skill. Findings must cite sources; mark anything unverified as such.
