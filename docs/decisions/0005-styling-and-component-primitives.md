# ADR-0005: Tailwind CSS v4 with lint-enforced logical utilities; shadcn/ui on Base UI and React Aria dates, both deferred

- Status: proposed
- Date: 2026-09-18
- Deciders: Pedrum (with Claude Code)
- Related: CS-3, `docs/research/2026-09-18-styling-system-and-component-primitives.md`, ADR-0003

## Context

Every screen is Farsi and right-to-left, most users are on mid-range Android phones, and agents write most of the code. The styling system therefore has to make direction-agnostic CSS the path of least resistance and be checkable by a linter, work in Server Components without client JavaScript, and be something agents write consistently. Primitives have to be correct in RTL, accessible to WCAG 2.2 AA, and must not speak English to Farsi screen-reader users. Nothing was carried over from other projects; the candidates were compared fresh.

## Decision

1. **Styling: Tailwind CSS v4**, installed by the scaffold. Only logical utilities are allowed for anything horizontal (`ms-`, `me-`, `ps-`, `pe-`, `inset-s-`, `inset-e-`, `border-s/e`, `rounded-s/e`, `text-start/end`, `float-start/end`). `eslint-plugin-better-tailwindcss` rule `enforce-logical-properties` is an error for the inline axis (height, width and the block axis are exempt, because RTL never swaps them), `no-deprecated-classes` is on, and `no-restricted-classes` covers what the table misses (`origin-left/right`, horizontal gradient directions, the deprecated `start-*`/`end-*`). `space-x-*` and `divide-x` need no rule: verified in this app on 2026-09-18, Tailwind 4.3 compiles them to `margin-inline-*` and `border-inline-*`. No `rtl:`/`ltr:` variants: the app has one direction. Design tokens live in `@theme` as CSS variables in three tiers (primitive, semantic, component); their values are CS-3's job.
2. **CSS Modules** are the escape hatch for the rare component Tailwind cannot express, with logical properties only.
3. **Primitives: shadcn/ui on Base UI with `rtl: true`**, as owned source code. It is **not initialised now**; the first interactive primitive triggers `shadcn init`, and each component is added when first used.
4. **Dates: React Aria Components with `@internationalized/date`**, confined to date and calendar inputs and added with the first one. Visible labels and `aria-label`s are supplied by us in Farsi because the library ships no `fa-IR` strings.
5. **No runtime CSS-in-JS, no full component kit** (MUI, Mantine, Ant, HeroUI).

## Alternatives considered

- **CSS Modules with modern CSS as the main system**: native and dependency-free, and every feature we need is Baseline, but it gives agents no shared vocabulary and no single lint rule that keeps spacing, colour and direction consistent across hundreds of components.
- **vanilla-extract, Panda, StyleX, Pigment**: typed tokens are attractive; small training footprint for agents, and Turbopack or maturity problems today.
- **styled-components, Emotion**: client-only under Server Components, and the styled-components maintainer advises against adopting it for new projects.
- **Radix as the shadcn base**: smallest bundle and best-known to agents, but an RTL overflow bug has sat unanswered for 22 months.
- **React Aria for everything**: excellent engineering and the only verified Persian calendar, but built-in strings fall back to English for Farsi with no override, which fails our screen-reader users across every component.
- **Ark UI**: supports custom translations and recently gained a Persian date picker; smaller ecosystem and agent familiarity.

## Consequences

- Positive: physical left and right cannot enter the codebase unnoticed; one styling vocabulary for agents; zero styling JavaScript in Server Components; primitives are our code, so RTL fixes never wait on a vendor.
- Negative / risks: Tailwind's maintainer team is small, although MIT and now backed by Shopify; Base UI is young and agents may write Radix idioms (`asChild`) until corrected by lint, review or the shadcn migration skill; two primitive libraries once dates arrive; shadcn's animation helper has a known RTL bug to watch.
- Reopen this decision if: React Aria ships `fa-IR` strings or an override mechanism; Base UI ships a calendar with Persian support; the product becomes dominated by dense data-entry screens.
- Follow-ups: the lint rules landed with the scaffold; fonts, tokens and digit formatting are CS-3 and CS-2.
