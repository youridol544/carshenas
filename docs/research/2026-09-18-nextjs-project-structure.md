# Project structure and frontend architecture for a Next.js 16 App Router codebase

- Date: 2026-09-18
- Asked by / for: Pedrum (web app structure)
- Outcome: ADR-0004 (proposed): thin `app/` routing layer over `src/features/<feature>/`, a server-only data layer inside each feature, no barrel files, all of it enforced by lint and the build

## Questions

1. What does Next.js 16 itself prescribe about structure, and what changed from 15 that affects it?
2. Which structure philosophy scales from a tiny app to a large multi-surface product without reorganising, and which can agents navigate and not violate?
3. How is the chosen structure enforced mechanically, with which packages and versions?
4. What state, data, forms and i18n architecture fits a bare-minimum start with no database?

## Method

One research pass over primary sources fetched on 2026-09-18: the Next.js 16.3.5 docs as raw markdown, react.dev, practitioners' own articles with load-bearing quotes re-checked verbatim, and eleven real App Router codebases read at pinned commits rather than from their READMEs. The recommended layout was then built in a sandbox (`create-next-app@16.3.5`, pnpm 10.27, Node 22.14) with two features, and every lint rule below was made to fire on a deliberate violation. My own scratch scaffold confirmed the install facts independently.

## Sources and why they are credible

| Who | Why credible | What was read |
|---|---|---|
| Next.js docs and team (Vercel) | Framework authors | Project structure (2026-07-21), interactive-apps guide (2026-08-25) and its demo repo `vercel-labs/async-react-demo`, upgrade guide to 16, caching and `use cache`, data-security guide, server and client components, mutating data, proxy reference, AI agents guide (2026-09-07) |
| Sebastian Markbåge | React and Next.js core | "How to Think About Security in Next.js" (2023-10-23): the Data Access Layer |
| Dan Abramov | Former React core | "What Does 'use client' Do?" (2025-04-25), "How Imports Work in RSC" (2025-06-05), "One Roundtrip Per Navigation" (2025-05-29) |
| Kent C. Dodds | Epic React, Epic Web, Testing Library | "Colocation" (2019-06-17), "AHA Programming" (2020-06-22), Epic Stack decision records 031 and 046 |
| Dominik Dorfmeister (TkDodo) | TanStack Query maintainer, Sentry | "The Vertical Codebase" (2026-04-13), "Please Stop Using Barrel Files" (2024-07-26) |
| Robin Wieruch | Long-running React author | "React Folder Structure" (modified 2026-05-05), the most detailed current App Router blueprint |
| Alan Alickovic | bulletproof-react (35.9k stars) | `docs/project-structure.md`; note its Next app is Next 14 with client-side data |
| Josh W. Comeau | Educator, the dissenting view | "Delightful React File/Directory Structure" (updated 2025-12-03) |
| Mark Erikson | Redux maintainer | Redux style guide: feature folders "Strongly Recommended" |
| Matt Pocock | Total TypeScript | TSConfig cheat sheet |
| Armin Ronacher, Lee Robinson | Practitioners writing about agents | "A Language for Agents" (2026-02-09); leerob.com/agents (Dec 2025) |
| Vercel evals; ETH Zurich (arXiv 2602.11988) | Measurements | AGENTS.md versus skills (2026-01-27); context files and task success (2026-02-12) |
| Feature-Sliced Design | Methodology maintainers | v2.1 notes, their Next.js guide (2026-06-08), issues #874, #926, #797 |
| Codebases at pinned SHAs | What production teams actually do | formbricks, cal.diy, dub, vercel/commerce, next-forge, inbox-zero, langfuse, unkey, documenso |

## Findings

### What Next.js 16 prescribes

