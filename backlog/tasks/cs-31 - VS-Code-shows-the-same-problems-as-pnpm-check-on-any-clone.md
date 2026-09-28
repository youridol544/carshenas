---
id: CS-31
title: 'VS Code shows the same problems as pnpm check, on any clone'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 13:07'
updated_date: '2026-09-28 13:32'
labels:
  - dx
milestone: m-1
dependencies: []
references:
  - .gitignore
  - apps/web/tsconfig.json
  - apps/web/eslint.config.mjs
  - packages/observability/eslint.config.mjs
  - .prettierrc.json
  - .editorconfig
  - pnpm-workspace.yaml
  - scripts/init.sh
  - README.md
  - docs/decisions/0003-bare-minimum-nextjs-16-and-react-19.md
  - docs/decisions/0004-frontend-structure-and-enforcement.md
  - docs/decisions/0005-styling-and-component-primitives.md
priority: high
ordinal: 5500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner sees many TypeScript, ESLint and other problems in VS Code while `pnpm check` passes, so the editor cannot be trusted: real problems hide among false ones, and whoever clones the repository gets an editor shaped by their personal settings. The repository ships no editor settings.

The CLI checks are the reference. The editor is set up to agree with them in both directions, without loosening their rules or narrowing what they check. A real problem the editor finds in a file no CLI check covers becomes a follow-up task. Editors other than VS Code are out of scope.

