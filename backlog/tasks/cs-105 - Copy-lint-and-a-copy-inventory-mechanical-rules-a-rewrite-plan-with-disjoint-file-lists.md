---
id: CS-105
title: >-
  Copy lint and a copy inventory: mechanical rules, a rewrite plan with disjoint
  file lists
status: To Do
assignee: []
created_date: '2026-10-04 07:04'
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