- "Next.js is **unopinionated** about how you organize and colocate your project files", and "choose a strategy that works for you and your team and be consistent across the project." It lists three equal strategies; the first "keeps the `app` directory purely for routing purposes".
- **The team's own newest example uses features plus a thin `app/`.** The interactive-apps guide: "The app is organized by feature. Everything for the task domain (queries, Server Functions, and components) lives under `features/task/`. Shared UI primitives live in `components/ui/`, and pages in `app/` compose feature components." The demo has `src/app`, `src/features/task/{components/, task-actions.ts, task-queries.ts}`, `src/components/ui`, `src/lib`; its queries file starts with `import "server-only"` and uses `"use cache"`, `cacheLife` and `cacheTag`.
- Changes in 16 that touch structure: Turbopack is the default for dev and build; `middleware` became `proxy` ("recommended to be used as a last resort"); request APIs are async only; `next lint` is gone ("Use Biome or ESLint directly"); `reactCompiler` and `typedRoutes` are stable but off by default; `cacheComponents: true` replaces the PPR and `dynamicIO` experiments and makes caching "entirely opt-in".
- Under Cache Components "cached functions and components **cannot** access runtime APIs like `cookies()`, `headers()`, or `searchParams`… pass them as arguments", and "The deeper your async work sits in the tree, the more of the page can be prerendered." So data functions are standalone and take every input as an argument, and pages are shells around `<Suspense>`.
- Data Access Layer: "For new projects, we recommend creating a dedicated **Data Access Layer (DAL)**" that runs only on the server, authorises, and returns "safe, minimal **Data Transfer Objects (DTOs)**"; "only the Data Access Layer should access `process.env`"; mutations go "in a dedicated `server-only` module, while `"use server"` actions stay thin."
- Server and client: `"use client"` declares "a **boundary** between the Server and Client module graphs"; "add `'use client'` to specific interactive components instead of marking large parts of your UI"; Server Components can be passed as children; `server-only` gives "a build-time error". Server Functions are "reachable via direct POST requests… Always verify authentication and authorization inside every Server Function", and a `'use server'` file may export only async functions, so schemas cannot live in it.
- Testing: "we recommend using **E2E tests** for `async` components"; tests may be colocated.
- Agents: `create-next-app` writes `AGENTS.md` and `CLAUDE.md`; version-matched docs ship in `node_modules/next/dist/docs/` (456 files, 4.3 MB); `next dev` re-adds its managed block.

### What practitioners say

