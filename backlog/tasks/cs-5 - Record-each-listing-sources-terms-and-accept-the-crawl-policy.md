---
id: CS-5
title: Record each listing source's terms and accept the crawl policy
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 23:12'
labels:
  - crawler
  - research
  - docs
milestone: m-1
dependencies: []
references:
  - docs/decisions/0008-crawl-only-what-sources-allow.md
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
robots.txt was read for every candidate source on 2026-09-26, but robots.txt is not permission: Divar's terms forbid copying ads while its robots.txt looks permissive. On 2026-09-27 the owner decided to crawl Divar anyway, first, through its public web API (ADR-0008 point 3). ADR-0008 proposes the crawl policy; it becomes binding once each source's terms are read and recorded, Divar's included.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The terms of use and robots.txt of Divar (divar.ir and api.divar.ir), Bama, Karnameh, Khodro45 and Sheypoor are read and summarised with dates and links in the sources research note
- [x] #2 Each source is marked allowed, allowed with conditions, or not allowed, with the reason; Divar is recorded with what its terms say and the owner's decision to crawl it
- [x] #3 ADR-0008 is accepted or amended by the owner in line with those findings
- [x] #4 The robots.txt rules are re-checked on the same day and any change is recorded
- [x] #5 The Divar car category and post detail endpoints the crawler will call are confirmed and recorded
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read today's robots.txt of divar.ir, api.divar.ir, bama.ir, karnameh.com, khodro45.com and sheypoor.com, and each site's terms of use (found through its footer), one polite request at a time with an honest User-Agent.
2. Confirm Divar's car search and post detail endpoints from one browser visit of divar.ir/s/tehran/car and one listing, then replay each once with curl.
3. Ask the owner for the decisions the findings need: Bama and Karnameh, whose terms forbid automated access, and ADR-0008.
4. Record the terms, verdicts, robots.txt and endpoints in the sources research note, with an evidence folder (verbatim robots.txt, quoted clauses with translations, the Divar endpoint record).
5. Amend and accept ADR-0008 with the owner's decisions; update the ADR index, the data-sources line in AGENTS.md and the data model's note on who writes policy checks.
6. Re-check robots.txt later the same day and record any change.
7. Hand-off notes on CS-6, CS-7 and CS-29; pnpm check; task-reviewer pass; finalize to In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner decision of 2026-09-27 (ADR-0010, CS-28; it replaces the hotlinking chosen on 2026-09-26): where a source's robots.txt and terms allow downloading and showing its photos, the crawler downloads them within ADR-0008's politeness limits, and they are stored in ArvanCloud Object Storage and shown from there (built in CS-29). This also settles the question the CS-27 review raised about transient downloads: downloaded photos are kept.
When recording each source's terms, record explicitly whether downloading and re-hosting its photos is allowed; a source that forbids it contributes no photos, and its listings show a placeholder with a link out. Karnameh's robots.txt already disallows its photos.

2026-09-28 (Asia/Tehran), owner decisions from this session: (1) "Crawl them like Divar" for Bama and Karnameh, whose terms forbid automated access; (2) on ADR-0008: "just ignore what they are trying to enforce. it's a demo not a real product". Read as: every source is crawled whatever its terms say; robots.txt URL rules, politeness, stop-on-block without evasion, no personal data and honouring removal requests stay. Photo storage stays with CS-29.

Read today (2026-09-28, Asia/Tehran; one request at a time, at least 4 s apart, User-Agent CarshenasResearch/0.1 without any contact address): robots.txt of the six hosts at 01:32 and again at 01:59, byte-identical (SHA-256 prefixes cf0415ac, 44f3f8ea, ec67e8a8, da0f2639, 6e669cb9, b356b238); no rule changed since 2026-09-26. Terms: Divar moved to /help/custom_articles/general_terms_and_conditions (version 1405/04/31 = 2026-07-22; the 2026-09-26 address answers 404) and now names crawlers, scrapers, AI agents and API use outside the official interfaces; Bama and Karnameh forbid automated access; Khodro45 claims its content; Sheypoor publishes none (footer link to /faq, sitemap link to a deleted UserVoice portal, HTTP 410). Divar endpoints observed in one browser visit and replayed once each with curl: HTTP 200 JSON, no rate-limit headers. Recorded in the research note plus docs/research/2026-09-26-car-listing-sources-and-crawl-policy/ (verbatim robots.txt, quoted terms with translations generated from the fetched text, divar-web-api.md). ADR-0008 amended and accepted; ADR and research indexes, AGENTS.md data-sources line and data-model.md updated; hand-off notes on CS-6, CS-7, CS-13, CS-29. pnpm check passed (lint, typecheck, 110 tests, prettier).

