---
id: CS-107
title: >-
  Copy rewrite B: search, filters, understanding chips, the listing page, result
  cards and mileage notes
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 10:30'
labels:
  - frontend
  - docs
dependencies:
  - CS-104
  - CS-105
priority: high
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: rewrite the product copy to the voice guide (CS-104). Area B files are those listed for area B in docs/design/copy-rewrite-plan.md (CS-105): the search page and filter panel, catalogue and chip texts, empty and no-results states, the understanding messages, the listing page (facts, price analysis, explanation templates, condition notes, risks, comparables, history), result cards and the assumed-mileage notes. The listing explanation is generated from templates: rewrite the templates, keep every number sourced from the database, and keep the faithfulness test passing. Take care not to change component structure: another lane (CS-111) changes the smart search flow in parallel; merge main often and keep to strings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every string in the area’s files is reviewed against the product voice guide (CS-104) and either rewritten or kept with a recorded reason; a before and after table with the counts (reviewed, changed, kept) is written to docs/evidence/copy/ for the area
- [x] #2 No technical or internal detail is left in buyer-facing text (thresholds of the model, parser or version names, internal ids, English technical terms, how the data is stored); where a rule has to be explained, its info control says it in one or two plain sentences, and the rest is removed
- [ ] #3 No repetition: the same fact is not said twice on one screen (title, lead, hint, button and notice are audited together), and one idea uses one word everywhere (the glossary); no filler, no marketing adjectives, no exclamation marks, no sentence that is not native Farsi
- [ ] #4 The copy lint (CS-105) passes with no new allowlist entry, a pass of the copy-reviewer agent leaves no blocking finding, and screenshots of the changed screens at 412 and 1440 are looked at and described
- [ ] #5 Tests that match text use the central copy constants or are updated without weakening an assertion; pnpm check and the affected Playwright specs pass on phone and desktop
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the voice guide, the copy-fa skill, the rule, the glossary, the rewrite plan and every Area B file; list every string of each screen as one set (search page, filter panel and sheet, understanding notes, result cards, listing page, explanation templates). 2. Per screen: keep one string per idea, delete repeats and dead keys, cut every technical detail (thresholds, windows, versions, methods, model and queue words), one word per idea, plain native Farsi, no first person, a limit as a fact with a way forward. 3. Apply the words through a script that writes half-spaces from a placeholder, never touching component structure; keep every placeholder, number formatter and key (a key is removed only when nothing in the repository reads it). 4. Explanation templates: rewrite the sentences, keep figure() for every number still quoted and update the two unit tests that asserted the removed technical numbers. 5. Switch tests that match text to the new wording or the constants. 6. Targeted checks only: copy:lint on the files, prettier, vitest of the listing, search and understanding folders, tsc for apps/web once. 7. Evidence in docs/evidence/copy/area-b.md: counts, every changed string old to new by screen, kept strings with reasons, a list for other areas.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done on branch cs-107-copy-b; evidence with every changed string old to new, grouped by screen, the kept strings with reasons and the follow-ups: docs/evidence/copy/area-b.md. Numbers: 408 strings reviewed, 245 kept, 129 rewritten, 34 removed (31 that nothing in the repository reads, 2 popover headings, 1 line the page never showed); 368 after. Lint: 20 violations to 0, 102 warnings to 5 (each read and kept, reasons in the evidence); no allowlist entry, no ignore comment, and the shared baseline file is not touched (the coordinator regenerates it).

Decisions. (1) Explanation templates: every number that belongs to the method (the 30-day window, the 20000 km yearly norm, the method number, 8 listings, 3 within 2 years, 15 percent, 20 percent, 3 times) is cut from the sentence and from its figure() call, and the two unit tests that asserted those numbers were changed; every number still written is still a recorded figure, so the faithfulness check (every digit group in the text is a figure) holds. The market value and its date are not repeated in the sentences, because the gauge box above shows them. (2) A key is removed only when an alias-aware search of the whole repository, tests and e2e included, finds no reader; a key another area renders (SEARCH_COPY.error.body on the home page) stays and only its render in my own component goes. (3) Info control headings: the guide asks for none and the builder (info-content.ts, area E) passes them, so I changed their words only, and removed the two headings of the rating popover, which I own. (4) The shared words this task settled (نتایج for results, فیلتر never شرط, اعلام کرده for what the seller declared, قیمت شروع, آگهی اصلی, کاراکتر) are listed in the evidence for the guide section 4 and are not added to the guide here, so that five lanes do not edit one table.

Verification. copy:lint on the 20 files: 0 violations, 5 warnings. vitest (listing, search, search-understanding, home, ui, search-sentence): 265 pass, 3 fail in applied-chips.test.tsx (ResizeObserver is not defined in jsdom, from the scroll rail of CS-112), and they fail identically without my changes (checked with a stash). node --test for all of packages/search/src: 132 pass. tsc: apps/web, packages/search and e2e are clean. Not run, by the owner rule of 2026-10-04: Playwright and the e2e specs (twelve specs and one fixture were updated as code), pnpm check, the screenshots at 412 and 1440, and the copy-reviewer agent (a lane cannot start it); a self-review with the copy-fa scan found four hits, all judged. Acceptance criteria 4 and 5 stay unchecked for that reason.

After merging main (CS-115, CS-122, CS-123): the conflicts were docs/learnings.md (both lines kept) and e2e/tests/app/check-link.spec.ts (main version taken: that spec now words the similar-listings heading from the check-link copy, so my one-line edit was not needed). Unit tests of the listing, search, search-understanding, check-link, home and ui folders: 310 pass in 41 files; the three applied-chips tests that failed before are fixed by the jsdom ResizeObserver stub that main now has. copy:lint: nothing new or worse than the baseline. No merged code reads a key this task removed (alias-aware search).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Area B copy rewritten to the voice guide, strings only. 408 strings reviewed: 245 kept with a recorded reason, 129 rewritten, 34 removed (31 that nothing reads, 2 popover headings, 1 never-shown line); copy lint 20 violations to 0 and 102 warnings to 5 (each read and kept). Technical detail is gone from buyer text: thresholds, the 30-day window, the yearly norm, the method number, queue, crawler, model and system words, and the first-person verbs of the understanding notes. The explanation templates keep their structure: every number still written is a recorded figure, the numbers that belonged to the method were cut with their figure() calls, and the two unit tests that asserted them were changed. Word-level edits only, plus these small code edits listed in the evidence: the paragraph that rendered error.body on the search page, the comparables toggle count, four middle-dot joins, dead imports, an exported NOTE_TEXT so tests read the words from it. Verified: copy:lint 0 violations, vitest 265 pass (3 fail in applied-chips.test.tsx, identical without my changes, ResizeObserver in jsdom), node --test packages/search 132 pass, tsc clean for apps/web, packages/search and e2e. Not verified here, by the owner rule of 2026-10-04: Playwright and the twelve e2e specs I updated as code, pnpm check, screenshots at 412 and 1440, and the copy-reviewer pass; so criteria 3, 4 and 5 and the first Definition of Done item stay unchecked (criterion 3 also because a few repeats need a structure change: days on market on the listing page twice, the end-of-list line beside the count; both are in the follow-ups). Evidence: docs/evidence/copy/area-b.md.

After merging main: 310 unit tests pass in 41 files in the folders above (the applied-chips failures were fixed by main ResizeObserver stub); the check-link spec was taken from main.
<!-- SECTION:FINAL_SUMMARY:END -->
