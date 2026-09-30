# AGENTS.md — working in the Carshenas repo

Carshenas (کارشناس) is a Farsi, right-to-left used-car search engine for Iran: it collects listings from the sites people already use, normalises the messy listings, estimates each car's market value from comparable listings and rates every listing from «عالی» to «خیلی گران», saying why. It is "Torob for cars", modeled on CarGurus and Autolist (ADR-0006), and it is the owner's answer to Torob's AI Product Engineer challenge (`docs/product/challenge.md`). One developer (Pedrum) builds it AI-first with Claude Code. Code, docs, tasks and commits are in **English**; product copy is **Farsi**.

This file is the map. Read the linked document you need instead of loading everything. Keep this file under 150 lines; details belong in `docs/` and in path-scoped rules under `.claude/rules/`.

## Map

| Where | What | Read when |
|---|---|---|
| `docs/product/vision.md` | Product brief, users, the CarGurus mechanics we clone, what makes it ours, market constraints | Planning anything user-facing |
| `docs/product/challenge.md` | What Torob's challenge asks, what it values, what reviewers will judge, how Carshenas answers Torob's ten search problems, the deliverables | Scoping, the demo, anything submission-related |
| `docs/product/glossary.md` | Canonical Farsi ↔ English domain terms (listing, market value, deal rating, trim, رنگ‌شدگی …) | Naming anything |
| `docs/specs/` | Feature specs (`SNN-slug.md`) with flows, rules, acceptance criteria | Before implementing a spec'd feature |
| `docs/decisions/` | ADRs, binding once accepted (tracker, browser tooling, web stack, structure, styling, product choice, data stack, crawl policy, live index, worker lanes, model provider) | Before proposing an alternative approach |
| `docs/research/` | Cited research notes, including Torob, US analogues, the Iranian market and every listing source's rules | Before re-researching a topic |
| `docs/runbooks/` | Operational how-tos | Running or deploying things |
| `docs/learnings.md` | Dated one-line lessons from finished tasks | Planning similar work |
| `docs/plans/` | Plan-mode output (`plansDirectory`); keep only approved, executed plans | Reviewing how something was built |
| `apps/web/` | The Next.js 16 app. Its own `AGENTS.md` points at the version-matched Next.js docs in `node_modules/next/dist/docs/`. Its rule packs are in `.claude/rules/` (`web-app`, `react`, `ui`, `next-app-router`, `server-actions-data`, `database`, `observability`, `typescript`, `testing`): they attach only when you open a matching file with the Read tool, so read the ones that match before creating files or when you read code with `cat` | Any application work |
| `apps/worker/` | The worker: background jobs on pg-boss outside Next.js; each crawled source runs in its own lane with its requests paced in PostgreSQL (ADR-0018). Jobs are definitions in `src/jobs/` (never importing pg-boss), the runtime is `src/runtime/`; rule pack `worker`; `docs/runbooks/worker.md` | Any crawler or pipeline job |
| `packages/` | Shared runtime packages, TypeScript source that Next.js bundles and Node runs as is. `observability`: logger, redaction, error serialisation, tracing, browser error reporter (ADR-0016). `db`: generated types, the pool factory, constraint violations (ADR-0012). `accounts`: username and password rules, Argon2id, `pnpm account:superadmin` (ADR-0020). `locale`: the fa-IR rules, reading and writing: digits, tomans, counts, percentages, Jalali dates, isolates (ADR-0014). `ai`: every model call, by task name through one registry, to Metis (ADR-0021; `docs/runbooks/ai-layer.md`). `notifications`: every kind of buyer notification and the helper producers write through (ADR-0026; `docs/runbooks/notifications.md`) | Logging, reading logs, error reporting; code the web app and the worker share; any AI step; a new kind of notification |
| `db/` | PostgreSQL 18: SQL migrations (dbmate), the committed `schema.sql`, server settings and the roles bootstrap; `compose.yaml` runs it (`docs/runbooks/local-database.md`) | Any table, migration or query: load the `database` skill first |
| `docs/design/` | Normative design documents: `data-model.md` (the tables that exist and the ones planned, by task) and `design-language.md` (typeface, tokens, type roles, colour pairs, motion; sample page `/design`) | Before adding or changing a table; before building anything a user sees |
| `e2e/` | Playwright: `tests/app` against the real app, `tests/harness` self-tests against the Farsi RTL fixture site (a mock listings page), shared fixtures (console guard, axe, RTL); `e2e/README.md` has every run and debug command | Touching anything a user sees; a browser test fails |
| `tools/site-capture/` | `pnpm capture <url>`: screenshots, design tokens, technology and API map of one reference page, with enforced boundaries. For UI study only; data collection follows ADR-0008 | Studying CarGurus, Autolist or a listing site's interface |
| `backlog/` | The work tracker (Backlog.md): tasks, milestones, drafts, and docs (`doc-1` maps task numbers from before the 2026-09-29 renumbering) | Every session; CLI only, never hand-edit |
| `.claude/` | Skills, subagents, hooks and shared settings for Claude Code | When a workflow step is unclear |
| `.vscode/` | Editor settings that make VS Code report and format what `pnpm check` does; README.md, "Editor setup". Only settings that match a CLI behaviour, each with its reason | Adding or changing an editor setting |

