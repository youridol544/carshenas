---
id: CS-3
title: Define RTL and Farsi UI foundations and the design language
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 11:31'
labels:
  - design
  - i18n
  - frontend
milestone: m-1
dependencies:
  - CS-2
references:
  - docs/decisions/0005-styling-and-component-primitives.md
  - .claude/skills/ui-design/SKILL.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every screen is Farsi and right-to-left. Font, digit and date rendering, logical CSS, bidi handling of mixed content (VINs, URLs, Latin model names) and a base layout must be settled once so feature tasks do not each reinvent them. The ui-design skill refuses to invent a palette until docs/design/design-language.md exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Font choice and loading strategy are decided and documented, and the font is self-hosted
- [ ] #2 A number and date formatting utility renders Persian digits and Jalali dates in the UI and Latin digits in data, following CS-2
- [ ] #3 docs/design/design-language.md defines the tokens the ui-design skill reads (colour pairs with recorded contrast ratios, type roles with Persian line heights, spacing, radii, motion durations and the five deal-rating colours), and the token lint is switched on with those names
- [ ] #4 The not-found and error pages render Farsi copy with Persian digits in right-to-left layout and link back to the home page
- [ ] #5 A sample page renders correctly right to left on a phone-sized viewport, with visual baselines regenerated in the official container
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner decisions of 2026-09-26 (applied in CS-27; docs/research/2026-09-26-ui-craft-details.md, "Decisions taken by the owner"):
- Font: the owner will buy a commercial Persian font instead of Vazirmatn and choose it with Claude from options the owner brings. Check that its licence allows self-hosting on the web, and whether it allows modifying the font (patching vertical metrics needs that). The loading strategy (swap with preload, or optional) is decided together with the font, by measuring layout shift; Next.js's automatic fallback is Latin-only, so name Persian-capable fallbacks (globals.css already uses system-ui, Segoe UI, Tahoma, Geeza Pro, Noto Naskh Arabic).
- Weight 500 is allowed for 12 to 13 px labels if the font has it; Latin trim codes are judged on real listing titles with the bought font before adding any size-adjust face.

Findings from CS-26 and CS-27 to follow here (not owner decisions):
- Re-measure for the bought font with docs/research/2026-09-26-ui-craft-details/lab/: line heights per role (lab-equiv.js, lab-clip.js), label centring (lab-button.js), text-box trimming (lab-trim.js), stems for icon strokes (lab-stem.js) and vertical metrics (metrics.py). The ui-design craft.md section 7 values were measured on Vazirmatn and Estedad.
- Duration tokens use Tailwind's namespace (--transition-duration-*), or duration-* classes are not generated (ui-design motion.md).

CS-2 (2026-09-27, ADR-0014, proposed): the formatting utility of #2 has three amount forms. Full digits for every price and value («۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان»; stated amounts exact, estimates rounded to three significant digits); mixed words inside sentences («۱ میلیارد و ۲۵۰ میلیون تومان»); compact only on scales (notation compact, compactDisplay long, maximumSignificantDigits 3; ranges with «تا»; stop at «میلیارد»). Dates follow ADR-0014 point 5, always with timeZone Asia/Tehran; weekday and month-year forms are built from parts. Add a unit test that pins the runtime Intl persian calendar to the official leap list in docs/research/2026-09-27-money-and-jalali-calendar/lab/kabise-1206-1498.txt (CC0), so an ICU upgrade that moves a date fails CI. Recheck that the thousands mark U+066C looks like a comma in the purchased font. If this task adds React Aria date components, supply Persian strings: react-aria-components 1.21.1 has none.
<!-- SECTION:NOTES:END -->