- Kent C. Dodds: "Place code as close to where it's relevant as possible", and "co-locate our tests files with the file… they are testing". On abstraction: "prefer duplication over the wrong abstraction." The Epic Stack uses kebab-case files and colocated unit tests.
- TkDodo on type folders: "It groups by type, not by domain." On agents: "agents need mostly the same things humans need…: boundaries, constraints, and fast feedback loops." And: "At Sentry, we've started to use eslint-plugin-boundaries". On barrels: pages "loading over 11k modules" fell by 68% once internal barrels were removed.
- Robin Wieruch: "Code flows in one direction." "Features don't import from each other." Kebab-case, "a -action.ts suffix for server actions, a get- prefix for queries".
- bulletproof-react: "(shared -> features -> app)", "compose different features at the application level", and on barrels "it is recommended to import the files directly" (a reversal of its earlier advice).
- Armin Ronacher: "agents often struggle to understand barrel files and they don't like them… A one-to-one mapping from where something is declared to where it's imported from is great."
- Dan Abramov: the directives "should not be seen as ways to 'mark' code as being 'on the client' or 'on the server'"; mark the secret leaves and "rely on the 'poison pill' propagating".
- The dissent, Josh Comeau: "I want things to be organized by function, not by feature." He also reports App Router friction with `index` forwarders.
- Feature-Sliced Design: its maintainers admit "Finding entities and features is still an advanced skill"; its Next.js layout broke on 16.0.1 (#874) and again in June 2026 (#926); its mandatory index files "are known to cause problems" by its own docs; its linter is beta and blind to the server and client boundary.
- On instruction files: Vercel measured that "In 56% of eval cases, the skill was never invoked"; ETH Zurich found context files do "not generally improve task success rates, while increasing inference cost by over 20%". Conclusion: put rules in lint and the build, keep prose short.

### What real codebases do

| Repo | Layout | Enforcement |
|---|---|---|
| formbricks (Next 16.3.3) | `app/` pages are three-line re-exports; `modules/` holds 1,914 files; `server-only` in 467 files; 862 colocated tests; kebab-case | env-access rule only |
| cal.diy (Next 16.2.3) | thin `app/`, `modules/`, `packages/features`; AGENTS.md: "Never use barrel imports from index.ts files" | Biome restricted imports |
| inbox-zero (Next 16.3.4) | domain code under `utils/`; largest page 43.8 KB; "No barrel files." | own file rules |
| dub (Next 15.5) | layer-first: `lib/` 1,248 files, 119 flat modal files, largest page 25.9 KB | none |
| langfuse | `src/features` with 83 directories and per-feature `index.ts` | dependency-cruiser at `warn` with a baseline of 490 and 632 violations |

Shared by most: route groups, a server shell handing off to feature views, kebab-case, colocated tests, `@/*` imports. Visible pitfalls: `lib/` and `utils/` dumping grounds, fat pages where nothing enforces thinness, written rules drifting from the files, and the high cost of adding enforcement late.

### The four philosophies compared

| | Colocate by route in `app/` | `features/` plus thin `app/` | Feature-Sliced Design | Server-only data layer (pairs with features) |
|---|---|---|---|---|
| Scalability | medium: code shared by several surfaces has no home | high, if boundaries are enforced from the first feature | high on paper | high: swapping fixtures for a database touches only `server/` |
| Discoverability for agents | mixed: paths contain `[param]` and `(group)`, which need escaping in shells and globs | high: stable, greppable paths; every import points at the defining file | low: re-export hops, mandatory index files | high: "`server/` never reaches the browser" is visible in the path |
| Enforceability | low | high: about 40 lines of lint config, verified | medium: beta linter | high: build error plus two small rules |
| Fit with App Router and Server Components | native | native, used by the official demo | friction and breakage | the officially recommended pattern |
| Ceremony for one developer | lowest at first, reorganisation later | low | high | low if kept to functions and DTOs |

### Verified by building it

- `eslint-plugin-boundaries` 7.2.0 caught a cross-feature import, shared code importing a feature, a feature importing `app/`, and an undeclared top-level folder; a one-way allowance between two features (one may read the other, never the reverse) works.
- A client component importing a server module fails `next build` with "'server-only' cannot be imported from a Client Component module"; a 15-line local lint rule catches it earlier.
- With `cacheComponents: true`, a query that awaits a timer fails the build until it is wrapped in `<Suspense>` or marked `'use cache'`. A fixture-backed stub with a small delay therefore forces the page structure a real database will need.
- `typedRoutes` makes `tsc` reject a link to a route that does not exist, and it suggests the nearest route that does ("Did you mean …?").
- **Install traps**: TypeScript 7.0.2 breaks `typescript-eslint` 8.70 ("typescript-eslint does not support TS 7.0", tracking issue #10940); ESLint 10.10 crashes `eslint-config-next` 16.3.5 through `eslint-plugin-react` and `eslint-plugin-import`, so ESLint 9 stays although it reached end of life on 2026-08-06. `create-next-app` writes a nested `pnpm-workspace.yaml` that must be merged into the root one.

### State, forms and i18n at the bare-minimum stage

- Start with no client cache. Next docs: "Many apps can provide responsive interactions without a client data-fetching library." TanStack docs: "avoid bringing in React Query until you actually need it." Filter, sort and page state live in `searchParams`.
- Forms: `<form action>` with `useActionState` gives progressive enhancement for free; the schema file is shared by the form and the action; expected errors are returned, not thrown. The Next forms guide's example is Zod 3 syntax and fails under Zod 4.
- Stub data: fixtures in a `server-only` file behind the same query functions a database will later implement.
- i18n: skip `app/[locale]`. The Next i18n guide covers multi-locale apps only. A copy catalogue (next-intl without routing builds fine under Cache Components) is a real option, but it is a dependency with no job to do yet.
- Monorepo: skip Turborepo at this size ("`turbo` isn't providing much value" for a single package, by its own docs); extract `packages/*` only when a second consumer exists.

## Recommendation

`src/app/` holds only Next.js file-convention files and stays thin. Domain code lives in `src/features/<feature>/` with `components/`, a `server/` folder guarded by `server-only`, `<feature>-actions.ts`, `<feature>-schemas.ts`, `<feature>-types.ts` and colocated tests. Shared primitives live in `src/components/ui`, pure helpers in `src/lib`, cross-feature server code in `src/server`. Imports flow one way (`app` → `features` → `components`, `server`, `lib`), features never import each other except through an explicit one-way line in the lint config, there are no `index.ts` barrels and no `export *`, files are kebab-case with named exports, and the rules are enforced by ESLint and by the build, not by prose. Folders are declared in the lint config from day one and created on first use.

## Open disagreements

1. Colocating in `app/` versus thin `app/`: thin wins here because several surfaces (search, listing and model pages, later a dealer dashboard) share the same domains, and bracket paths stay out of day-to-day work.
2. A per-feature `index.ts` public API: Langfuse and FSD use one; TkDodo, bulletproof-react, cal.diy, Ronacher and the Next docs argue against. None, with lint giving the privacy instead.
3. `server-only` in every server file versus only at the leaves (Abramov): every file, because it is deterministic for agents and free.
4. Turning on `cacheComponents`, `reactCompiler` and `typedRoutes` on day one: the docs push all three; no sampled production repo enables `cacheComponents` on main. On for a greenfield app, because the build then enforces the structure and adopting it later is a migration; it is the riskiest recommendation and is one flag to revert.
5. ESLint 9 (end of life) versus 10 (crashes) versus Biome (cannot express generic per-feature boundaries and lacks the React Compiler rules): ESLint 9 pinned, revisit when the upstream fix ships.

## Not found

No primary statement from Kent C. Dodds on barrels or exports, from Ryan Florence on URL state, or from the Next.js team on single-locale or RTL apps; no credible production write-up of Feature-Sliced Design with Server Components and server actions; `dependency-cruiser`, Steiger and Biome were not run.