## Work tracking

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.52.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**At the beginning of each conversation in this project, run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

House rules on top of the Backlog.md guides:

- Task IDs are `CS-<n>`; subtasks `CS-<n>.<m>`. Board columns: **To Do → In Progress → In Review → Done**.
- Agents finish at **In Review** with checked acceptance criteria, a final summary and objective evidence. Only a human moves a task to **Done**.
- One task ≈ one focused pull request. Branch per task: `cs-<n>-<slug>`. Commit messages start with the ID: `CS-51: compute market value from comparable listings`. Commit the task's markdown file together with the code it describes.
- Repeat `--ac` once per criterion; a comma inside one `--ac` is not a separator. Criteria describe observable behaviour, not steps.
- Track work that needs planning, decisions or hand-off. Small mechanical edits do not need a task.
- `.claude/hooks/session-start.sh` prints the board at session start; if it is missing, run `backlog task list --plain`.

## Workflow

1. **Orient**: board (from the session hook), then the docs the task links. Search before creating: `backlog search "<term>" --plain`.
2. **Plan**: `/plan <request>` for anything bigger than one PR. It writes a spec when needed and creates tasks with criteria and dependencies. It never implements.
3. **Execute**: `/work CS-<n>`. Research the current code, record the plan on the task, implement in small verified slices, then finalize. Material product, architecture or data-model decisions are presented and approved before code.
4. **Decide and learn**: `/adr <title>` for binding decisions; `/research <question>` for cited investigations. Both link back to the task.
5. **Verify**: acceptance criteria are checked only with evidence (tests, command output, evaluation reports). For anything a user sees, the `ui-design` skill sets the rules (right-to-left, Persian type and digits, touch, states, tokens), its `references/craft.md` lists the small details that make a screen feel right, and `/verify-ui` produces the evidence: a Playwright test in `e2e/` for behaviour, measured numbers (including its `craft-checks.js`), phone and desktop screenshots you actually open and describe, then a fresh-context `design-reviewer` pass. For anything an LLM produces, the evidence is the evaluation run's accuracy on the labelled set. The `task-reviewer` subagent reviews the diff against the criteria before In Review.
6. **Reference sites**: `/capture-site <url>` to study an interface. One polite page view; stop on any robots refusal, block or challenge; never logged-in on your own initiative; learn patterns, never lift assets or copy. Collecting listing **data** is a crawler's job under ADR-0008, never the capture tool's.
7. **Keep context small**: one task per session; `/clear` between tasks; use subagents for broad exploration and let them return summaries, not file dumps.
8. **Compound**: when a task taught something non-obvious that is not visible in code, append one dated line to `docs/learnings.md`. If every future task must respect it, add one line to **Gotchas** below instead. Prune both when they stop preventing mistakes.
9. **Unattended runs**: `/ralph-loop` (official plugin) can iterate `/work` over a milestone's To Do tasks; keep `--max-iterations` small and review the In Review column afterwards.

## Conventions