Found at creation (2026-09-28), to confirm when the work starts:
- The owner runs VS Code 1.107.1 with the ESLint (3.0.34), Prettier (12.4.0), Tailwind CSS IntelliSense (0.16.0) and Pylance extensions, in an untitled workspace window (`~/.config/Code/Workspaces/`) that held this repository and another project, cut to this repository alone during the session. `typescript.tsdk` is window-scoped, and a folder's `.vscode/settings.json` does not apply window-scoped settings inside a workspace window.
- No `.vscode/` folder is tracked; `.gitignore` already lets `.vscode/settings.json` and `.vscode/extensions.json` through.
- TypeScript is installed per package (`apps/web`, `e2e`, `packages/observability`), not at the root. VS Code's bundled TypeScript matches the catalog pin (5.9.3) only by coincidence, and the Next.js plugin listed in `apps/web/tsconfig.json` loads only in the workspace's TypeScript.
- ESLint configs exist only in `apps/web` and `packages/observability`; for a file under one of them the extension lints from that folder, as `pnpm lint` does. Linting from the repository root instead, ESLint 9 finds no config, and with the config found but the root as working directory `eslint-plugin-better-tailwindcss` cannot resolve Tailwind and turns off four of its rules with only a console warning. A wrong working directory hides problems as well as inventing them.
- `apps/web/eslint/samples/` holds deliberately failing lint samples that the app's tsconfig and ESLint config exclude; the lint self-test lints copies of them placed under `src/`.
- `next-env.d.ts` and the route types in `.next/types` are untracked and appear only after `next typegen`, `next dev` or `next build`; `pnpm typecheck` runs `next typegen` first.
- `globals.css` uses Tailwind v4 at-rules (`@theme`, `@custom-variant`) that VS Code's own CSS validation does not know.
- Claude Code's IDE connection reads VS Code's diagnostics; at creation it listed none for this repository because no affected file was open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Before anything changes, the problems the owner's VS Code shows are recorded on the task (tool, rule or code, file); after the change each one is gone or is also reported by `pnpm check`
- [ ] #2 Opened as the README says, with the recommended extensions, VS Code reports no error, warning or information problem in any tracked file that `pnpm check` does not also report; the evidence covers every tracked file VS Code validates, not a selection
- [ ] #3 Nothing is silenced to get there: a type error and a lint violation planted in `apps/web` and in `packages/observability`, and a type error planted in `e2e`, show up in VS Code with the same rule and message that `pnpm typecheck` and `pnpm lint` print, including a type-aware typescript-eslint rule and a `better-tailwindcss` rule
- [ ] #4 VS Code checks the code with the TypeScript that `pnpm typecheck` runs, not its bundled copy, with the Next.js TypeScript plugin loaded for the app; a fresh clone is offered that TypeScript on first open
- [ ] #5 Saving a file in VS Code leaves it exactly as `pnpm format` would write it, and saving a file Prettier ignores (Markdown, `backlog/`, generated types) writes back only the person's own edits
- [ ] #6 Only what the project needs is committed: the recommended extensions are the ones this setup relies on, each committed setting says in a comment which CLI behaviour it matches, and personal preferences (theme, font, keybindings, assistants) stay in user settings
- [ ] #7 The README says how to open the repository so the settings apply (on its own or in a window shared with other projects), what to accept on first open, and what to do when the editor and `pnpm check` disagree
- [ ] #8 A fresh clone gets the same editor: in a new worktree, after `./scripts/init.sh` and opening it as the README says, VS Code reports no problem that `pnpm check` does not also report, with no step the README leaves out
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. apps/web/eslint.config.mjs: give every file the app lints an explicit tsconfigRootDir (today only src/ has one), with a comment on why; no rule changes. The lint self-test gains a check that loads every workspace package's ESLint config in one process, as VS Code's ESLint server does, and lints each package's files outside src/ without a parsing error.
2. apps/web/eslint/samples/tsconfig.json extending the app's, so VS Code checks the samples with the app's options and @/ alias; bad-barrel.ts re-exports a module that exists (it proves the export * rule either way).
3. .vscode/settings.json (commented), only settings that make the editor agree with the CLI: the TypeScript that pnpm typecheck runs (typescript.tsdk, with the prompt to use it); Prettier as the formatter, formatting on save, for the languages pnpm format checks; *.css opened in Tailwind CSS mode, whose CSS server drops exactly v4's at-rules from unknownAtRules and keeps VS Code's other CSS checks, and prettier.documentSelectors so Prettier still formats CSS; auto-imports written through @/ because the lint forbids ../ imports.
4. .vscode/extensions.json: ESLint, Prettier, Tailwind CSS IntelliSense.
5. README: an editor section (open the folder itself, accept the recommended extensions and the workspace TypeScript, what differs in a window shared with other projects, what to do when the editor and pnpm check disagree).
6. Evidence, with the probe from the baseline: all tracked files in a folder window and in a workspace window; planted type and lint errors in a scratch worktree compared with pnpm typecheck and pnpm lint; the tsserver log for the TypeScript in use and the Next.js plugin; format on save compared byte for byte with prettier, and Prettier-ignored files saved unchanged; a fresh worktree through ./scripts/init.sh, then the probe.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline for #1 (2026-09-28, before any change). The owner's live window listed no problems through the IDE connection because no affected file was open, so the baseline comes from a probe (scratchpad, not committed): VS Code 1.107.1 started with a separate profile holding the owner's user settings and installed extensions (ESLint 3.0.34, Prettier 12.4.0, Tailwind CSS IntelliSense 0.16.0, Python, Pylance), opened the way the owner opens the repository (an untitled workspace holding this folder), then every one of the 459 tracked text files opened in batches and VS Code's own diagnostics read back. 22 problems (17 errors, 5 warnings) in 18 files; `pnpm check` reports none:
- ESLint, 11 errors, "Parsing error: No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present", in every app file outside src/ that typescript-eslint parses: eslint.config.mjs, eslint/local-rules.mjs, eslint/selftest.mjs, next.config.ts, postcss.config.mjs, scripts/browser-source-maps.mjs, scripts/browser-source-maps.test.mjs, vitest-provided-context.d.ts, vitest.config.mts, vitest.db.config.mts, vitest.setup.ts. Cause: VS Code runs one ESLint process for the window. Reading `tseslint.configs` records the reading config file's folder as a candidate tsconfigRootDir in a process-wide set, so once the app's and packages/observability's configs are both loaded, a file parsed without an explicit tsconfigRootDir has two candidates and fails. `pnpm lint` lints each package in its own process, with one candidate. Reproduced in plain Node by linting an observability file, then apps/web/next.config.ts, in one process.
- TypeScript, 6 errors in the lint self-test samples, which the app's tsconfig excludes, so VS Code checks them in an inferred project without the @/ alias or the app's options: 2307 "Cannot find module" at bad-barrel.ts:4, bad-log-message.ts:5, clean-log-message.ts:4, clean-route.ts:3, clean-sql.ts:5; 2322 at clean-component.tsx:18 (two copies of React's Ref type).
- CSS, 5 warnings in apps/web/src/app/globals.css, unknownAtRules: @custom-variant (line 6), @theme (65, 136), @apply (197, 202). VS Code's own CSS validator does not know Tailwind v4's at-rules.
Not from VS Code: the "new diagnostics" this session received for stack.ts, request-error.ts, route-errors.ts and database-logging.test.ts came from Claude Code's typescript-lsp plugin, a typescript-language-server started 2026-09-26 that still holds CS-30's intermediate edits; the files on disk are correct.

Slice 1: apps/web/eslint.config.mjs now gives every file an explicit tsconfigRootDir (a config object without `files`), not only src/; no rule changed. The lint self-test loads every workspace package's ESLint config (found from pnpm-workspace.yaml) before linting the samples, then lints each package's files outside src/ in that same process and fails on any message. Before the config change it failed on exactly the 11 files of the baseline; after it: "ok apps/web: 11 file(s) outside src/, one process", "ok packages/observability: 1 file(s)", 23 samples as before. `pnpm lint` unchanged (clean).

Slice 2: apps/web/eslint/samples/tsconfig.json extends the app's tsconfig (with `exclude: []`, since the app's own exclude names this folder) and adds next-env.d.ts, so the editor checks the samples with the app's options, @/ alias and Next.js globals; without next-env.d.ts, process.env.NODE_ENV widens to string | undefined and src/server/observability/logger.ts fails through the samples. bad-barrel.ts re-exported @/features/lint-selftest/lint-selftest-types, which never existed; it now re-exports @/lib/digits and still trips no-restricted-syntax with the barrel message. `tsc -p apps/web/eslint/samples/tsconfig.json --noEmit` exits 0; lint self-test passes (23 samples); `pnpm typecheck` passes and does not read the new file.
<!-- SECTION:NOTES:END -->
