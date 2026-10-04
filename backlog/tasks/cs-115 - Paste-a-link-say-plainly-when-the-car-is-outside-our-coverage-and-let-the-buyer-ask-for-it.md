---
id: CS-115
title: >-
  Paste a link: say plainly when the car is outside our coverage, and let the
  buyer ask for it
status: To Do
assignee: []
created_date: '2026-10-04 07:05'
labels:
  - frontend
  - backend
dependencies:
  - CS-65
priority: high
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: when the pasted link is for a car we do not support, the answer must say so clearly. Today the copy makes the buyer feel the paste feature does not work properly. Show the limit as a limit (these are the cars we cover, this one is not among them) and the way forward (ask us to add this model). A Divar link carries the title of the ad in its address, so the car can often be read from the link by code, with no request to Divar. This task owns the whole check-a-link feature, its copy included (CS-106 leaves it out).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The answer to a link has four clearly different states, each in plain product voice and none that suggests the feature is broken: the ad is known (the rating), the car is one we cover but this ad is not read yet (it is queued and the buyer is told when to look again), the car is outside our coverage (the limit is stated first, with the short list of cars we cover), and the link cannot be read (what a Divar ad link looks like, with an example)
- [ ] #2 For an ad we have not seen, the car is read from the title in the link address by the catalogue name matcher in code, with no request to Divar or any site, and the answer names the car when it can; whether the model is covered is decided from the tracked models, and a car that cannot be matched is treated as the unreadable-link state, not as unsupported
- [ ] #3 For a car outside our coverage the buyer can ask us to add the model with one action: a signed-in buyer raises a crawl request for that model (the CS-71 requests, shown to the superadmin with the demand counted per model), a visitor is asked to sign in and comes back to the same answer with the request placed; the answer then shows the request state (placed, accepted, declined with the reason) and never offers the action twice
- [ ] #4 The whole feature’s text (the box, the four states, the errors) is written to the product voice guide of CS-104, with no technical wording, no repetition between heading, lead and button, and no sentence that sounds like an apology for a fault; the wrong-site message says only that we read Divar ads for now
- [ ] #5 Phone and desktop Playwright tests cover the four states, an unsupported model slug, the request flow for a signed-in buyer and a visitor, and that nothing is requested from Divar; pnpm check passes; the docs and the feature’s spec notes are updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
