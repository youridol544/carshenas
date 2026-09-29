# Carshenas (کارشناس)

An appraiser's opinion on every used-car listing in Iran. Carshenas collects listings from the sites people already use, turns messy free-text listings into structured records, estimates each car's market value from comparable listings, and rates every listing from «معامله‌ی عالی» to «خیلی گران», with the reason in plain Farsi. It is "Torob for cars", modeled on CarGurus and Autolist, built AI-first by one developer with Claude Code as an answer to Torob's AI Product Engineer challenge.

- Product brief: [`docs/product/vision.md`](docs/product/vision.md) · the challenge: [`docs/product/challenge.md`](docs/product/challenge.md) · glossary: [`docs/product/glossary.md`](docs/product/glossary.md)
- How the repo is organised and how agents work here: [`AGENTS.md`](AGENTS.md)
- Decisions: [`docs/decisions/`](docs/decisions/) · research: [`docs/research/`](docs/research/) · specs: [`docs/specs/`](docs/specs/)

**The name:** کارشناس means expert or appraiser, and «کارشناسی» is the inspection-and-valuation a careful buyer pays for before buying a used car. Read in English it is *car* + *shenas*, "one who knows cars".

## How it works

```
Divar · Bama ──discover newest first · sweep list pages · re-check within a daily budget (ADR-0008, ADR-0017)──▶ raw snapshots
   ──structured fields parsed by code · free text read by an LLM with the domain glossary (evaluated)──▶ listings
   ──canonical make / model / trim──▶ cross-site duplicate groups
   ──comparable listings──▶ daily market value ──▶ deal rating (عالی … خیلی گران)
   ──PostgreSQL full-text search──▶ search, listing and model pages, paste-a-link, data status
```

Why used cars, why CarGurus, and what makes it more than a clone: [ADR-0006](docs/decisions/0006-used-cars-modeled-on-cargurus.md) and the research notes dated 2026-09-26. Everything lives in PostgreSQL 18: records, search, vectors and the job queue ([ADR-0011](docs/decisions/0011-postgresql-for-records-search-vectors-and-jobs.md)), reached through Kysely with plain SQL migrations ([ADR-0012](docs/decisions/0012-kysely-and-sql-migrations.md)) and modelled by the rules of [ADR-0013](docs/decisions/0013-data-modeling-rules.md) in [`docs/design/data-model.md`](docs/design/data-model.md). The crawl policy ([ADR-0008](docs/decisions/0008-crawl-only-what-sources-allow.md)) was accepted on 2026-09-28. The index is live and bounded: the Tehran market is read shallowly, the models a superadmin tracks are read in depth, each source has a daily request budget, and frozen releases feed the evaluations and the recorded demo ([ADR-0017](docs/decisions/0017-live-bounded-replayable-listing-index.md)). The web app, the crawler worker and the owner's superadmin section are all TypeScript on the same database.

## Roadmap

| Milestone | What it delivers |
|---|---|
| m-0 Foundation | The AI-first workflow, the app shell and its quality harness (CS-1) |
| m-1 Foundations | Money and dates, UI foundations, the data stack running locally, source terms recorded, a CarGurus and Autolist teardown |
| m-2 Ingestion | The worker and the superadmin section; the Divar crawler, then Bama; freshness within a daily request budget |
| m-3 Normalisation and evals | Parsing by code, LLM extraction, a hand-labelled evaluation set, canonical trims, tracked models, duplicate detection, frozen releases |
| m-4 Market value and deal ratings | Market value from comparables, deal ratings, benchmarks against published price tables, ratings checked against what the market did next |
| m-5 Search and listing experience | Search, plain-Farsi search, results, listing and model pages, paste-a-link, the data-status page |
| m-6 Demo and submission | Repository, CI, an unlisted deployment reachable from Iran, the five-minute demo |
| m-7 After the demo | Price-drop alerts; Karnameh, Khodro45 and Sheypoor |

`backlog board` shows the tasks behind each milestone.

## Quick start

