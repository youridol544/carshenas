---
id: CS-105
title: >-
  Copy lint and a copy inventory: mechanical rules, a rewrite plan with disjoint
  file lists
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 08:25'
labels:
  - tooling
  - frontend
dependencies: []
priority: high
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04 (see CS-104). Mechanical copy rules should be checked by a tool, not by memory: a lint over the files that hold user-visible text, and an inventory of every such file so the rewrite can run in parallel lanes without conflicts. The rules come from CS-104 (the first version can use the patterns already known: filler phrases, exclamation marks, Arabic letters, missing half-spaces, Latin digits in Persian text, a middle dot next to digits, repeated sentences, over-long strings) and are extended when the guide lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm copy:lint reads the files that hold user-visible text (every feature copy file, the shared packages’ texts such as search explanations and notification kinds, inline strings in components found by a documented rule) and reports violations of mechanical rules with file, line and the rule: banned filler phrases from a list kept in one file, exclamation marks, Arabic ي and ك, a space where a half-space belongs (می خواهید), Latin digits inside Persian text, a middle dot next to a digit, the same sentence twice in one file, and strings above a length budget by kind (button, label, hint, notice, popover)
- [ ] #2 The lint has a self-test with passing and failing samples, an allowlist file with a reason per entry, runs inside pnpm check in under 10 seconds, and its report on today’s copy (violations by file and rule) is committed under docs/evidence/copy/
- [ ] #3 An inventory, docs/design/copy-rewrite-plan.md, lists every file with user-visible text with its string count, grouped into five rewrite areas with disjoint file lists: public pages and shell; search, filters, understanding, listing page and cards; account, notifications and buyer tools; admin; shared definitions and info popovers; no file is in two areas
- [ ] #4 The lint accepts the extra rules the guide of CS-104 defines once it is merged (a documented place to add a rule, one test per rule); pnpm check passes and AGENTS.md mentions pnpm copy:lint in its commands while staying under 150 lines
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research (done): copy lives in 17 *-copy.ts files, ~50 other apps/web files (view models, pages, components) and a few shared package modules; vocabulary (packages/search/src/understand/*, apps/worker, packages/ai) also contains Persian but is never shown.
2. tools/copy-lint (plain Node ESM, TypeScript compiler API resolved from apps/web, no new dependency): lib (scope/classify, AST extraction, kind inference from key/attribute/element, directives, allowlist, baseline), rules (one module per rule with its own pass/fail samples, auto-registered and auto-tested), data (the ONE banned-phrase list, allowed Latin tokens), cli.mjs (pnpm copy:lint, --update-baseline lowers only, --baseline-rule for a new rule, --all, --report).
3. Scope decision: copy file = *-copy.ts(x) under apps/web/src, the explicit shared-text list in packages (search definitions and understanding messages, notification kinds, locale unit words), and any other apps/web/src file with a string holding a Persian word; tests, fixtures, design and diagnostics pages, worker, packages/ai and understand vocabulary are excluded with a reason each; a Persian-text file that is neither fails the check.
4. Baseline (rule + file + count) so pnpm check fails only on new or worse; report committed under docs/evidence/copy/lint-baseline.md.
5. Inventory: tools/copy-lint/areas.mjs (five areas plus the CS-115 list, globs with overrides and notes), pnpm copy:inventory generates docs/design/copy-rewrite-plan.md; a test fails when a copy file is in no area or in two.
6. Wire into pnpm check (copy:test then copy:lint), AGENTS.md (net zero lines, stays under 150), README, docs/runbooks/copy-lint.md; measure runtime (< 10 s).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
DECISIONS (owner away, decided here).

SCOPE. A copy file is a file under apps/web/src with a string holding a Persian word (two Arabic-script letters in a row, not the U+0600 block: it also holds the Persian comma and the digits, which put 18 of 86 joiner-only files into the set), or one of the shared text modules listed in tools/copy-lint/copy-files.mjs (packages/search definitions and the three understanding-message modules, packages/notifications kinds, packages/locale unit words), or JSON under apps/web/public (the hero alt texts); a file that only joins values with the middle dot is a copy file for the dot rules. Excluded with a reason each: apps/worker, packages/ai, the understanding vocabulary, the /design and diagnostics pages, fixtures and test databases. A file with Persian text that is neither fails the lint, so new Persian text cannot hide. The TypeScript compiler API comes from apps/web (createRequire): no dependency, no lockfile change.

RULES (25 ids, one module each under tools/copy-lint/rules; auto-loaded; the samples live in the module; test/rules.test.mjs fails a rule without a passing and a failing sample). The task list: banned-phrase (ONE list, data/banned-phrases.mjs, 36 entries each with why and instead, one exemptable per file glob), exclamation-mark, arabic-letters, half-space (also the prefix بی), latin-digits, middle-dot-digit, repeated-sentence (five words or more, no holes, one file or one feature folder), english-word (data/allowed-latin.mjs: cc, km), double-space, edge-space (whole sentence-length strings only), length budgets by kind (button 3 words and 22 characters, label 4, hint 12, notice 25, popover 45). My additions: title 8 words and accessible name 10 words (an aria-label or alt is not a visible label); arabic-digits; middle-dot-join (a dot beside a value the file cannot see, e.g. join(" · "): where the real violations are, because a static check never sees a digit next to those dots). From the CS-104 guide, read from its branch (docs/design/product-voice.md section 7 and its copy-fa skill, which names what the lint owns): its translated, machine-written and register patterns as banned entries (only the narrow ones; its looser candidates are the reviewer's), and the rules semicolon, long-sentence (over 25 words), straight-quotes, ascii-ellipsis, range-hyphen and emoji. Kind comes from the object key, the JSX attribute or the element (lib/kinds.mjs, documented in the runbook); a button, label or title that ends with a full stop is a notice. Exemptions: inline copy-lint-ignore with a reason (covers the next statement, property or element; malformed, unknown or unused ones are errors) and allowlist.json (a reason required, stale entries are errors).

BASELINE: tools/copy-lint/baseline.json is (file, rule, count), one entry per line, in .prettierignore, and test/baseline-file.test.mjs fails if it is not exactly what the tool writes; pnpm check fails on a new violation or a worse count; --update-baseline only lowers (refuses and lists offenders otherwise); --baseline-rule <id> is the one way up, for a new or tightened rule. AREAS: tools/copy-lint/areas.mjs (globs per area, overrides, notes); pnpm copy:inventory writes docs/design/copy-rewrite-plan.md and pnpm copy:inventory --strings <area> prints the strings of one area for a lane evidence table; test/areas.test.mjs fails when a copy file is in no area or two, or when a glob is dead. Straddlers decided: notification kinds to C (26 of 36 strings; the five settings blocks go with it), model-info.ts to E, understanding messages (merge, understand, intents) to B, crawl-requests copy to C (D reads it), gauge-view rating names to B, pasted-link.ts to CS-115 with the check-a-link feature, hero alt JSON, route-errors and body types to A. AGENTS.md: net zero lines, now 148.

FOLLOW-UPS for the coordinator (none created, per the finalization guide): (1) CS-106 to CS-110 name the plan and the lint in their descriptions but depend only on CS-104: add CS-105 as a dependency. (2) The banned entries and the typography rules follow the CS-104 guide as of its commit 8d1c2b1 (read from the branch, not yet merged): after it merges, compare docs/design/product-voice.md section 6 and section 7 with data/banned-phrases.mjs and rules/typography.mjs; a change is a new entry or rule plus pnpm copy:lint --baseline-rule <id>. (3) AGENTS.md is at 148 lines. (4) pnpm check under a load average of 36 on 8 cores failed only on timeouts that have nothing to do with this change (three apps/web suites: filter-panel test timeouts and the two PGlite schema suites whose beforeAll passed its 10-second limit); filter-panel passes alone, and the schema suites are the ones vitest.config.mts already notes as load-sensitive.
<!-- SECTION:NOTES:END -->