- **Locale** (ADR-0014): Farsi UI, RTL layout, Persian digits (۰–۹) in the UI through the formatters in `packages/locale` (percentages only through `formatPercent`), Latin digits in data and APIs. Jalali only on screen (`Intl` in `Asia/Tehran`; `@internationalized/date` for calendar arithmetic), ISO-8601/UTC in storage; model years as the listing wrote them, with `model_year_sh` always set. Money is whole tomans in `bigint` `_toman` columns with a range CHECK (tested); prices show in full digits («۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان»), words only inside sentences and on scales.
- **Market**: services and dependencies must work from inside Iran; anything sanctioned or geo-blocked needs an ADR with a fallback. Crawlers run from an Iranian network.
- **Naming**: English identifiers from the glossary (`listing`, `marketValue`, `dealRating`, `trim`, `make`), never transliterated Farsi.
- **Docs**: one topic per file; absolute dates (`2026-09-26`), never "next week"; ADRs are immutable once accepted, supersede instead of editing.
- **Secrets**: never committed; `.env*` is gitignored and unreadable to agents by settings. LLM keys and API credentials live there. The licensed typeface is treated the same way: font files are gitignored and never shared (ADR-0015, `docs/runbooks/licensed-font.md`).
- **Stack**: Next.js 16 and React 19 at `apps/web`, kept bare (ADR-0003). PostgreSQL 18 is the only data service: records, search, vectors and the job queue (ADR-0011); a search engine only if a measured trigger fires, and then OpenSearch or ParadeDB, never Elasticsearch. Kysely on node-postgres, plain SQL migrations with dbmate, types generated from the database (ADR-0012). Authentication, hosting, i18n library and component library stay deferred until their triggers in ADR-0003. Structure and its lint enforcement: ADR-0004. Styling (Tailwind v4, logical utilities only): ADR-0005.
- **Database**: the modeling rules are ADR-0013 and the model is `docs/design/data-model.md`. The database enforces every invariant it can state, with named constraints that code maps to Farsi results; never check-then-insert. Every query on a page or a hot worker path is measured with `EXPLAIN (ANALYZE, BUFFERS)` before it ships. Load the `database` skill, and ask the `database-reviewer` agent to review migrations and new queries.
- **Data sources**: ADR-0008. A source is crawled only after its robots.txt and terms are recorded in the sources research note (read again every 30 days); neither is followed, by the owner's decision for the demo (2026-09-28). Divar is crawled first, through its public web API, then Bama. The index is live and bounded (ADR-0017): list pages cover the Tehran market, tracked models are read in depth, each source has a daily request budget, and pages show facts, analysis and a click-out, never a seller's full description. Stop on any 403, challenge or empty answer; a 429 cools the source's lane down, and a second within a day stops it (ADR-0018). Photos are never downloaded or stored: pages show them from the source's own https addresses, which the parser keeps in `listing_photo` (ADR-0025). Sellers' personal data is not republished.
- **Logging** (ADR-0016): server code logs through `logger` (`src/server/observability/logger.ts`): a constant message, values as fields, never `console` and never personal data; an unexpected error is thrown or passed to `captureError`, never logged and rethrown. A visitor's «کد پیگیری» finds its line; `docs/runbooks/logs-and-errors.md` has the searches and the Sentry and OpenTelemetry steps.
- **AI steps**: context engineering, not magic. Models are reached through Metis AI with one key kept in the environment, using the providers' native routes for structured output (ADR-0019), through the AI SDK's core and provider packages behind the project's own layer, never a string model id (ADR-0021). What a source already structures is parsed by code; the model reads free text. Versioned prompts carry the glossary; outputs follow a strict schema validated in code, with a confidence per field and a review queue below the threshold; results are cached by input hash. Numbers a user sees come from the database, never from model text. No AI step ships without a labelled evaluation set and a reported accuracy (CS-48). Load the `ai-features` skill for any of this, and ask the `ai-reviewer` agent to review an AI change.
- **Craft**: before a screen is called done, walk the sections of `.claude/skills/ui-design/references/craft.md` that apply (motion, layout stability, loading, optimistic updates, touch, visual restraint, Persian type); its code patterns are in `react-patterns/references/ui-craft.md`. Where it disagrees with a vendored guide or a reference site, craft.md wins.
- **Browser tooling**: one Playwright, pinned in `pnpm-workspace.yaml` (ADR-0002). The agent's browser is `npx playwright cli …` from the repo root; never install `@playwright/cli` or `@playwright/mcp` globally and do not add a browser MCP server. Test conventions load from `.claude/rules/e2e.md` when you open `e2e/`.

## Gotchas

