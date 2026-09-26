# Styling system and component primitives for a Farsi, right-to-left Next.js 16 app

- Date: 2026-09-18
- Asked by / for: Pedrum (styling system)
- Outcome: ADR-0005 (proposed): Tailwind CSS v4 with lint-enforced logical utilities; shadcn/ui on Base UI with its RTL option when the first primitive is needed; React Aria only for Jalali date inputs

## Questions

1. Which styling system suits a Farsi, right-to-left, phone-first product on Next.js 16 with React Server Components, written mostly by coding agents?
2. Which component primitives give correct RTL behaviour, Jalali dates, WCAG 2.2 AA accessibility and small client bundles?
3. What should deliberately stay uninstalled at the bare-minimum stage, and what reopens each decision?

Nothing was assumed from other projects; every candidate started equal.

## Method and limits

One research pass over primary sources (official docs, npm registry, GitHub API, release notes; snapshot 2026-09-17/18), plus hands-on tests: bundle sizes built with esbuild, the Persian calendar checked day by day against ICU, the lint rule run against real classes, and my own verification inside a freshly scaffolded Next.js 16.3.5 app. The session's web-search budget ran out partway through, so a few items that needed open search are marked **not found** instead of guessed: criticisms of Tailwind from named engineers, 2026 recommendations from Una Kravets, Adam Argyle, Rachel Andrew and Jen Simmons, independent accessibility audits of the primitive libraries, and Material's icon-mirroring lists.

## Findings: styling

**What Next.js itself says** (docs for 16.3.5, bundled in the package and at nextjs.org/docs/app/getting-started/css, updated 2026-08-25): "Use Tailwind CSS for most styling needs" and "Use CSS Modules for component-specific styles when Tailwind utilities aren't sufficient." Runtime CSS-in-JS works only in Client Components through a style registry.

**Tailwind CSS v4** (4.3.3, MIT, about 93M downloads a week):

- The logical utility set was completed in 4.2.0 (2026-02-18): `ms-/me-/ps-/pe-`, `pbs-/pbe-/mbs-/mbe-`, `inset-s-/inset-e-`, `border-s/e`, `rounded-s/e`, `text-start/end`, `float-start/end`. `start-*`/`end-*` were deprecated in 4.3 in favour of `inset-s-*`/`inset-e-*`.
- `rtl:`/`ltr:` variants exist but the docs call them "only useful if you are building a site that needs to support both" directions. A single-direction Farsi app should use logical utilities and no variants.
- Browser floor: Chrome 111, Safari 16.4, Firefox 128. StatCounter for Iran, August 2026: Android 85.5% of mobile, Chrome 80.5%, Safari 11.3%.
- Maintenance: Tailwind Labs cut most of its engineering team in January 2026 and joined Shopify on 2026-09-09: "Everything will always be MIT-licensed, and our team will continue to lead and maintain these projects."
- **Verified here** in a scaffolded Next.js 16.3.5 app with ESLint 9: `eslint-plugin-better-tailwindcss` 4.7.0 rule `enforce-logical-properties` rejected all eight physical classes I planted (`ml-4`, `pl-2`, `text-left`, `left-0`, `border-l`, `rounded-l-lg`, `mr-2`, `float-right`), named the logical replacement for each and auto-fixed them; the production CSS contained `margin-inline-start`, `padding-inline-start`, `inset-inline-start`, `border-inline-start`, `text-align:start` and `border-start-start-radius`. The rule's table does not cover `translate-x-*`, `origin-*` or gradient directions; `origin-*` and gradients are handled with `no-restricted-classes`, and `translate-x` stays a review item because there is no logical translate. `space-x-*` and `divide-x` turned out to need nothing: compiled in this app, Tailwind 4.3 emits `margin-inline-start/end` and `border-inline-start/end-width` for them. The rule also wants `w-`/`h-`/`max-w-` rewritten as logical sizes, which has nothing to do with RTL; its `ignore` option exempts sizing and the block axis.

