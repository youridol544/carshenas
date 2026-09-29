---
id: CS-82
title: Switch an AI task to its fallback model while its provider is down
status: To Do
assignee: []
created_date: '2026-09-29 18:02'
labels:
  - backend
  - ai
milestone: m-3
dependencies:
  - CS-45
  - CS-46
references:
  - docs/decisions/0019-reach-language-models-through-metis-ai.md
  - docs/decisions/0021-ai-layer-on-the-ai-sdk.md
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0019 point 4 says that after a configured outage the AI layer may switch a task to a fallback model that CS-46 names for it, from the other models Metis serves: another provider model when one upstream fails, or Sotoon Gemma 3 27B when every foreign provider is unreachable. The answer is validated the same way, and the switch shows in the logs and in the result; metis-gpt is never used. ADR-0019 gave this switch to CS-45, but on 2026-09-29 the owner moved it to its own task after CS-46, because until CS-46 names the fallbacks there is nothing to switch to or to test against. CS-45 leaves a fallback slot in the registry of packages/ai and logs which model answered. Worker jobs retry provider errors through the queue (ADR-0018, ADR-0019 point 4), so the switch decides which model the next attempt uses; it is not a second retry loop.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When the primary model of a task has failed with provider errors for longer than a configured outage window, the layer sends that task to its fallback model, and back to the primary once the primary answers again
- [ ] #2 A fallback answer passes the same schema, checks and re-ask as a primary answer, and the result and its log line say that the fallback answered and why
- [ ] #3 A task without a fallback, or whose fallback also fails, keeps failing with the provider error so the queue retries it, and metis-gpt can never be configured as a fallback
- [ ] #4 Tests with mock models and no network cover the switch, the return to the primary and the task without a fallback
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