One line per mistake an agent actually made here, added when it happens the second time. A line earns its place only if it is non-obvious, repeatedly encountered and specific enough to act on (Zed's rule test); do not pre-fill with generic advice.

- `--ac "a,b"` creates one criterion, not two; repeat the flag (Backlog.md 1.52).
- `backlog milestone create` does not exist; it is `backlog milestone add "<name>"`.
- Backlog list settings (`statuses`, `labels`, `definition_of_done`) are edited in `backlog/config.yml`; `backlog config set` refuses them.
- Backticks inside a double-quoted `backlog` argument are executed by the shell (it ran the test suite into a task summary once). Quote task text with single quotes or `$'...'`; in a session isolated in a lane's worktree, which refuses `$'...'`, `$(…)` and `cd … &&` before `backlog`, use plain double quotes with no backtick or `$` inside.
- A backslash-u escape typed into a Write, Edit or Bash input can reach the file as the literal character (it put invisible bidi marks and no-break spaces into eight files). Build escapes in a script from `chr(92)`; the invisible-character lint catches a slip in `apps/web/src`.
- `pkill -f <pattern>` kills the shell that runs it when the pattern also appears in that command line (it has cost two runs here). Stop servers by port (`ss -ltnpH 'sport = :3000'`, then `kill <pid>`) or by process group.
- Next.js 16 keeps up to three pages you left in the document, hidden, with their state (Activity; `preserving-ui-state.md` in the Next.js docs): an `id` must be unique across pages, a form's answer and typed password come back with the page unless the form is keyed per visit (the accounts forms' `useVisitKey`), and tests find elements by role, which skips the hidden copies. It has bitten CS-3 and CS-39 twice.

## Commands

```bash
backlog board                 # Kanban in the terminal
backlog browser               # web UI on 127.0.0.1:6420
backlog task list --plain     # agent-friendly list; add --status/--labels/--search
backlog task view CS-3 --plain
backlog overview              # counts and metrics
```

```bash
./scripts/init.sh             # fresh clone or worktree: install, browser, .env, PostgreSQL, check, prove the app boots or reuse the running one (--serve keeps it up)
pnpm dev                      # Next.js dev server; a running one is recorded in apps/web/.next/dev/lock, reuse it
pnpm check                    # lint + lint self-test + migration lint + typecheck (app, e2e) + unit and schema tests + formatting: before every commit
pnpm e2e                      # production build + browser tests, phone and desktop (add a file, -g "title", --project=mobile)
E2E_BASE_URL=http://127.0.0.1:3000 pnpm e2e tests/app   # fast loop against the running dev server
pnpm e2e:failed               # only what failed last time; evidence in e2e/test-results/<test>/error-context.md
npx playwright cli open <url> # the agent's browser (see /verify-ui); npx playwright trace open <trace.zip>
pnpm e2e:visual               # screenshot comparisons inside the official container
pnpm gorilla                  # seeded random abuse of every app page; a failure prints its replay command (e2e/README.md)
pnpm capture <url>            # reference-site capture into .captures/ (see /capture-site)
pnpm worker                   # the worker (docs/runbooks/worker.md); worker:dev restarts on changes, worker:health asks it; derive:listings re-derives listings from their snapshots
pnpm account:superadmin <name> # make or promote the superadmin, password shown once (docs/runbooks/accounts.md)
```

```bash
pnpm db:up                    # start PostgreSQL 18 (Docker) and wait until healthy; docs/runbooks/local-database.md; db:roles adds a later role
pnpm db:new <name>            # a migration from the template; then pnpm db:migrate (refreshes db/schema.sql and the types)
pnpm db:check                 # replay migrations up, down, up on a scratch database; schema and type drift; integration tests
pnpm db:psql -c "<sql>"       # read-only psql; EXPLAIN (ANALYZE, BUFFERS) goes here. Also db:top-queries, db:unused-indexes
```

Edited code files are formatted automatically by a PostToolUse hook (Prettier).

## Do not

- Do not edit files under `backlog/` by hand, and do not set a task to Done.
- Do not widen a task's scope silently; ask, then extend the task or create a follow-up.
- Do not re-derive an accepted ADR; propose a superseding one.
- Do not install services, SDKs or SaaS that cannot be reached from Iran without an ADR.
- Do not weaken, skip or delete a test assertion or an evaluation case, add retries or raise a timeout to get green. Fix the cause or ask.
- Do not crawl a source whose robots.txt and terms are not recorded, and do not work around a site's block or bot challenge (ADR-0008), Divar's included. Do not use logged-in capture unless the human asked for that site.
- Do not show a user a number a model generated, and do not ship an AI step without its evaluation.
- Do not let this file grow into a manual. Link, do not paste.
- Do not keep automation nobody uses: a skill, hook or agent that has not been invoked in a month is deleted, not maintained.
