---
id: CS-115
title: >-
  Paste a link: say plainly when the car is outside our coverage, and let the
  buyer ask for it
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:05'
updated_date: '2026-10-04 08:23'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Matcher (packages/search/src/understand/title-car.ts): the car a Divar ad title names, read with the catalogue lexicon in code (model, make only, ambiguous, none); title read from the link slug, never fetched (SSRF). Measured on the real titles of the lane DB (6,792): report in docs/evidence/paste-link-coverage/. Curated alias for Persia (Peugeot Pars) in the worker alias file.
2. Link reader (apps/web/src/lib/pasted-link.ts): the divar_listing reading also carries the title slug; the canonical address keeps it (the answer page asks for the long form); callers (box, search field) pass the whole reading.
3. Coverage: covered = the model has a row in tracked_model_scope with trim null (decided from data: exactly the 10 tracked models have rated listings on 2026-10-04). Answer states: rated (+ off market), queued (covered car, ad not read yet), outside (car not covered: limit first, covered list, one action), unreadable (not a link, other site, not an ad, car not told from the link).
4. Database (migration): record_paste_request takes the model read from the title and counts paste demand for it, so model_demand sees pasted links of cars Carshenas never read; web role keeps EXECUTE only on the functions. The request action reuses the CS-71 mechanism (ADR-0036): the buyer own search file for the model is made or found, the crawl_request of the model is made or found, both in one transaction (askForModelFromLink), caps are the existing triggers (30 files, 10 waiting requests, 3 per file).
5. Server action askToAddModelAction: same-origin, session account, the link is read again on the server (the model comes from the link, never from the client; a make-only link names the model through a chooser validated against the make), coverage re-checked, one transaction; a visitor is asked to sign in and returns to the same answer (the press is remembered in sessionStorage of the tab, then placed once on arrival: a crafted link places nothing).
6. UI and copy: the whole feature rewritten to the voice rules of the brief (box, hero paste tab, /check page, four states, errors, skeleton); request state shown (placed, accepted, declined with reason), the action never offered twice.
7. Admin: /admin/crawl-requests demand per model also counts the pasted links (model_demand) and lists models with pasted links nobody asked for.
8. Tests: unit (matcher, link reader), schema and db tests (record_paste_request, askForModelFromLink, caps), Playwright phone and desktop on a production build (four states, unsupported model slug, signed-in and visitor flows, nothing requested from Divar), screenshots opened and described, craft checks; pnpm check and pnpm db:check; docs: data-model, ADR-0046, spec notes, glossary, learnings.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 slice 1 (matcher, reader, migration). Decisions: (1) covered = the model has a tracked_model_scope row (state tracking) for the whole model; data on 2026-10-04: exactly the 10 tracked models have rated listings (valuation_segment.rates_listings), so tracked and rated are one set; a paused model or one tracked only through a trim is not covered. (2) The car is read from the title in the link by the catalogue lexicon (packages/search/src/understand/title-car.ts), never fetched: on the 6,802 real titles of the lane DB the right model is read for 83.7 percent, a wrong model for 0.2 percent (accuracy 99.8 percent where a model is named), only the make for 11.7, nothing for 4.0, ambiguous 0.4. Persian model names exist for 12 of 807 catalogue models, so an uncovered car is mostly named by its make (a make with no covered model settles the question: outside coverage; a make with some covered models does not: the car is not told). (3) record_paste_request takes the title model and counts paste demand for links whose ad was never seen (migration 20261004072825). (4) The lane DB holds three migrations of the CS-99 branch that this branch lacks, so db/schema.sql is patched by hand from a dump, not regenerated; pnpm db:check compares it with a clean replay.

2026-10-04 slice 2 (answers, ask, admin, tests). Decisions beyond ADR-0046 (recorded there): (a) the coordinator brief says a slug that matches no model is unreadable; a title that names only a MAKE none of whose models is read is outside coverage instead (whatever the model is, it is not read), with a chooser of the make models, because with Persian names for 12 of 807 models almost every uncovered car would otherwise be called unreadable, which is what the owner complained about; a make some of whose models are read stays unreadable (make_only). One line in apps/web/src/features/check-link/car-reading.ts reverts it. (b) The ask makes the buyer own search file for the model with the CS-71 request (no new table): demand, notices and the buyer card already hang on files. (c) The visitor press is remembered in the tab sessionStorage and placed once on return (a crafted link places nothing). (d) The models of a make the viewer already asked for or that were declined are shown with their state and not offered again. (e) Copy is written to the voice rules of the brief; docs/design/product-voice.md (CS-104) and pnpm copy:lint (CS-105) are not merged in this branch, so conformance to them is to be re-checked after those merge. (f) search-field.tsx (search page box) passes the whole link reading to canonicalDivarAddress so the title survives: one line; if CS-111 rewrites the box it must keep passing the reading, not only its token. Evidence so far: matcher 6,802 real titles (docs/evidence/paste-link-coverage/2026-10-04/), unit tests (title-car 14, car-reading 7, link reader 20, ask component 11, admin demand 3), db tests (ask-from-link 5, check-link-queries 15) on a replayed scratch database, schema test for record_paste_request, EXPLAIN plans (all under 1 ms except the admin sum, 20 ms at 24k rows, 23 ms at a year of history, served by the existing unique key).
<!-- SECTION:NOTES:END -->
