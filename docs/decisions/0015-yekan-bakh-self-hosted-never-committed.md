# ADR-0015: Set every screen in Yekan Bakh, self-hosted through next/font/local, and never commit the font

- Status: proposed (the owner chose and bought the font on 2026-09-27; the loading strategy and the file handling await review)
- Date: 2026-09-27
- Deciders: Pedrum (with Claude Code)
- Related: CS-3, ADR-0003, ADR-0005, ADR-0014; `docs/research/2026-09-27-persian-typeface.md`; `docs/design/design-language.md`; `docs/runbooks/licensed-font.md`

## Context

- **The owner's decision.** On 2026-09-26 the owner decided against the free Vazirmatn and asked for a commercial Persian font chosen from fontiran.com.
- **What the font carries.** Every Carshenas screen is Farsi and dense with numbers: full-digit prices, percentages, Jalali dates, and Latin trim codes and VINs inside Persian text. The font therefore has to be legible at 12 to 16 px on mid-range Android phones, with good Persian digits and a Latin that sits well beside Persian.
- **The licence.** Fontiran's terms, read in the delivered package on 2026-09-27:
  - A purchase grants no right to copy, distribute or modify the files, except backups.
  - Web use needs a licence registered per site.
  - The package is prepared for its buyer and identifies them, so a shared copy is traced to the owner.
- **Where the code will go.** The repository may be published or shared with reviewers (CS-21), and its CI uploads Playwright traces, which record fonts, as artifacts (`.github/workflows/e2e.yml`).
- **Constraints from earlier decisions.** Services must work from inside Iran (ADR-0003's market constraint), and `next/font/google` would download at build time.

## Decision

1. **One family: Yekan Bakh 4** (Reza Bakhtiarifard and Mahan Jafarzadeh, Fontiran), package «حرفه‌ای».
   - The app uses only its variable web font, `YekanBakh-VF.woff2` (weights 100 to 950, 69,304 bytes), for Persian, Latin and digits.
   - No second font, and no FaNum build: digits are real Persian digits from `Intl` (ADR-0014).
2. **Self-hosted through `next/font/local`**, called once in `apps/web/src/components/layout/app-font.ts` and applied to `<html>` as a CSS variable that Tailwind's `--font-sans` reads.
   - **`display: 'swap'` with preload.** On the production build, a font response delayed by up to 300 ms caused no layout shift, and one delayed by 1.5 s caused at most 0.033.
   - **Not `optional`.** `optional` kept the fallback for the rest of a visit after a slow first load.
   - **`adjustFontFallback: false`, with Persian-capable fallbacks:** `system-ui`, Segoe UI, Tahoma, Geeza Pro, Noto Naskh Arabic and `sans-serif`.
3. **Served exactly as delivered.** No subsetting, conversion or patched metrics, because the licence forbids changing the file. Corrections happen in CSS: line heights per role, and a `size-adjust` face if one is ever needed.
4. **Never committed.**
   - `.gitignore` ignores every `*.ttf`, `*.otf`, `*.woff` and `*.woff2`.
   - Each machine gets the file as `docs/runbooks/licensed-font.md` says, from the owner's Fontiran account.
   - Worktrees hard-link it from the main checkout.
   - A build without the file fails, rather than silently shipping the fallback.
5. **Web licence before anyone else can reach the site.** The owner registers a «وبسایت یا نرم‌افزار شخصی» licence for the demo's name and address before it is deployed (CS-23), or a company licence once a company runs it.

## Alternatives considered

- **IRANSans X** (Fontiran; Moslem Ebrahimi; 11 weights, variable; updated 1405/04/30). The market's standard UI face and the closest runner-up. But it is Divar's font, confirmed in Divar's CSS on 2026-09-27. Carshenas republishes Divar listings, and should not look like Divar. Its Latin is thinner than Yekan Bakh's.
- **Peyda, IRANYekan X, Dana, Ravi** (Fontiran). All four are good UI faces. Peyda and Dana are more geometric and brand-like; IRANYekan X and Dana were last updated in 1401 (2022); Ravi is playful, which is the wrong register for a price judge.
- **A free font: Vazirmatn, Estedad, or Noto Sans Arabic with Montserrat as Torob uses.** Free fonts would allow committing the file, but on 2026-09-26 the owner chose to buy a commercial font instead of Vazirmatn.
- **Plain `@font-face` from `public/`.** A missing file would degrade to the fallback instead of failing the build, and the CSS licence comment Fontiran asks for could sit above the rule. But it gives up next/font's hashing, per-route preload and one-place loading. A silent fallback also risks shipping without the font, and the licence comment is optional "where technically possible".
- **Committing the file.** A private repository shared with reviewers is still sharing the file, which the terms forbid.
- **`display: 'optional'`.** Zero layout shift, but a slow first load keeps the fallback for the whole visit (measured above).

## Consequences

- **Positive.**
  - One file, all weights, 69 KB.
  - One family for Persian, Latin and numbers.
  - The licence is respected by construction.
  - The line heights, stems and clipping floors in the design language are measured on the real font.
- **Negative and risks.**
  - A fresh clone, CI (CS-22) and the deployment (CS-23) cannot build without the file. They must get it from private storage under the licence. CI traces that record the font must not be downloadable from a public repository.
  - The Latin trim codes are the owner's call on real titles.
  - A web licence must be registered before the demo is public.
- **Follow-ups.**
  - CS-22 and CS-23: give builds the font from private storage, and keep it out of public artifacts.
  - The owner: register the web licence.
