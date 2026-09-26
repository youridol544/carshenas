# How to run project management inside the repo when building AI-first with Claude Code

- Date: 2026-09-17
- Asked by / for: Pedrum (repository bootstrap)
- Outcome: ADR-0001 (Backlog.md as the in-repo tracker); repo layout and Claude Code configuration implemented in the bootstrap commit

## Questions

1. Where should the board and tasks live so that Claude Code can create, pick up, update and close work natively, and git keeps the history?
2. How do engineers with real production experience organise a repository for AI-first development (docs, plans, specs, decisions)?
3. What belongs in `AGENTS.md` / `CLAUDE.md`, how long should it be, and which is canonical?
4. Which Claude Code features (skills, rules, hooks, subagents, plugins, memory) are worth setting up on day one for a solo developer?

## Method

Four parallel research passes over primary sources (each person's own posts, repos, talks, or official docs), all fetched and dated on 2026-09-17; X/Twitter threads were verified through mirrors because X is not fetchable. The two candidate trackers were installed and exercised in a scratch repository (init, config, task creation, dependencies, board rendering, generated agent files) rather than judged from their READMEs. Official Claude Code behaviour was checked against code.claude.com docs for the installed version (2.1.274).

## Sources and why they are credible

| Who | Why credible | What was read |
|---|---|---|
| Boris Cherny (Anthropic) | Created and leads Claude Code | "How I use Claude Code" threads Jan–Jun 2026; "Reflecting on a year of Claude Code" (2026-06-08) |
| Thariq Shihipar, Cat Wu (Anthropic) | Claude Code team | Skills and context threads (2026-03-17, 2026-04-15); interview 2026-07-19 |
| Anthropic engineering | Vendor guidance | Best practices (living doc), Memory docs, "Effective harnesses for long-running agents" (2025-11-26), "Effective context engineering" (2025-09-29), "Agent Skills" (2025-10-16), "How Anthropic teams use Claude Code" (2025-07-24) |
| Ryan Lopopolo (OpenAI) | Built a ~1M LOC product with zero hand-written code | "Harness engineering" (2026-02-11), ExecPlans cookbook |
| Mitchell Hashimoto | HashiCorp founder, Ghostty maintainer | "My AI Adoption Journey" (2026-02-05), Ghostty `AGENTS.md`, `AI_POLICY.md` |
| Armin Ronacher | Flask creator; publishes negative results | Agentic Coding Recommendations (2025-06-12), Things That Didn't Work (2025-07-30), A Language for Agents (2026-02-09), The Coming Loop (2026-06-23), Astra for Coding (2026-09-07) |
| Simon Willison | Django co-creator, Datasette | Vibe engineering (2025-10-07), Agentic Engineering Patterns guide (2026-02 onward) |
| Dex Horthy / HumanLayer | Runs a company on the method; 12-factor agents | ACE-FCA (2025-08), "Writing a good CLAUDE.md" (2025-11-25), humanlayer repo `.claude/` |
| Jesse Vincent | Long-time OSS maintainer (RT, Keyboardio) | Superpowers plugin and posts (2025-10-09, 2026-02-12) |
| Kieran Klaassen (Every) | GM of Cora; maintains compound-engineering plugin | Compound Engineering articles (2025-12-11, 2026-05-29) |
| Harper Reed | ex-Obama campaign CTO, founder | LLM codegen workflow (2025-02-16), Basic Claude Code (2025-05-08) |
| Geoffrey Huntley | Coined the Ralph loop; Anthropic ships an official plugin | ghuntley.com/ralph (2025-07-14), how-to-ralph-wiggum repo |
| Thorsten Ball (Sourcegraph/Amp) | Amp engineer, author | How I Use Amp (2025-05-15), AGENTS.md docs, Register Spill 2026-08 |
| Thoughtworks / Birgitta Böckeler | Technology Radar vol. 34 (Apr 2026); Distinguished Engineer | Radar techniques; Context engineering for coding agents (2026-02-05); Harness engineering (2026-04-02) |
| Andrej Karpathy | OpenAI cofounder | Agentic-engineering posts (2026-01/02), LLM wiki gist (2026-04-04) |
| Peter Steinberger | PSPDFKit founder; extreme-volume solo shipper | Just Talk To It (2025-10-14), Shipping at Inference-Speed (2025-12-28) |
| Steve Yegge | ex-Amazon/Google/Grab/Sourcegraph | Beads (`@beads/bd` 1.3.0, 2026-09-15) — evaluated hands-on |
| MrLesk | Backlog.md maintainer | Backlog.md 1.52.0 (2026-09-12) — evaluated hands-on |

Skipped on purpose: course-seller and "ultimate framework" content (BMAD-style mega-frameworks, SuperClaude, claude-flow) unless a practitioner above cited it.

## Findings

### A. What the credible sources agree on

1. **The root instruction file is a short map, not a manual.** Everyone who quantifies it lands between 40 and 200 lines: Ghostty's `AGENTS.md` is 39 lines; OpenAI's is about 100 ("a map, not a 1,000-page instruction manual"; their monolithic version "rotted"); HumanLayer's is under 60; Anthropic's docs say target under 200 and warn "bloated CLAUDE.md files cause Claude to ignore your actual instructions". Thoughtworks lists "Agent Instruction Bloat" under Hold.
2. **Grow it from observed failures, one line per mistake, and prune.** Boris Cherny: "Every single time Claude makes a mistake, I don't tell it to do it differently. I tell it to write it to the CLAUDE.md." Mitchell Hashimoto describes the harness as "an earnest effort whenever I see an agent do a Bad Thing". Thariq Shihipar: "The highest-signal content in any skill is the Gotchas section." Anthropic's test for each line: would removing it cause a mistake? If not, cut it.
3. **Progressive disclosure for everything else.** Detail lives in `docs/` (OpenAI: "`docs/` is the system of record"; Steinberger; Compound Engineering), `agent_docs/` (HumanLayer), path-scoped `.claude/rules/` and skills (Anthropic, Böckeler). Thariq: "Think of the entire file system as a form of context engineering."
4. **Deterministic guardrails beat prose.** Formatters and linters in hooks (Boris: a `PostToolUse` formatter so "the last 10% doesn't fail CI"), custom linters that "enforce invariants, not micromanaging implementations" (OpenAI), permission allow-lists. HumanLayer: "Never send an LLM to do a linter's job."
5. **Research → plan → implement, with the plan as the human review point, written to a file in the repo.** HumanLayer ("I can't read 2000 lines of golang daily. But I can read 200 lines of a well-written implementation plan"), Superpowers (design doc, then plan, hard gate before code), Compound Engineering ("80 percent of compound engineering is in the plan and review parts"), Harper Reed (`spec.md` → `prompt_plan.md` → `todo.md`), OpenAI ExecPlans (self-contained plans with progress log and decision log), Anthropic (interview → `SPEC.md`, fresh session to execute). Plans state what is **not** being done and split success criteria into automated and manual.
6. **A verification loop the agent can run is the single biggest lever.** Boris: "Give Claude a way to verify its work… it will 2–3x the quality." Thorsten Ball asks for "irrefutable proof" (screenshots, narrated runs). TDD is favoured by Harper ("the robots LOVE TDD"), Superpowers, Simon Willison and Karpathy. Anthropic's long-running-agent harness exists specifically to stop "premature victory" and "features marked done without testing".
7. **Fresh, small contexts.** One task per session, `/clear` between tasks, subagents for exploration that return summaries. Thorsten: "after the context window reaches 100k tokens, things start to feel blurry"; HumanLayer keeps utilisation at 40–60%; Thariq: context rot on the 1M model "kicks in around 300–400k".
8. **Git is the memory.** Commit per task, clean state before risky runs, worktrees for parallel sessions, plans and specs committed. For unattended loops add an explicit progress file (Anthropic's `claude-progress.txt` and `feature_list.json`, Huntley's `IMPLEMENTATION_PLAN.md`, OpenAI's ExecPlan progress log).
9. **Commit the agent configuration** (`AGENTS.md`/`CLAUDE.md`, `.claude/settings.json`, rules, skills, agents, `.mcp.json`); gitignore the personal `CLAUDE.local.md` and `settings.local.json`. Thoughtworks puts "Curated Shared Instructions for Software Teams" under Adopt.
10. **Automate only what you repeat.** Boris: "if done more than once a day, turn it into a skill or command." Armin Ronacher deletes automation he stops using and abandoned most of his slash commands and hooks.
11. **Humans own understanding and review.** Ghostty's policy: "If you can't explain what your changes do… do not contribute." Simon Willison's anti-pattern: "Don't file pull requests with code you haven't reviewed yourself." Karpathy: "You can outsource your thinking, but you can't outsource your understanding."
12. **Capture learnings back into the repo** after each task: Compound Engineering's `docs/solutions/`, Boris's CLAUDE.md rule, OpenAI's recurring "doc garbage collection" tasks, Karpathy's append-only `log.md`.

### B. What is contested

- **Formal plan mode.** Superpowers gates every task behind a design; Anthropic says skip the plan when the diff fits in a sentence; Boris now says newer models "don't actually need a planning step" for synchronous work; Steinberger rejects the mode yet still plans conversationally. Resolution used here: plan on the task record (cheap) and write a spec only when the work is bigger than one PR.
- **Subagents**: strongly endorsed by Anthropic, Boris, HumanLayer and Superpowers; rejected as "context poison" by Steinberger and dropped by Ronacher in 2025. Used here only for read-only exploration and review.
- **MCP vs CLIs**: Anthropic docs, Steinberger and Thoughtworks ("MCP by Default" under Caution) prefer CLIs; Backlog.md itself recommends its CLI mode over its MCP server. CLI mode chosen.
- **Autonomous loops**: Ralph, Steinberger ("designing loops that prompt your agents") and Ronacher ("my job is to write loops") vs. supervised work (Hashimoto, Karpathy "watch them like a hawk", Thariq "most tasks don't need more compute"). Ronacher's 2026-09-07 report of a 35-hour run ("gradual regression towards insanity", four-figure cost) is the cautionary tale. Loops are available here through the official `ralph-loop` plugin but capped by `--max-iterations` and reviewed via the In Review column.
- **Where notes live**: in-repo `docs/` (OpenAI, Every, Superpowers, Harper) vs. a separate synced `thoughts/` repo (HumanLayer) vs. nowhere (Steinberger: "nothing did stick"). In-repo chosen: OpenAI's rule "anything it can't access in-context while running effectively doesn't exist" applies to a solo developer too.

### C. In-repo trackers, evaluated hands-on

| | Backlog.md 1.52.0 | Beads (`bd`) 1.3.0 | Plain markdown (`TODO.md`, `docs/plans/`) | Claude Code native tasks | GitHub Issues/Projects |
|---|---|---|---|---|---|
| Where data lives | `backlog/tasks/*.md`, YAML frontmatter, human-readable | Embedded **Dolt** database in `.beads/embeddeddolt/`; JSONL is a passive export | Wherever you put it | `~/.claude/tasks/` on the machine, not in the repo | GitHub |
| Board | `backlog board` (terminal), `backlog browser` (local web UI) | `bd graph`, no board; third-party viewers | None | None | Projects UI |
| Agent integration | Short nudge in AGENTS.md; guides served by `backlog instructions overview\|task-creation\|task-execution\|task-finalization`; optional MCP; generated `project-manager-backlog` subagent | `bd prime` (868 words) injected by hooks; writes Codex, Cursor and Claude config, git hooks; auto-commits on init | Whatever you write in AGENTS.md | `TaskCreate`/`TaskList` tools, shared inside agent teams | `gh` CLI |
| Model | Tasks, subtasks, dependencies, milestones, labels, priority, types, acceptance criteria with `#n`, definition of done, plan/notes/final summary sections, drafts, docs, decisions, search | Hash IDs, dependency graph, `bd ready`, epics, leases, gates, merge-slots, swarms, federation | Free-form | Flat list | Issues + custom fields |
| Fits a solo dev | Yes | Built for multi-agent "Gas Town" orchestration; heavy | Yes but no structure | Ephemeral | Leaves the repo |

Observations from the trial (scratch repos, 2026-09-17):

- `backlog init` created only `backlog/config.yml`, a 24-line nudge in `AGENTS.md`/`CLAUDE.md` and one subagent file. The workflow guides live in the CLI and cost roughly 400 (overview), 925 (creation), 640 (execution) and 400 (finalization) words when read, so `AGENTS.md` stays short. The execution and finalization guides already enforce: read before mutating, claim, research, record the plan on the task, implement in slices with notes, check acceptance criteria only with objective evidence, write a final summary. That is the practitioner consensus from section A, tool-enforced.
- Quirks found: `--ac "a,b"` creates one criterion (repeat the flag); the generated subagent's examples use the comma form and were corrected; `backlog milestone create` does not exist (`milestone add`); list settings such as statuses must be edited in `config.yml`. All recorded in `AGENTS.md` Gotchas.
- `bd init --non-interactive` wrote 30+ files including `.codex/`, `.cursor/`, `.agents/skills/beads/`, five git hooks and a 2.1 MB Dolt store, and committed them to git by itself. Sync goes through `refs/dolt/data` on the remote rather than the code branch, so tasks are not reviewable as diffs. The command surface (`swarm`, `gate`, `merge-slot`, `heartbeat`, `federation`, `wisp`) targets fleets of agents. Yegge's design goals are sound, but the 2026 version is the wrong tool for one developer.
- Claude Code's native task list is useful within a session or an agent team but is stored under `~/.claude/tasks`, so it cannot be the project's board. Since version 2.1.268 the `TaskCreate`/`TaskList` tools are also only enabled by default on older model families; on current models they are off unless `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` is set (tools reference, code.claude.com).
- Beads context, from the second research pass: the repository moved to `gastownhall/beads` and is now the foundation of Gas City Inc. (a commercial "Beads Team Server"); 1.3.0 (2026-09-15) is "the first tested release off main since the 1.1 line" after two accidental 1.2.x releases; the tracker shows about 1,200 open issues. `bd metrics --help` documents anonymous usage telemetry that is on by default (opt out with `bd metrics off` or `DO_NOT_TRACK=1`) and is not mentioned in the README. Representative user reports: "Ever since the move to dolt, nothing works. Tasks disappear" (issue #2573, 2026-03-13); "frequent bugs and sharp edges lead me to spend a bunch of time caring for beads itself instead of doing beads" (issue #2938, 2026-03-31); Armin Ronacher on Hacker News (2026-04): it "threw itself into a global file… which caused beads to appear in random projects on my machine". Positive reports exist too ("has certainly made my agents much more effective", HN 2026-03-06). Steve Yegge's own write-ups run from "Introducing Beads" (2025-10-13) through "Welcome to Gas City" (2026-04-24).
- Backlog.md context: the author is Alex Gavrilescu (leads backend and web engineering at Funstage GmbH, Vienna; Devoxx Belgium 2025 talk "Reaching 95% task success rate with AI agents"); releases are roughly weekly (1.49 stable `--json`, 1.50.1 fixed a performance regression from cross-branch scanning, 1.51 dependency graphs and due dates, 1.52 on 2026-09-12); about 60 open issues. Farsi task titles produce correct file names and are searchable (verified in the trial); RTL rendering in the web UI was not checked. Hacker News reports: "quite nice… has a nice tui/webui for me, and mcp for the agent" (2026-01-06); "nice to help with organization but it is not sufficient for complexity or multiagents" (2026-02-04).
- Other tools looked at and set aside: **claude-task-master** (PRD → `tasks.json`; no commits since April 2026, team moved to a commercial product); **Vibe Kanban** (a separate app with its own SQLite database; the company shut down in April 2026 and the project is sunsetting); **Beans** by hmans (markdown in `.beans/`, Go binary without an npm package, described on HN as "much, MUCH less invasive than beads"; small and quiet since April 2026); **Ticket** by wedow (a single bash script). None beat Backlog.md on the combination of markdown storage, board, activity and Claude Code fit.

### D. Claude Code mechanics that shaped the setup (verified against code.claude.com docs, 2026-09-17)

- Claude Code reads `CLAUDE.md`, not `AGENTS.md`; the documented pattern for the cross-tool standard is a `CLAUDE.md` whose first line is `@AGENTS.md` (or a symlink). Imports resolve to depth 4 and still load at launch, so importing does not save context.
- `.claude/rules/*.md` with `paths:` frontmatter load only when matching files are read; rules without `paths:` load at startup. Stack-specific rules are deferred to the app scaffold for that reason.
- Skills are `.claude/skills/<name>/SKILL.md` with `name`, `description` (the trigger), `argument-hint`, optional `disable-model-invocation`, `context: fork`, `paths`, and inline `!`command`` context injection. `.claude/commands/` still works but skills are the current mechanism.
- Subagents are `.claude/agents/*.md` with `tools`, `disallowedTools`, `model`, `memory`, `isolation: worktree`. A read-only reviewer is the highest-value one at this stage.
- Hooks live in `.claude/settings.json`; `SessionStart` stdout is added to context, and the `compact` matcher re-injects after compaction. Used to print the board.
- `.claude/settings.json` is shared and committed; `settings.local.json` is personal and gitignored. Permissions use `Bash(backlog *)`-style patterns; `Read(./.env*)` can be denied.
- Plugins from `anthropics/claude-plugins-official` are enabled per project with `enabledPlugins`; `ralph-loop` (Stop-hook loop) and `claude-md-management` (`/revise-claude-md`, `claude-md-improver`) are the two relevant to this workflow. `feature-dev` (7-phase interactive feature workflow) exists but overlaps with `/plan` and does not write to the tracker.
- Auto memory (`~/.claude/projects/<project>/memory/`) is machine-local and Claude-written; it must not hold anything the project depends on.

### E. The AGENTS.md standard

- `agents.md` started at OpenAI (Aug 2025) and has been stewarded by the Agentic AI Foundation under the Linux Foundation since 2025-12-09 (founding members include Anthropic, Google, Microsoft, AWS, OpenAI). It is plain markdown with no required fields, used by more than 60,000 open-source projects. Semantics in the tools that read it natively (Codex, Cursor, Copilot, Amp, Zed, Kiro, Gemini CLI and others): nested files apply to their subtree and the nearest file wins; Codex caps the combined chain at 32 KiB.
- Claude Code does not read it natively. The memory docs state "Claude Code reads `CLAUDE.md`, not `AGENTS.md`" and document two options: a `CLAUDE.md` containing `@AGENTS.md`, or a symlink. The feature request (anthropics/claude-code issue #6235, the most-upvoted issue in the tracker) was closed as completed on 2026-08-17 by Boris Cherny with exactly that answer, so the import is the long-term state, not a stopgap. Note the semantic difference: Claude Code concatenates every ancestor `CLAUDE.md` and loads subdirectory files on demand, whereas AGENTS.md tools use nearest-wins.
- What serious projects ship (line counts measured 2026-09-17): Ghostty 39, Kubernetes 38, HumanLayer 88, Coder 93 (`CLAUDE.md` is a symlink), Sentry 137 (`CLAUDE.md` is literally `@AGENTS.md`), Cloudflare workers-sdk 153, Zed 189, Rails 201; openai/codex at 320 and Next.js and Airflow above 500 are monorepo outliers. Zed's "Rules Hygiene" section is the best statement of what earns a line: "Non-obvious, Repeatedly encountered, Specific enough to act on… Rules should be traps to avoid, not maps to follow."
- Measured evidence, for calibration: an ETH Zurich study (arXiv 2602.11988, Feb 2026) found context files "do not generally improve task success rates, while increasing inference cost by over 20% on average"; instructions are followed well, "repository overviews… are not helpful", and the files pay off "for specifying non-standard coding practices". A factorial study over 1,650 Claude Code sessions (arXiv 2605.10039, May 2026) found no detectable effect of file size, rule position or structure in the 25–500-line range, but compliance decays within a session. A mining study of 2,303 files (arXiv 2511.12884) shows they "evolve like configuration code through frequent, small additions". Conclusion applied here: keep the file short, make it about commands, conventions that differ from defaults and gotchas, not about architecture; keep sessions short.

### F. Spec-driven and plan-driven tooling

- **GitHub spec-kit** (v1.0.7, 2026-09-15): `specify init --integration claude` installs skills invoked as `/speckit-constitution|specify|plan|tasks|implement`, producing `.specify/memory/constitution.md` and `specs/NNN-slug/{spec,plan,research,data-model,tasks}.md` per feature. Thoughtworks (Radar vol. 34, Assess) values the constitution for brownfield work but flags "instruction bloat", "context rot" and verbose output; Birgitta Böckeler: "I'd rather review code than all these markdown files… sledgehammer to crack a nut" for small tasks; another reviewer notes it has no built-in code review step.
- **Kiro** (AWS, GA 2025-11-17): `.kiro/specs/<feature>/{requirements,design,tasks}.md` with EARS-style acceptance criteria ("WHEN <condition> THE SYSTEM SHALL <behaviour>") and steering files whose inclusion modes (always / file-match glob / manual) map almost one-to-one onto `CLAUDE.md`, `.claude/rules/` with `paths:` and skills. The EARS phrasing is adopted as an optional style in the spec template here.
- **OpenSpec** (Fission-AI, v1.13.1, 2026-09-17): `openspec/specs/` plus `openspec/changes/<name>/{proposal,design,tasks}.md`, archived when done; Thoughtworks lists it under Assess as the lighter option. **BMAD** (v6.12, 12+ personas) is built for teams and audit trails; one tester reported six days and about $200 for a single feature. **claude-task-master** is dormant (see C).
- **Plan mode in Claude Code** writes plan files to `~/.claude/plans/` by default, where the 30-day cleanup sweeps them; the `plansDirectory` setting (added in 2.1.9, verified present in the installed binary) redirects them into the repo, and the plan file is re-injected after compaction. Set here to `docs/plans/`.
- Where practitioners put plans: Superpowers `docs/superpowers/{specs,plans}/YYYY-MM-DD-<topic>.md`; HumanLayer `thoughts/shared/{research,plans}/YYYY-MM-DD-ENG-XXXX-<slug>.md` with "What We're NOT Doing" and per-phase automated vs manual verification; OpenAI ExecPlans with progress and decision logs; spec-kit numbered folders. Dated files for plans and research, numbered slugs for feature specs, is the convention followed here.
- Conclusion: the parts that survive contact with practitioners (a reviewed spec, explicit non-goals, verifiable criteria, a plan the human reads instead of the diff, archiving what is done) are covered by `docs/specs/`, `docs/plans/` and Backlog tasks without adopting a framework. OpenSpec is the one to look at first if a framework ever becomes necessary.

## Recommendation (implemented in the bootstrap commit)

```
carshenas/
├── AGENTS.md                 # the map (~100 lines): purpose, map table, tracker rules, workflow,
│                             #   conventions, Gotchas (grows from real mistakes), commands, do-nots
├── CLAUDE.md                 # "@AGENTS.md" + Claude-only notes
├── README.md                 # for humans: how to see the board, how to start a session
├── backlog/                  # Backlog.md: tasks (CS-n), milestones (m-0..m-6), drafts, config.yml
├── docs/
│   ├── product/              # vision.md (brief + market constraints), glossary.md (Farsi ↔ English)
│   ├── specs/                # SNN-*.md feature specs with "not doing" and automated/manual criteria
│   ├── decisions/            # ADRs, immutable; 0001 = this decision
│   ├── research/             # dated, cited notes (this file)
│   ├── runbooks/             # ops how-tos (empty until there is something to run)
│   ├── plans/                # plan-mode output (plansDirectory); keep only approved, executed plans
│   └── learnings.md          # append-only one-liners from finished tasks
└── .claude/
    ├── settings.json         # plansDirectory=docs/plans; permissions (backlog/git allowed, .env unreadable,
    │                         #   force-push denied); enabledPlugins (claude-md-management, ralph-loop); SessionStart hook
    ├── hooks/session-start.sh# prints In Progress / In Review / To Do at startup, resume, compaction
    ├── skills/{plan,work,adr,research}/SKILL.md
    ├── agents/{task-reviewer,project-manager-backlog}.md
    └── rules/                # empty until the app scaffold adds path-scoped stack rules
```

Operating loop: session starts with the board → `/plan` for anything bigger than one PR (spec + tasks) → `/work CS-n` (claim, research, plan on the task, slices with notes and commits, evidence per criterion, reviewer subagent, In Review) → human verifies and moves to Done → learnings appended; `/adr` and `/research` whenever a decision or a spike is needed; `/ralph-loop` only for well-specified batches with a small iteration cap.

Deliberately not adopted now: Beads (see C), spec-kit/BMAD-style frameworks, the Backlog MCP server (CLI is enough and cheaper in context), Superpowers and Compound Engineering plugins (large skill sets whose ideas were taken instead: brainstorm-before-code, plan as review artefact, learnings capture), a separate `thoughts/` repository, and any stack-specific rules before the stack exists.

## What would change this

- A second developer or parallel agent fleets working the same board for weeks: revisit Beads or mirror Backlog tasks to GitHub Projects.
- Backlog.md maintenance stalling: the data is markdown, so migration is a script.
- `/plan` or `/work` going unused for a month: delete them (Ronacher's rule) and let the Backlog guides carry the workflow alone.
