---
name: adr
description: Write or update an Architecture Decision Record in docs/decisions (next free number, template, index row) and link it from the relevant Backlog task. Use whenever a binding decision is made or proposed about stack, data model, money/date handling, infrastructure, integrations, or process.
argument-hint: "<decision title> [accepted|proposed]"
---

# /adr — record a binding decision

Decision: $ARGUMENTS

Existing records:

!`ls docs/decisions/ 2>/dev/null || true`

1. Pick the next number (four digits) and a kebab slug: `docs/decisions/NNNN-slug.md`.
2. Copy `docs/decisions/0000-template.md` and fill every section: context (forces, constraints, cost of doing nothing), the decision in one plain paragraph, alternatives with the reason each lost, consequences, follow-up tasks. Keep it to one screen; long analysis goes to `docs/research/` and is linked.
3. Status is `proposed` unless the user explicitly accepts it. Never edit an accepted ADR's decision; write a superseding one and cross-link both.
4. Add a row to the index table in `docs/decisions/README.md`.
5. Link it from the task that triggered it: `backlog task edit CS-N --ref docs/decisions/NNNN-slug.md`, and mention the constraint in `AGENTS.md` only if every future task must respect it (keep `AGENTS.md` short).
6. Report the path and status in one line.
