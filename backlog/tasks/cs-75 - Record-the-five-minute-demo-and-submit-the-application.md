---
id: CS-75
title: Record the five-minute demo and submit the application
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 20:09'
labels:
  - demo
milestone: m-6
dependencies:
  - CS-64
  - CS-65
  - CS-37
references:
  - docs/product/challenge.md
  - docs/research/2026-09-28-torob-challenge-expectations-and-field.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
priority: high
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The challenge is judged on a demo of at most five minutes showing the problem, the product and the important decisions (docs/product/challenge.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The video is at most five minutes and 200 MB, or hosted at a link the reviewers can open
- [ ] #2 The application is submitted with the video, the project link and contact details, and the submission date is recorded on this task
- [ ] #3 A script covers, within five minutes: the problem; a plain-Farsi search; a listing with its explanation and its cheaper copy elsewhere; a pasted live link; how fresh the index is; the pipeline with its measured accuracy, valuation error and duplicate precision; and the key decisions, the data decision among them
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28: the storyboard, the map from Torob's ten search problems to Carshenas and the reviewers' checklist are in docs/research/2026-09-28-torob-challenge-expectations-and-field.md and docs/product/challenge.md. Record on the live site in one sitting, choosing the example cars that day, since listings change hour to hour. Show that it is live: a Divar listing posted that day pasted in, and the status page. The numbers quoted come from a frozen release (CS-49), which is also the fallback if a source blocks on the recording day. Recording the whole walkthrough on a frozen copy would show stale "last checked" times. The submitted link is the live site. Criterion 1 was reworded and is now listed last. Use the form's optional notes field for the measured numbers and the repository's map.

2026-09-28, from the field survey:
- Upload the video to the form (up to 200 MB) or put it on Aparat; never YouTube, which is filtered in Iran.
- khodrobin's roadmap plans a 4:50 video: the same car on three sites, an evaluation run on camera, a prompt-injection test, on Aparat. Carshenas's storyboard covers all three, plus freshness, removals and a rating for each listing, which it lacks.
- Its hand-off note speaks of "a 300-person challenge" with "submission 20 Sep" (unverified). Torob's page showed no deadline on 2026-09-28. Consider asking Torob whether submissions are reviewed in batches, and submit as soon as the demo path works.

2026-09-28: in the video and the notes, describe the crawling as it is: polite, bounded, stopping on any block, with no personal data. Never claim that it follows robots.txt or the sources' terms, because ADR-0008 records them but does not follow them for the demo. The field survey flagged this as the easiest way to lose a reviewer's trust.

Before submitting, make the repository public (CS-36), after the checks in its notes.

Renumbered on 2026-09-29: this task was CS-24 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-24; the archived CS-24 points here.

The owner's product plan of 2026-09-29 adds the product working for the buyer. The storyboard can show «بسپارش به کارشناس»: a search file created, its crawl request approved in the superadmin section, and a new match arriving in the inbox (CS-68 to CS-72).

Owner, 2026-09-30: skipped for now in the CS-58 to CS-75 run (CS-60: no Arvan storage, pages use Divar image addresses directly; CS-74: no other sources than Divar; CS-75: no video or submission yet).
<!-- SECTION:NOTES:END -->
