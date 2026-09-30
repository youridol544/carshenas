---
id: CS-84
title: 'Version a task render in the prompt version, as checks are'
status: To Do
assignee: []
created_date: '2026-09-30 10:53'
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
- [ ] #1 A task declares a version for its render, and changing that version changes the task prompt version, so its cache keys and the evaluation it needs change with it
- [ ] #2 Tests show the prompt version changing with the render version and staying the same when only the model, the timeout, the re-asks or provider caching change
- [ ] #3 The example task in packages/ai/src/examples/ and the test-support task declare a render version, and their snapshots are refreshed
- [ ] #4 The ai-layer runbook, the ai-features skill and the rule pack say when to change the render version, and no longer describe a render change as invisible to the prompt version
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
