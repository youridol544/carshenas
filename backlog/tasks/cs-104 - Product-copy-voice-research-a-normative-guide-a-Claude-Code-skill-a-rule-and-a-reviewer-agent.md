---
id: CS-104
title: >-
  Product copy voice: research, a normative guide, a Claude Code skill, a rule
  and a reviewer agent
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 07:29'
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