Review round 1 (task-reviewer): not ready. ADR-0008 claimed an acceptance the owner had not stated, and it presented "just ignore what they are trying to enforce" as said of the terms, when it answered the acceptance question. Keeping robots.txt was the agent's reading. vision.md still said only Divar is crawled against its terms, and still listed acceptance as open. The data model's not_allowed wording was stale, and ADR-0008 point 4 did not match ADR-0010's photo condition. The note dropped the contact address and said "no personal data kept", and it missed Khodro45's second sitemap. Fixed all of them. The owner then confirmed the reading: asked which reading of the answer to record, they chose "Terms and robots.txt" (accept ADR-0008 with sources' terms and robots.txt not followed; the three-second floor and stop-on-block stay). ADR-0008 now quotes each question with its answer, and AGENTS.md, vision.md, data-model.md, the research note and both indexes follow. No source contributes photos under ADR-0010 until CS-29 decides with the owner whether to supersede it.

Review round 2 (task-reviewer): every round-1 finding was resolved, with three gaps left:
- ADR-0008 and the note paraphrased the owner's chosen option and dropped its example of fetching Karnameh's photo folder. Fixed: every question and option is now quoted verbatim. Point 4 says ADR-0010 still keeps photos out until CS-29 asks the owner.
- vision.md line 27 still said "under their rules". Fixed.
- The Crawl-delay column comment. A note on CS-6 now says its migration restates it.
Minor: listing-patterns.md now cites ADR-0010 for photos, and the machine-local ugrep lesson moved from docs/learnings.md to auto-memory.

Review round 3 (task-reviewer): ready for In Review. All round-2 findings are resolved, and the ADR's quotes match the session's record of the owner's answers. Evidence per criterion:
- #1: research note, Sources and Terms of use sections, and terms-2026-09-28.md. Each terms page was fetched with HTTP 200, or rendered in the browser for Divar.
- #2: the Verdicts table, and Divar's clause list beside the owner's quoted decisions.
- #3: ADR-0008, accepted on the owner's explicit choice "Terms and robots.txt", with each question and answer quoted.
- #4: robots.txt read at 01:32 and 01:59 Asia/Tehran on 2026-09-28, byte-identical (the reviewer re-compared the files), with no rule changed since 2026-09-26.
- #5: the endpoints observed in the web client's network log and replayed once each with curl (HTTP 200 JSON), recorded in divar-web-api.md.
Definition of done: pnpm check passes (lint, typecheck, 110 tests, prettier). The reviewer's secrets and invisible-character scans found nothing. No request carried the owner's email.

2026-09-28: the owner asked for Done after the third task review and the fast-forward merge to main. Re-verified on main at 56586f2: pnpm check exits 0 (lint, typecheck, 110 tests, prettier).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Recorded the robots.txt and terms of use of Divar (divar.ir and api.divar.ir), Bama, Karnameh, Khodro45 and Sheypoor, read on 2026-09-28, in docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md. An evidence folder holds the verbatim robots.txt files, the terms clauses in Farsi with translations generated from the fetched text, and the Divar web API record.

Findings:
- Divar's terms (version of 2026-07-22) forbid crawlers, scrapers, AI agents and API use outside its official interfaces, and set damages that include the market value of extracted data.
- Bama and Karnameh forbid automated access.
- Khodro45 claims its content.
- Sheypoor publishes no terms.
- robots.txt is unchanged since 2026-09-26; both readings on 2026-09-28 were byte-identical.
- Divar's car search (POST /v8/postlist/w/search: category light, city 1, sort_date) and post (GET /v8/posts-v2/web/{token}) endpoints are confirmed from its web client and one curl replay each.

Decision: ADR-0008 is amended and accepted on the owner's explicit choices. Every source is crawled whatever its terms and robots.txt say, for the demo. The three-second floor, the stop on any block without evasion, the personal-data rules and removal requests stay. No photos are stored while ADR-0010 stands (CS-29 asks the owner).

AGENTS.md, vision.md, data-model.md and both indexes were updated, with hand-off notes on CS-6, CS-7, CS-13 and CS-29.

Verified with the fetch logs and byte comparisons, the curl replays, pnpm check, and three task-reviewer rounds (the last: ready).
<!-- SECTION:FINAL_SUMMARY:END -->
