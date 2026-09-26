# ADR-0002: One pinned Playwright for tests, the agent's browser and site capture; CLI, not MCP

- Status: accepted
- Date: 2026-09-17 (adopted for Carshenas on 2026-09-26)
- Deciders: Pedrum (with Claude Code)
- Related: `docs/research/2026-09-17-playwright-with-coding-agents.md`, ADR-0001, ADR-0008

## Context

Acceptance criteria here may only be checked with objective evidence, and for a Farsi, right-to-left, phone-first search product most criteria are visual or interactive. Agents need a browser during a task, the project needs a regression suite that runs the same locally and in CI, and the owner wants to study reference sites such as CarGurus, Autolist and the Iranian listing sites. The decision was made before the application stack was chosen, so none of it assumes one. Overlapping tools exist for the agent's browser (Playwright MCP, the Playwright CLI, Playwright test agents, Chrome DevTools MCP, Vercel agent-browser, Claude in Chrome), and practitioners disagree about them.

## Decision

1. **Playwright Test is the end-to-end framework**, in an isolated `e2e/` package that targets `E2E_BASE_URL` and ships a Farsi RTL fixture site until the real app exists. Defaults: `fa-IR`, `Asia/Tehran`, projects `mobile` (Pixel 7, primary), `desktop`, and `iphone` (WebKit) in CI. Shared fixtures fail tests on console errors and failed requests and provide axe and RTL assertions.
2. **The agent's browser is the Playwright CLI bundled in that same package** (`npx playwright cli …`), with the version-matched `playwright-cli` and `playwright-trace` skills synced into `.claude/skills/` and the project skill `verify-ui` on top. No MCP server is configured and nothing is installed globally.
3. **One Playwright version**, pinned in the catalog of a root pnpm workspace that holds tooling only (`e2e`, `tools/*`). The CI container tag is derived from it. The application joined this workspace as `apps/web` (ADR-0003).
4. **Locators are role and accessible name in Farsi**, copied from Playwright snapshots; assertions are web-first; `waitForTimeout`, `networkidle` and `force` are banned; an assertion is never weakened, skipped or given a longer timeout to get green (`.claude/rules/e2e.md`).
5. **Visual baselines are produced only in the official Playwright container** (`pnpm e2e:visual --update-snapshots`), and CI runs in that same image.
6. **Reference sites are studied with the in-house `tools/site-capture`**, whose guardrails are enforced in code: one page view per viewport, robots.txt respected, stop on any block or challenge, no evasion, logged-in modes only with `--own-account`, reports without credentials or page copy.

## Alternatives considered

- **Playwright MCP in `.mcp.json`**: same engine and, since Claude Code defers tool schemas, about the same token cost as the CLI (measured). Rejected because it needs a per-user approval step, adds a second configuration surface, and the standalone package pins an alpha Playwright; the bundled `playwright mcp` remains one line away if a harness without shell access ever needs it.
- **Standalone `@playwright/cli` / `@playwright/mcp` installed globally**: both pin `playwright 1.64.0-alpha` today, which means a second browser download and an engine that differs from the tests.
- **Vercel agent-browser**: tersest output, but its snapshots drop the zero-width non-joiner from Persian accessible names (measured: 0 of 7 kept), so names copied into locators would not match; its network listing of a real page is about 19k tokens.
- **Chrome DevTools MCP**: valuable for performance traces and Lighthouse, not needed before there is an app; add it then, with `--slim`.
- **Claude in Chrome**: good for headed, logged-in debugging by the human; needs an extension and a plan login, increases context when always on, cannot run in CI. Optional, not part of the workflow.
- **Playwright test agents (planner, generator, healer)**: evaluated hands-on and not installed; nothing to plan against yet, the healer may skip tests on its own, the generator overwrites `.mcp.json`, and the bundled CLI skill carries the same loop with stricter rules. Revisit once real user flows exist (m-5).
- **Separate packages without a workspace**: two Playwright pins and `--dir` prefixes on every command; the bundled skills' `npx playwright …` instructions would not work from the repository root.
- **dembrandt, Wappalyzer forks, css-design-tokens for capture**: evasion flags by default, GPL or EUPL data, and poor results on App Router sites (see the research note).

## Consequences

- Positive: one command each for the suite (`pnpm e2e`), the agent's browser (`npx playwright cli`), trace inspection (`npx playwright trace`), baselines (`pnpm e2e:visual`) and capture (`pnpm capture`); evidence-based UI criteria from the first UI task; Safari coverage in CI for free.
- Negative / risks: a root `package.json` and pnpm workspace existed before the stack decision, so the app lives inside it at `apps/web` rather than at the root; the official container has no Persian UI font, so baselines only match production once the app self-hosts its typeface; the 2.5 GB container image is needed locally for visual work; generated skills must be re-synced on every Playwright upgrade (`pnpm skills:sync`).
- Requirements this places on later tasks: the app must start with one command on a configurable port so each worktree can run its own (done); authentication, when it arrives, must offer a deterministic or logged one-time code in development and test so agents and tests can sign in; no native `alert`/`confirm` dialogs, which block browser agents; the UI font is self-hosted and direction-agnostic CSS uses logical properties (CS-3).
- Follow-ups: first green GitHub Actions run once CS-21 creates the remote (criterion in CS-22).
