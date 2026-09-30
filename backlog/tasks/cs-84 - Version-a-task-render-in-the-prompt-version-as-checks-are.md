---
id: CS-84
title: 'Version a task render in the prompt version, as checks are'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-30 10:53'
updated_date: '2026-09-30 16:11'
labels:
  - ai
milestone: m-3
dependencies: []
references:
  - docs/runbooks/ai-layer.md
  - .claude/skills/ai-features/references/prompting.md
priority: high
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-47 task review (2026-09-30) found that promptVersion in packages/ai/src/task.ts hashes the instructions, the schema, the checks version and the output budget, but not render, the function that turns an input into the text the model reads, nor the text cleaning it calls. The answer cache key includes the rendered input, so no stale answer is reused, but the rule that a step ships only with an evaluation at its current prompt version (AGENTS.md AI steps, .claude/rules/ai.md rule 4) cannot see a render or cleaning change: the version stays, and an old evaluation would seem to cover the new prompt. Today only the rendered-prompt snapshot and the ai-reviewer catch it. The owner decided on 2026-09-30 to close the gap in the layer, the way checks.version versions checks, before CS-52 writes the first product task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A task declares a version for its render, and changing that version changes the task prompt version, so its cache keys and the evaluation it needs change with it
- [x] #2 Tests show the prompt version changing with the render version and staying the same when only the model, the timeout, the re-asks or provider caching change
- [x] #3 The example task in packages/ai/src/examples/ and the test-support task declare a render version, and their snapshots are refreshed
- [x] #4 The ai-layer runbook, the ai-features skill and the rule pack say when to change the render version, and no longer describe a render change as invisible to the prompt version
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a required renderVersion to Task, refused when empty by defineTask, and hash it into promptVersion beside checks.version. 2. Declare it on every task: listing.facts, the example, the test-support task, the worker's db test task, pass-through and the four bake-off tasks. 3. Tests: the version changes with renderVersion and not with a new render function under the same version, nor with model, timeout, re-asks or provider caching. 4. Refresh snapshots and read the diff (only promptVersion lines). 5. Runbook, skill, prompting and review references and the rule pack say when to bump it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done in lane H on 2026-09-30 (CS-52 lane, by the owner's decision to finish CS-84 before CS-52's paid evaluation). Task.renderVersion is required; defineTask refuses a blank one; promptVersion hashes it. Snapshot diffs are the promptVersion line only: listing-condition 8d528d29f251d4d6 -> 3b0b4dc0dfee4534, example listing-paint 0bd8b09274632ecf -> 580655d32ff10f1c, listing.facts 51bbb4bfeb28f386 -> 47b40f8ea86220ca. Evidence: pnpm --filter @carshenas/ai test 158 pass (task.test.ts: changes with the render version; stays under the same render version with a new render function; stays with model, timeout, re-asks, provider caching; a blank render version is refused); worker tests pass; pnpm check passes except the web package's two PGlite schema suites, whose beforeAll timed out at 10 s under load average 15 from the three lanes; run alone, pnpm --filter @carshenas/web test passes 198 of 198. Docs: docs/runbooks/ai-layer.md, .claude/rules/ai.md rule 4, ai-features SKILL.md rule 4, references/prompting.md and review.md.

Correction (task-reviewer, 2026-09-30): the note above swapped two hashes. The test-support listing-condition task went 0bd8b09274632ecf -> 580655d32ff10f1c, and the listing-paint example went 8d528d29f251d4d6 -> 3b0b4dc0dfee4534. Non-blocking follow-ups, as notes and not work: nothing forces a renderVersion bump when render, modelCopy or asData change (the rendered-prompt snapshot and references/review.md catch it; a later lint could tie a hash of listing-text.ts to the declared versions); listing.facts and the listing-paint example share listing-tags-1, so a change to the shared cleaning bumps both.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task.renderVersion is required and hashed into promptVersion beside checks.version, so a render or text-cleaning change bumps the prompt version, its cache keys and the evaluation it needs. Every task declares one. Verified by task.test.ts (changes with the render version; stays with model, timeout, re-asks, provider caching; blank refused), refreshed snapshots whose only diff is the promptVersion line, and the package's 158 passing tests. Left In Progress for the coordinator's review.
<!-- SECTION:FINAL_SUMMARY:END -->
