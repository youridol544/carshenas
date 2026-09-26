---
paths:
  - "apps/web/src/**/*.ts"
  - "apps/web/src/**/*.tsx"
  - "apps/web/*.ts"
  - "apps/web/*.mts"
  - "apps/web/tsconfig.json"
---

# TypeScript in the app

Typed lint (`strictTypeChecked` and `stylisticTypeChecked`) already rejects `any`, floating promises, unnecessary conditions, non-exhaustive switches, `interface` where a `type` fits, value imports of types, `enum` and `React.FC`. Fix what the message points at; never silence a rule with a comment, a cast or `!`. Sources: Matt Pocock (Total TypeScript TSConfig cheat sheet; "Cursor rules for better AI development", 2025-04-23); TypeScript 4.9 release notes (`satisfies`); the TypeScript 6.0 and 7.0 announcements; typescript-eslint docs; lab runs on 2026-09-17.

## Compiler

- TypeScript is pinned to 5.9 in the workspace catalog. TypeScript 7.0 "does not ship with an API" (Microsoft, 2026-07-08), so typescript-eslint cannot run on it; do not bump until it can. TypeScript 6.0 is the next possible step and needs its own change.
- `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` and `moduleDetection: "force"` are on. Never add options that TypeScript 6 deprecates and 7 removes: `baseUrl`, `moduleResolution: "node"`, `target: "es5"`, `downlevelIteration`, `outFile`, `esModuleInterop: false`.
- `pnpm typecheck` runs `next typegen` first. Route types (`PageProps<'/listings/[id]'>`, `LayoutProps`, `RouteContext`) and typed `<Link href>` come from it; use the `Route` type from `next` for hrefs assembled at run time.

## Types that carry the domain

- A closed set is an `as const` object plus a derived union, and every map over it is checked with `satisfies`:

  ```ts
  export const DEAL_RATING = { great: 'great', good: 'good', fair: 'fair', high: 'high', overpriced: 'overpriced' } as const;
  export type DealRating = (typeof DEAL_RATING)[keyof typeof DEAL_RATING];
  export const DEAL_RATING_LABEL = {
    great: 'عالی',
    good: 'خوب',
    fair: 'منصفانه',
    high: 'گران',
    overpriced: 'خیلی گران',
  } as const satisfies Record<DealRating, string>;
  ```

- States that exclude each other are a discriminated union switched on exhaustively (`{ status: 'loaded'; listing: Listing } | { status: 'failed'; message: string }`). When a `default` branch is unavoidable it calls `assertNever(value)`.
- Props that exclude each other use `?: never`: `{ href: Route; onPress?: never } | { onPress: () => void; href?: never }`.
- Ids and money get branded types where they are parsed (`type ListingId = string & { readonly __brand: 'ListingId' }`), so a `SourceId` cannot go where a `ListingId` is expected and a price is never a bare `number`. This is our convention; no primary source brands money.
- Anything that crosses a trust boundary starts as `unknown` (`await request.json()`, `JSON.parse`, `formData.get`, `searchParams`) and becomes typed only by parsing it with the feature schema. Never `as` a value from outside into a type.
- Index access returns `T | undefined` here (`noUncheckedIndexedAccess`): handle the `undefined` with an early return or a default instead of asserting it away.

## Components and functions

- Props are declared next to the component. `children: React.ReactNode`. Extend native elements with `ComponentProps<'button'>`, which includes `ref` in React 19. Do not annotate component return types.
- Generics only when a type parameter links two positions (an input to an output); a type parameter used once is `unknown` in disguise (Pocock).
- Named function declarations rather than arrow constants for top-level functions; `readonly` arrays for inputs you do not mutate.
- Narrow a caught error with `instanceof` before reading it; define an `Error` subclass when callers need to tell a failure apart.
- Prefer the platform: `Intl` for numbers and dates (with `fa-IR`), `URL` and `URLSearchParams` for links, `structuredClone` for deep copies. Check browser support before using anything newer than ES2022: most buyers use Android Chrome, but not always a current one.
