---
id: CS-104
title: >-
  Product copy voice: research, a normative guide, a Claude Code skill, a rule
  and a reviewer agent
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 07:57'
labels:
  - docs
  - frontend
dependencies: []
priority: high
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: much of the product text is fluffy, repeats itself, carries technical detail a buyer does not need, and reads like translated or machine-written Farsi. Example: the home intro «آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، ارزش بازار هر ماشین را حساب می‌کنیم و می‌گوییم قیمتش منصفانه است یا نه، با دلیل» should end simply «… می‌خوانیم و ارزش‌گذاری می‌کنیم»; the «بفهم» button; popovers full of thresholds. Research how good product copy sounds (voice, tone, brevity, no repetition, no filler), how to avoid AI-written copy in English and in Farsi, and how native Farsi microcopy reads; write the guide; give Claude Code the means to write and review copy against it. The copy lint and the inventory are CS-105; the rewrites are CS-106 to CS-110.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A cited research note in docs/research (at least 12 real sources: product and UX writing guidelines such as Mailchimp, Google, Apple, GOV.UK, Shopify Polaris, Atlassian; writing on the tells of machine-written text; Farsi UX writing and Persian style sources; and a read of how at least five Iranian products speak, such as Torob, Digikala, Snapp, Divar, Alibaba, Jabama, with quoted examples) ending in a voice and tone summary for Carshenas
- [ ] #2 A normative guide, docs/design/product-voice.md, with Farsi examples: the voice (a calm, direct expert friend), the form of address and verb forms, one idea per sentence, lead with the answer, buttons are verbs and labels are nouns, error and empty state patterns, the no-repetition rule, the no-technical-detail rule with a list of terms never shown to a buyer, when a number is worth showing, a list of Farsi machine-written and translated patterns with natives replacements, and at least 60 before and after rewrites taken from the product’s real strings
- [ ] #3 A Claude Code skill copy-fa (SKILL.md and references) that loads when UI text is written or reviewed, a path-scoped rule .claude/rules/copy.md attached to copy files, and a read-only subagent copy-reviewer that scores a diff’s strings against the guide with evidence; all are listed in .claude/skills/README.md, and AGENTS.md and the work and verify-ui skills each get one line pointing to them while AGENTS.md stays under 150 lines
- [ ] #4 The guide and the skill are tried on 20 real strings from the product and the results are in the note; pnpm check passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research note docs/research/2026-10-04-product-copy-voice.md: 12+ cited sources read (product and UX writing guides, tells of machine-written text, Farsi orthography and localisation guides, how Torob, Alibaba, Jabama, Snapp, Tapsi, Digikala and Snappfood speak), a measurement of the product's own strings, and a voice and tone summary. 2. Normative guide docs/design/product-voice.md: voice, address and register decision, sentence rules, element patterns, no-repetition and no-technical-detail rules with real lists, numbers, punctuation and half-space rules, a catalogue of Farsi machine-written and translated patterns, 60+ rewrites of real strings. 3. ADR-0042 records the voice and register decision. 4. Claude Code pieces: skill copy-fa (SKILL.md plus references), rule .claude/rules/copy.md, read-only agent copy-reviewer; README, AGENTS.md (in place, file stays under 150 lines), CLAUDE.md, work and verify-ui lines. 5. Try the guide and skill on 20 real strings not used as examples, record before and after and fix guide gaps found. 6. pnpm check, commit, finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (ADR-0042, accepted by delegation 2026-10-04): the voice is a calm, direct expert friend; address is شما, usually unsaid, with plain standard verbs (not the spoken تو forms Torob's store text, Tapsi and Jabama use, and not the written-formal forms); ما for what the product did, never من; one idea per sentence (about 15 words, never over 25), each idea once per screen (the screen is written and reviewed as one set), one word per idea (a words table and a verbs table in the guide); nothing a buyer cannot check or act on (a test plus a list of kinds, with real strings); a limit is a fact plus a way forward, never an apology. The ezafe stays ه‌ی (design-language.md) although the Academy writes ۀ: recorded as a divergence. Reconciled the owner's two popover requests: a number stays only when the buyer can check it on a listing (12 000 km per year of age), never the model's thresholds; the low-mileage popover had shown 20 000 and 12 000 side by side.

Options considered: the spoken تو register (friendlier on paper, mixed with شما on the same page by Tapsi and Jabama, grammar a lint cannot check); formal written (translationese, Microsoft's Persian guide replaces exactly those forms); a tone per page; leaving it to taste. A scan script lives in the skill's references (a reviewer's candidate generator, not a gate): CS-105 owns the lint and the inventory, so no lint script, inventory, product code or copy file was touched. The glossary was not edited: appendix A of the guide lists nine decisions the rewrite tasks need (ارزش‌گذاری, پایش, بسپارش, پیوند against لینک, مبلغ, قیمت کارشناسی, operational words, the middle dot, منطقه آزاد).

Evidence: 31 sources (41 pages) read 2026-10-04 with quotes marked raw or tool, including Microsoft's Persian style guide and the Academy's orthography (PDF text extracted); measurement of our 1,871 strings; 90 of 91 before-strings in the guide verified verbatim against the repository by script (the 91st, E60, is built from a conditional and was checked by eye); a trial of the guide and skill on 20 real strings not among the 91 (4 kept, 4 minor, 12 changed; words 269 to 195; the scan flags 8 of the 16 changed strings, a reader of the screen set found the rest) which changed the guide in four places; a fresh-context Farsi naturalness pass over the rewrites by a subagent.
<!-- SECTION:NOTES:END -->