Needs Node 22+, pnpm 10 (`corepack enable`), [Bun](https://bun.sh) for the Backlog.md CLI, and Docker for the local PostgreSQL and the screenshot comparisons.

```bash
bun add -g backlog.md        # once per machine: the task tracker's CLI
./scripts/init.sh            # install, the pinned Chromium, .env, PostgreSQL and its migrations, every check, then prove the app boots and serves a right-to-left page
./scripts/init.sh --serve    # the same, then keep the dev server running on http://localhost:3000
pnpm dev                     # only the dev server on http://localhost:3000
```

`init.sh` is safe to re-run, and it reuses a dev server that is already running: Next.js allows one per app and records it in `apps/web/.next/dev/lock`. If browser downloads stall, set `PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright`. Next.js collects anonymous telemetry unless `NEXT_TELEMETRY_DISABLED=1` is set or `pnpm --filter @carshenas/web exec next telemetry disable` has been run.

## Editor setup (VS Code)

With the settings in [`.vscode/`](.vscode/settings.json), VS Code reports what `pnpm check` reports, no more and no fewer, and saving a file formats it the way `pnpm format` does. Files Prettier ignores, Markdown and `backlog/` among them, are saved exactly as typed.

1. Run `./scripts/init.sh` first. It installs the TypeScript, ESLint and Prettier the editor runs and generates the Next.js route types.
2. Open the repository folder itself: `code .` from the root, or File → Open Folder. Some of the settings, such as which TypeScript runs, apply only in the folder's own window, not in a workspace that holds it.
3. Install the extensions VS Code recommends: ESLint, Prettier and Tailwind CSS IntelliSense.
4. When VS Code asks whether to use the workspace's TypeScript version, choose **Allow** (later: TypeScript: Select TypeScript Version → Use Workspace Version). The TypeScript version in the status bar then comes from `apps/web/node_modules`, the one `pnpm typecheck` runs, and the Next.js TypeScript plugin loads.

In a window shared with other projects (a multi-root workspace), copy `typescript.tsdk`, `typescript.enablePromptUseWorkspaceTsdk`, `files.associations` and `prettier.documentSelectors` from `.vscode/settings.json` into the workspace file's settings: VS Code reads those four from the workspace, not from a folder, so without them the stylesheet shows Tailwind's at-rules as unknown and VS Code's bundled TypeScript runs. The rest applies as it is. One TypeScript server serves every folder in such a window, so the other projects use this TypeScript too.

When the editor and `pnpm check` disagree, `pnpm check` is right, and the editor usually holds something stale. After `pnpm install`, a branch switch, `pnpm db:migrate` or a new route (`pnpm typecheck`, or a running `pnpm dev`, regenerates the route types), run TypeScript: Restart TS Server and ESLint: Restart ESLint Server, or Developer: Reload Window. A problem that is still there and that `pnpm check` does not report means this setup is wrong: record it as a task.

## What is where

| Path | What |
|---|---|
| `apps/web/` | The Next.js 16 and React 19 app: Farsi, right to left, Tailwind CSS v4, no auth or hosting yet, on purpose ([ADR-0003](docs/decisions/0003-bare-minimum-nextjs-16-and-react-19.md)); its data layer is `src/server/db` (Kysely), and `GET /api/health` proves it reaches PostgreSQL. Lint enforces its structure ([ADR-0004](docs/decisions/0004-frontend-structure-and-enforcement.md)) and its logical, direction-safe styling ([ADR-0005](docs/decisions/0005-styling-and-component-primitives.md)). |
| `apps/worker/` | The worker: background jobs on pg-boss outside Next.js, each crawled source in its own lane, one request at a time and paced in PostgreSQL, with cool-downs and stops on refusals ([ADR-0018](docs/decisions/0018-source-lanes-request-pacing-and-rate-limits.md)); `pnpm worker`, `pnpm worker:health`. [`docs/runbooks/worker.md`](docs/runbooks/worker.md) |
| `packages/` | Code the web app and the worker share: `observability` (logs, errors, traces; [ADR-0016](docs/decisions/0016-structured-logs-and-error-reporting.md)), `db` (generated types, the pool factory, constraint violations) and `locale` (the locale constants, digits, the toman brand and bound, reading written amounts and Solar Hijri dates; [ADR-0014](docs/decisions/0014-money-in-toman-and-jalali-in-the-interface.md)). |
| `db/`, `compose.yaml` | PostgreSQL 18 with pgvector in Docker: SQL migrations (dbmate), the committed `schema.sql`, server settings and the roles bootstrap. [`docs/runbooks/local-database.md`](docs/runbooks/local-database.md) |
| `e2e/` | Playwright: `tests/app` against the real app, `tests/harness` against the fixture site (a mock used-car listings page in `e2e/site/`, served by `pnpm fixture` on port 4173), `tests/chaos` and `gorilla/` for gorilla testing. [`e2e/README.md`](e2e/README.md) |
| `tools/site-capture/` | `pnpm capture`: screenshots, design tokens, stack and API map of a reference page. [`tools/site-capture/README.md`](tools/site-capture/README.md) |
| `docs/` | Product brief, challenge and glossary; decisions; research; specs; runbooks; approved plans; dated learnings in `learnings.md` |
| `backlog/` | Tasks and milestones, changed only through the Backlog.md CLI |
| `.claude/` | Claude Code settings, hooks, skills, subagents and path-scoped rules |
| `.github/workflows/` | CI: the browser suite and gorilla on pushes and pull requests, a nightly gorilla |
| `scripts/init.sh`, `scripts/db.sh` | One-command setup and health check; the local database commands behind `pnpm db:*` |

## Checks, and what each one proves

| Command | What it does | When |
|---|---|---|
| `pnpm check` | ESLint with zero warnings; the lint self-test (the planted samples in `apps/web/eslint/samples/` must trip their rules, or lint clean, and every package's config files must lint clean with all packages in one process, as VS Code lints them); Squawk on every migration; the database guard hook's tests; typecheck of the app and the tests; Vitest unit tests and the schema tests (PostgreSQL 18 in PGlite: constraints and naming, key, type and index conventions); Prettier | Before every commit |
| `pnpm db:check` | On a scratch database in the local PostgreSQL: every migration up, down and up again, the schema compared with `db/schema.sql`, the generated types verified, and the integration tests against the real server | After changing a migration or a query |
| `pnpm e2e` | A production build, then the browser suite on phone and desktop: every app page right to left, without sideways overflow, clean under axe, at every width from 320 to 1920 px, with long Farsi text, a doubled font size, a slow network, failed scripts and a keyboard walk; plus the harness's self-tests | Before finishing a task |
| `E2E_BASE_URL=http://127.0.0.1:3000 pnpm e2e tests/app --project=mobile` | The app tests against the running dev server, without a build | While iterating |
| `pnpm e2e:failed` · `pnpm e2e:ui` | Only what failed last time, with the evidence in `e2e/test-results/<test>/error-context.md` · watch mode with time travel | Debugging |
| `pnpm e2e:visual` | Screenshot comparisons inside the official Playwright container (Docker) | When the app's or the fixture's look changes |
| `pnpm gorilla` | Seeded random abuse of every app page ([below](#gorilla-testing)) | Before finishing UI work; CI runs it on every pull request |
| `pnpm capture:test` | The capture tool's own tests: redaction, robots.txt, bot challenges, flows | When changing `tools/site-capture/` |
| `pnpm skills:sync` | Regenerates the `playwright-cli` and `playwright-trace` skills from the installed Playwright | After upgrading Playwright |

[`e2e/README.md`](e2e/README.md) has everything else about browser tests, including debugging a failure and reading a trace from the terminal.

## Gorilla testing

Scripted tests walk the paths someone thought of; the gorilla walks the rest. On every page listed in `e2e/fixtures/app-pages.ts` it taps, double-taps, types hostile Persian strings (digits in three scripts, zero-width non-joiners, Arabic yeh and kaf, bidi controls, very long words), presses keys, scrolls, resizes and goes back and forward, in a random but seeded order. After every run its oracles check for uncaught exceptions, console errors, failed requests, native dialogs, sideways overflow, garbage text (`NaN`, `undefined`, `Invalid Date` …), an error screen, an empty page, broken images, lost focus, main-thread stalls over one second, and axe violations.

```bash
pnpm gorilla                                            # every app page, random seed, phone, 60 s each (builds and starts the app)
pnpm gorilla --seed 20260921 --runs 40 --project both   # a fixed seed and run count on phone and desktop, as CI runs it
pnpm gorilla / --scope main --budget 120                # one page, only the controls inside <main>, two minutes
pnpm gorilla '/' --seed 42 --actions 30 --path '7:1:0'  # replay a failure exactly as the report printed it
pnpm gorilla --selfcheck                                # prove the oracles: each of the lab page's eight planted defects must be caught and replayed
```

The seed is printed first, so any run can be repeated. A finding is shrunk to the shortest action sequence that still fails, replayed once to prove it, and reported with the problems, the sequence and the replay command; `e2e/test-results/` keeps the action log and a trace of the replay. The gorilla never presses controls named like delete, pay or sign out (`DEFAULT_DENY` in `e2e/gorilla/actions.ts`) and never leaves the app's origin. Fix a finding in the product, then keep it as a scripted test in `e2e/tests/app/`. A new page goes into `e2e/fixtures/app-pages.ts` in the same change, so that the gorilla and the layout stress matrix cover it.

## Reference-site capture

`pnpm capture <url>` turns one public page into reference material for design work: screenshots at phone and desktop widths (first view, full page, readable tiles, cropped components), the accessibility tree, the design tokens the page actually uses, the technology behind it with the evidence for each finding, and the API it calls as endpoint patterns and JSON shapes, with every value redacted. A `--flow` script clicks through the page and photographs each step.

```bash
pnpm capture https://www.cargurus.com/ --name cargurus-home          # into .captures/cargurus-home/<timestamp>/ (gitignored); read summary.md first
pnpm capture <results-page-url> --name cargurus-search --flow my-flow.mjs   # plus one screenshot per step of the flow
```

The tool enforces its boundaries instead of trusting the caller. It makes one polite page view per viewport. It obeys robots.txt, inside flows too: CarGurus disallows its listing pages, so those are studied by hand. On a 403, a 429 or any sign of a bot challenge, including one that appears after the page has loaded, it stops and does not retry. Logged-in capture needs `--own-account`. Reports keep measurements and patterns, never a site's assets or copy. In Claude Code, `/capture-site <url>` runs the tool and turns the result into a teardown note. Collecting listing data is a crawler's job under [ADR-0008](docs/decisions/0008-crawl-only-what-sources-allow.md), never this tool's.

## Working with Claude Code

Start `claude` in the repo root. The session begins with the board in context. Then:

| Want to… | Do |
|---|---|
| Scope a feature into tasks | `/plan <feature>` |
| Execute a task | `/work CS-<n>` |
| Record a decision | `/adr <title>` |
| Investigate before deciding | `/research <question>` |
| Check UI work in a real browser | `/verify-ui` |
| Study a reference site's interface | `/capture-site <url>` |
| Grind through a milestone unattended | `/ralph-loop "For each To Do task in milestone m-1, run /work on it, one task per iteration" --max-iterations 10` |

Also in [`.claude/`](.claude/):

- **Skills that load on demand:** `ui-design`, the Farsi right-to-left interface rules; `react-patterns`, before-and-after examples for React 19 and Next.js 16; and `database`, PostgreSQL modeling, migrations, queries, indexing and measurement. `playwright-cli` and `playwright-trace` are generated from the installed Playwright. [`.claude/skills/README.md`](.claude/skills/README.md) lists every skill with its origin and licence.
- **Read-only subagents:** `task-reviewer` checks a task against its acceptance criteria. `design-reviewer` scores a screen against the interface rules with measurements. `database-reviewer` reviews migrations and queries with their replay and query plans. `project-manager-backlog` grooms tasks.
- **Rules:** path-scoped rule packs in `.claude/rules/` that attach when a matching file is opened.
- **Hooks:** a `SessionStart` hook puts the board in context, a `PreToolUse` hook refuses commands that would destroy database data, and a `PostToolUse` hook runs Prettier on every edited file.

Personal overrides go in `.claude/settings.local.json` (gitignored).

## Work tracking (in the repo)

Tasks live as markdown in [`backlog/`](backlog/) and are managed with [Backlog.md](https://github.com/MrLesk/Backlog.md). See [ADR-0001](docs/decisions/0001-backlog-md-for-in-repo-task-tracking.md).

```bash
backlog board                    # Kanban board in the terminal
backlog browser                  # web UI on http://127.0.0.1:6420
backlog task list --plain        # plain list (what agents use)
backlog task view CS-3 --plain   # one task
```

Columns: **To Do → In Progress → In Review → Done**. Agents stop at In Review; a human moves work to Done.

## CI

[`e2e.yml`](.github/workflows/e2e.yml) runs on pushes to `main` and on pull requests, inside the official Playwright container. It typechecks the tests, runs `pnpm e2e` on phone, desktop and iPhone (WebKit) with the screenshot comparisons, and runs a gorilla job: the self-check, then a fixed seed on phone and desktop. [`gorilla-nightly.yml`](.github/workflows/gorilla-nightly.yml) runs a longer gorilla with a new random seed every night at 02:00 Tehran time, or on demand with a chosen seed, page and budget. Both upload their reports and traces. They start running once the repository is on GitHub (CS-36); lint, typecheck and unit tests join CI in CS-38.

## Status

The repository foundation (CS-1): the bare application shell with its quality harness (lint, unit, end-to-end, visual and gorilla tests), the reference-site capture tool, the AI-first workflow, and the research and decisions behind the product. The data foundation (CS-4): PostgreSQL 18 in Docker with the first migrations (sources and their policy checks, listings, crawl runs, the fetch log and snapshots), the Kysely data layer, the health check, and the database harness (a skill, a rule, a reviewer, a guard hook, and checks for migrations, schema and queries). There are no product features yet; `docs/` and `backlog/` say what comes next and why.
