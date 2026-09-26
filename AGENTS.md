# AGENTS.md — working in the Carshenas repo

Carshenas (کارشناس) is a Farsi, right-to-left used-car search engine for Iran: it collects listings from the sites people already use, normalises the messy ads, estimates each car's market value from comparable listings and rates every listing from «عالی» to «خیلی گران», saying why. It is "Torob for cars", modeled on CarGurus and Autolist (ADR-0006), and it is the owner's answer to Torob's AI Product Engineer challenge (`docs/product/challenge.md`). One developer (Pedrum) builds it AI-first with Claude Code. Code, docs, tasks and commits are in **English**; product copy is **Farsi**.

This file is the map. Read the linked document you need instead of loading everything. Keep this file under 150 lines; details belong in `docs/` and in path-scoped rules under `.claude/rules/`.

## Map

| Where | What | Read when |
|---|---|---|
| `docs/product/vision.md` | Product brief, users, the CarGurus mechanics we clone, what makes it ours, market constraints | Planning anything user-facing |
| `docs/product/challenge.md` | What Torob's challenge asks, what it values, the deliverables | Scoping, the demo, anything submission-related |
| `docs/product/glossary.md` | Canonical Farsi ↔ English domain terms (listing, market value, deal rating, trim, رنگ‌شدگی …) | Naming anything |
| `docs/specs/` | Feature specs (`SNN-slug.md`) with flows, rules, acceptance criteria | Before implementing a spec'd feature |
| `docs/decisions/` | ADRs, binding once accepted (tracker, browser tooling, web stack, structure, styling, product choice, data stack, crawl policy) | Before proposing an alternative approach |
| `docs/research/` | Cited research notes, including Torob, US analogues, the Iranian market and every listing source's rules | Before re-researching a topic |
| `docs/runbooks/` | Operational how-tos | Running or deploying things |
| `docs/learnings.md` | Dated one-line lessons from finished tasks | Planning similar work |
| `docs/plans/` | Plan-mode output (`plansDirectory`); keep only approved, executed plans | Reviewing how something was built |
| `apps/web/` | The Next.js 16 app. Its own `AGENTS.md` points at the version-matched Next.js docs in `node_modules/next/dist/docs/`. Its rule packs are in `.claude/rules/` (`web-app`, `react`, `ui`, `next-app-router`, `server-actions-data`, `typescript`, `testing`): they attach only when you open a matching file with the Read tool, so read the ones that match before creating files or when you read code with `cat` | Any application work |
| `e2e/` | Playwright: `tests/app` against the real app, `tests/harness` self-tests against the Farsi RTL fixture site (a mock listings page), shared fixtures (console guard, axe, RTL); `e2e/README.md` has every run and debug command | Touching anything a user sees; a browser test fails |
| `tools/site-capture/` | `pnpm capture <url>`: screenshots, design tokens, technology and API map of one reference page, with enforced boundaries. For UI study only; data collection follows ADR-0008 | Studying CarGurus, Autolist or a listing site's interface |
| `backlog/` | The work tracker (Backlog.md): tasks, milestones, drafts | Every session; CLI only, never hand-edit |
| `.claude/` | Skills, subagents, hooks and shared settings for Claude Code | When a workflow step is unclear |

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
- One task ≈ one focused pull request. Branch per task: `cs-<n>-<slug>`. Commit messages start with the ID: `CS-12: compute market value from comparable listings`. Commit the task's markdown file together with the code it describes.
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

