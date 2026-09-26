# Design tokens

Sources: Material Design 3 token guidance ("component tokens should point to a system or reference token, and not contain hardcoded values"); Nathan Curtis, "Naming Tokens in Design Systems" and "Don't Globalize Decisions Prematurely" (EightShapes); Tailwind CSS v4 docs on `@theme`, `@theme inline` and theme variables; MDN on `color-scheme`, `light-dark()` (Baseline newly available 2024-05) and `oklch()`; Design Tokens Community Group format (2025.10, stable but "not a W3C Standard"); Refactoring UI on defining shades up front ("8-10 shades", no preprocessor `lighten`/`darken`); Hardik Pandya, 2026-03-01 (n=1 practitioner report: a closed set of named variables took an agent's hard-coded values "418 across 28 files → 0"). Anthropic's own model guidance: generic taste words move a model to another fixed palette, concrete named values do not.

The palette, type roles, spacing and radius scales are chosen once by CS-3 in `docs/design/design-language.md`. This file is about **how** tokens are structured and named, so that when they exist every component uses them and nothing else.

## Three tiers

1. **Reference (primitives)**: raw values named by scale: `--gray-600`, `--space-4`, `--radius-2`, `--duration-2`. Components never use these directly.
2. **System (semantic)**: named by role: `--color-surface`, `--color-text-muted`, `--color-action`, `--color-on-action`, `--color-danger`, `--color-border-control`, `--color-focus-ring`, `--space-field-stack`, `--radius-control`, `--shadow-raised`, `--font-ui`, `--text-body`, `--leading-body`, `--duration-press`. This is the only tier that changes per theme.
3. **Component**: aliases of tier 2 scoped to one component (`--button-bg: var(--color-action)`), created only when a component genuinely needs its own knob (Curtis: do not globalise a decision one component made). Most components need none.

Shades are defined up front as a scale (Refactoring UI); no `color-mix()` or opacity tricks to derive text colours in components, because derived colours dodge the contrast check.

## Naming

- Role, not appearance: `--color-action`, never `--color-teal` outside tier 1; `--color-text-muted`, never `--color-gray-600` in a component.
- No `left`/`right` in any token name; use `start`/`end` (`--space-control-inline`, `--radius-control`; a corner token is `--radius-ss` for start-start).
- Pairs stay pairs: every coloured surface token has an `on-` partner that meets 4.5:1 on it (`--color-action` / `--color-on-action`), so contrast is decided once.
- Type roles, not sizes, in components: `--text-body`, `--text-label`, `--text-title`, each with its `--leading-*`, and Persian line heights (1.7 to 1.8 for body) baked into the role.
- Duration and easing tokens per motion kind (`motion.md`), not per component.

## Where they live (Tailwind v4)

- Tier 1 and tier 2 are CSS custom properties in `apps/web/src/app/globals.css`: primitives under `@theme` so utilities exist for them; semantic tokens that reference other variables under `@theme inline` (Tailwind's own guidance when a theme variable points at another variable); per-theme overrides in plain CSS on `:root` with `color-scheme: light dark` and `light-dark()`, or `[data-theme]` selectors for a manual override.
- `oklch()` for the shade scales so steps are perceptually even; hex is acceptable in tier 1 only if the design language is delivered that way.
- Components use utilities generated from tokens (`bg-surface`, `text-muted`, `rounded-control`, `duration-press`) or `var(--…)` in the rare CSS file. Never `bg-[#…]`, `text-[13px]`, `rounded-[6px]`, `duration-[180ms]`: an arbitrary value is a missing token. The `better-tailwindcss/no-restricted-classes` rule bans arbitrary colour and size values once the tokens exist (CS-3 turns it on with the token names).
- Dark mode is a token concern, never a component concern: no `dark:` variants in components.

## Adding a token

1. Prove the need: two components want the same value, or one component needs a value the language does not define.
2. Add it at the right tier with a role name; if it is a colour, add its `on-` partner and record the contrast ratio in the design-language file.
3. Use it; delete the arbitrary values it replaces in the same change.

A token no component uses after a month is removed.