**CSS Modules with modern CSS**: built into Next.js, no build dependency. Baseline "widely available": logical properties (2024-03), cascade layers (2024-09), container queries (2025-08), `color-mix()` and OKLCH (2025-11), `:dir()` (2026-06), nesting (2026-06), `:has()` (2026-06). Newly available: `light-dark()`, `@scope`. Not Baseline: anchor positioning. Josh W. Comeau calls CSS Modules "battle-tested and heavily optimized" (joshwcomeau.com/react/css-in-rsc, updated 2026-02-15). Logical properties can be enforced with `stylelint-use-logical` 2.1.3. Its weakness here is the absence of a shared, lintable vocabulary for agents: every component invents its own class names and spacing.

**Build-time CSS-in-JS**: vanilla-extract 1.21.2 works with Turbopack but has an open slow-`next dev` issue (#1786, 2026-09-04); Pigment CSS is at 0.0.31 with its Turbopack issue open since 2024; StyleX is 0.x; Panda is PostCSS-based with 2.0 in beta. **Runtime CSS-in-JS**: styled-components is in maintenance mode, its maintainer wrote on 2025-03-17 "For new projects, I would not recommend adopting styled-components or most other css-in-js solutions"; `@emotion/react` was last published 2024-12-09.

**RTL pitfalls that no styling system solves for you** (Ahmad Shadeed, rtlstyling.com): there is no logical `translateX`; remove `letter-spacing` for Arabic-script text; check `line-height` for clipped diacritics; default underlines collide with letter dots; flexbox and grid mirror automatically with direction; mirror an icon only when its meaning depends on direction.

| Requirement | Tailwind v4 | CSS Modules + modern CSS | vanilla-extract | Panda / StyleX | Runtime CSS-in-JS |
|---|---|---|---|---|---|
| RTL | full logical set plus a tested, auto-fixing lint rule | native, Stylelint plugin | you write logical CSS | not checked | MUI needs a stylis plugin |
| Server Components, minimal JS | yes | yes | yes | yes | client only |
| Fit with Next.js 16 | the docs' first pick | built in | Turbopack dev issue | 0.x / beta | discouraged |
| Agent fluency | largest corpus, one vocabulary | fluent, but no enforced vocabulary | small corpus | small corpus | shrinking |
| Tokens and theming | `@theme` CSS variables | hand-rolled variables | typed | typed | runtime |
| Longevity | MIT, now inside Shopify, small team | the web platform | modest | modest | declining |

## Findings: component primitives

| Library | Version (date) | Finding |
|---|---|---|
| Base UI | 1.8.0 (2026-09-04) | Monthly releases; a Persian-digit NumberField bug fixed the same day (#4718), an RTL overflow bug in 12 days (#5635); ships no built-in strings, so nothing leaks English to Farsi screen readers; **no Calendar or DateField yet** (#1709 open). 1.0 only since 2025-12-11 |
| React Aria Components | 1.21.1 (2026-09-04) | Best Persian calendar: `@internationalized/date` 3.12.4 matched ICU on 25,567 of 25,567 days from 1990 to 2059, week starts Saturday, number parsing accepts Persian and Arabic-Indic digits. **Ships no `fa-IR` strings and offers no way to supply them**: the source falls back with "Nothing close, use english"; maintainers on adding languages: "unlikely that we'll be adding it any time soon" (2026-05-05). First-party MCP server, skills and `llms.txt` |
| Radix | 1.6.7 (2026-07-24) | Smallest bundle; RTL overflow issue #3216 open since 2024-11-07 with no reply |
| Ark UI | 5.39.2 | `translations` prop on 26 components; Persian date picker only since 5.33.0 (2026-02-26) |
| Headless UI | 2.2.10 (2026-04-07) | No commits in 90 days since the Tailwind Labs layoffs |
| shadcn/ui | CLI 4.21.0 | A distribution model, you own the code. `rtl: true` rewrites physical classes to logical ones "for languages like Arabic, Hebrew, and Persian" (2026-01-28); Base UI is the default base since 2026-07-02; React Aria became a base on 2026-07-17. Known RTL animation bug in `tw-animate-css` (#67). Agent pitfall: its calendar docs still import `react-day-picker/persian`, which DayPicker v10 moved to `@daypicker/persian` |
| MUI, Mantine, HeroUI | | MUI's RTL needs a stylis plugin and an Emotion cache (runtime CSS-in-JS); HeroUI inherits React Aria's missing Farsi strings; Mantine's Jalali support not verified |

Measured client cost (esbuild, React external, gzip) for Dialog + Popover + Select + Checkbox + Tabs: Radix 36.5 KB, Headless UI 45.7 KB, Ark UI 49.5 KB, React Aria 62.0 KB, Base UI 64.3 KB. React Aria DatePicker alone: 75.2 KB.

## Findings: supporting pieces

- **Fonts**: Vazirmatn (OFL-1.1, variable `woff2` of 111 KB, last release 2022-06-22) and Estedad (OFL, variable 100–900, release 8.5 on 2026-03-20) are free; IRANSans and IRANYekan are commercial. `next/font/local` self-hosts; `next/font/google` fetches at build time, which fails for builds inside Iran. The choice belongs to CS-3.
- **Numbers and dates**: `Intl` with `fa-IR` defaults to the Persian calendar and `arabext` digits (Node 22, ICU 76). The Toman has no ISO code, so format the number and append the unit. Format in Server Components so the server's and the browser's ICU versions cannot disagree during hydration. Belongs to CS-2.
- **Forms**: the Next.js forms guide uses HTML validation attributes, `useActionState` and server-side Zod, and names no form library. Agent pitfall: its sample uses Zod 3 syntax; Zod 4 uses the `error` parameter and `z.flattenError()`. Zod on the client costs 24.3 KB gzip (`zod/mini` 4.9 KB); server-only costs nothing. Kent C. Dodds' Epic Stack (2026-08-29) uses Tailwind 4, Radix, Conform and Zod.
- **Icons**: Phosphor has a `mirrored` prop; Lucide and Tabler do not. Ten icons cost 1.3 to 6.2 KB gzip depending on the set.

## Recommendation

**Tailwind CSS v4 with logical utilities enforced by lint. For primitives, shadcn/ui on Base UI with `rtl: true`, initialised when the first interactive primitive is needed, not before. React Aria Components only for date inputs, when the first one is needed.**

Tailwind is the Next.js docs' own first choice, gives agents one shared vocabulary with the largest training corpus, and is the only candidate with a tested, auto-fixing rule that keeps physical direction out of the codebase. Base UI has no built-in strings to leak English to Farsi screen-reader users and fixes Persian and RTL bugs within days. React Aria's Persian calendar is uniquely good and its missing Farsi strings are uniquely bad, so confining it to dates, where the visible labels are ours, takes the strength without the weakness.

**Strongest argument against**: two primitive libraries mean two state-attribute vocabularies for agents to confuse; Base UI is young and older models will write Radix's `asChild` where Base UI uses `render`; Radix is 43% smaller for the common set. **The runner-up wins if** Adobe ships `fa-IR` strings or the product grows heavy data-entry UI (then go all-in on React Aria), or if a fully bespoke design system with zero build dependency becomes the goal (then CSS Modules).

## Deliberately not installed yet

| Package | Trigger |
|---|---|
| shadcn/ui config, `@base-ui/react`, `clsx`, `tailwind-merge`, icons | the first interactive primitive (dialog, select, menu, sheet) |
| `react-aria-components`, `@internationalized/date` | the first date input |
| A form library (Conform) | the first nested or multi-step form |
| Client-side Zod | only if instant field feedback proves necessary, then `zod/mini` |
| Stylelint with a logical-properties plugin | the first `.module.css` file |
| Dark mode, Storybook, a second icon set | a real need |