- **Locale**: Farsi UI, RTL layout, Persian digits (۰–۹) in the UI, Latin digits in data and APIs. Jalali calendar for display, ISO-8601/UTC in storage; model years are stored in both calendars explicitly. Money as integers, never floats (unit decided in CS-2); car prices run to billions of toman, so large amounts get a readable form.
- **Market**: services and dependencies must work from inside Iran; anything sanctioned or geo-blocked needs an ADR with a fallback. Crawlers run from an Iranian network.
- **Naming**: English identifiers from the glossary (`listing`, `marketValue`, `dealRating`, `trim`, `make`), never transliterated Farsi.
- **Docs**: one topic per file; absolute dates (`2026-09-26`), never "next week"; ADRs are immutable once accepted, supersede instead of editing.
- **Secrets**: never committed; `.env*` is gitignored and unreadable to agents by settings. LLM keys and API credentials live there.
- **Stack**: Next.js 16 and React 19 at `apps/web`, kept bare (ADR-0003). The data, search and ingestion stack (PostgreSQL, Elasticsearch, a worker with a job queue, LLM steps) is ADR-0007, **proposed**: install nothing from it until CS-4 accepts it. Authentication, hosting, i18n library and component library stay deferred until their triggers in ADR-0003. Structure and its lint enforcement: ADR-0004. Styling (Tailwind v4, logical utilities only): ADR-0005.
- **Data sources**: ADR-0008 (proposed). A source is crawled only after its robots.txt and terms are recorded; Divar is never crawled (single pasted links go through its official Kenar API); stop on any 403, 429 or challenge; photos a source allows are stored in ArvanCloud Object Storage and shown from there (ADR-0010), never hotlinked; sellers' personal data is not republished.
- **AI steps**: context engineering, not magic. Versioned prompts carry the glossary; outputs follow a strict schema validated in code, with a confidence per field and a review queue below the threshold; results are cached by input hash. Numbers a user sees come from the database, never from model text. No AI step ships without a labelled evaluation set and a reported accuracy (CS-9).
- **Craft**: before a screen is called done, walk the sections of `.claude/skills/ui-design/references/craft.md` that apply (motion, layout stability, loading, optimistic updates, touch, visual restraint, Persian type); its code patterns are in `react-patterns/references/ui-craft.md`. Where it disagrees with a vendored guide or a reference site, craft.md wins.
- **Browser tooling**: one Playwright, pinned in `pnpm-workspace.yaml` (ADR-0002). The agent's browser is `npx playwright cli …` from the repo root; never install `@playwright/cli` or `@playwright/mcp` globally and do not add a browser MCP server. Test conventions load from `.claude/rules/e2e.md` when you open `e2e/`.

## Gotchas

One line per mistake an agent actually made here, added when it happens the second time. A line earns its place only if it is non-obvious, repeatedly encountered and specific enough to act on (Zed's rule test); do not pre-fill with generic advice.

- `--ac "a,b"` creates one criterion, not two; repeat the flag (Backlog.md 1.52).
- `backlog milestone create` does not exist; it is `backlog milestone add "<name>"`.
- Backlog list settings (`statuses`, `labels`, `definition_of_done`) are edited in `backlog/config.yml`; `backlog config set` refuses them.
- Backticks inside a double-quoted `backlog` argument are executed by the shell (it ran the test suite into a task summary once). Quote task text with single quotes or `$'...'`.
- `pkill -f <pattern>` kills the shell that runs it when the pattern also appears in that command line (it has cost two runs here). Stop servers by port (`ss -ltnpH 'sport = :3000'`, then `kill <pid>`) or by process group.

## Commands

```bash
backlog board                 # Kanban in the terminal
backlog browser               # web UI on 127.0.0.1:6420
backlog task list --plain     # agent-friendly list; add --status/--labels/--search
backlog task view CS-3 --plain
backlog overview              # counts and metrics
```

```bash
./scripts/init.sh             # fresh clone or worktree: install, browser, check, prove the app boots or reuse the running one (--serve keeps it up)
pnpm dev                      # Next.js dev server; a running one is recorded in apps/web/.next/dev/lock, reuse it
pnpm check                    # lint + lint self-test + typecheck (app, e2e) + unit tests + formatting: before every commit
pnpm e2e                      # production build + browser tests, phone and desktop (add a file, -g "title", --project=mobile)
E2E_BASE_URL=http://127.0.0.1:3000 pnpm e2e tests/app   # fast loop against the running dev server
pnpm e2e:failed               # only what failed last time; evidence in e2e/test-results/<test>/error-context.md
npx playwright cli open <url> # the agent's browser (see /verify-ui); npx playwright trace open <trace.zip>
pnpm e2e:visual               # screenshot comparisons inside the official container
pnpm gorilla                  # seeded random abuse of every app page; a failure prints its replay command (e2e/README.md)
pnpm capture <url>            # reference-site capture into .captures/ (see /capture-site)
```

Edited code files are formatted automatically by a PostToolUse hook (Prettier).

## Do not

- Do not edit files under `backlog/` by hand, and do not set a task to Done.
- Do not widen a task's scope silently; ask, then extend the task or create a follow-up.
- Do not re-derive an accepted ADR; propose a superseding one.
- Do not install services, SDKs or SaaS that cannot be reached from Iran without an ADR.
- Do not weaken, skip or delete a test assertion or an evaluation case, add retries or raise a timeout to get green. Fix the cause or ask.
- Do not crawl a source whose terms are not recorded, do not crawl Divar, and do not work around a site's robots.txt, block or bot challenge (ADR-0008). Do not use logged-in capture unless the human asked for that site.
- Do not show a user a number a model generated, and do not ship an AI step without its evaluation.
- Do not let this file grow into a manual. Link, do not paste.
- Do not keep automation nobody uses: a skill, hook or agent that has not been invoked in a month is deleted, not maintained.
