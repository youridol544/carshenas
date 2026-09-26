# ADR-0004: Thin `app/` over `src/features`, a server-only data layer, no barrels, enforced by lint and the build

- Status: proposed
- Date: 2026-09-18
- Deciders: Pedrum (with Claude Code)
- Related: ADR-0003, ADR-0007, `docs/research/2026-09-18-nextjs-project-structure.md`

## Context

Next.js is "unopinionated about how you organize and colocate your project files". The app starts almost empty but has to grow into a search product with several surfaces (search results, listing, model and valuation pages, alerts, later dealer tools) sharing the same domains (listings, market values, saved searches) without a reorganisation, and most of its code will be written by agents, which follow what the toolchain rejects far more reliably than what a document asks. Measurements agree: skills went uninvoked in 56% of Vercel's eval cases, and ETH Zurich found context files do not generally improve task success while costing over 20% more. So the structure has to be simple to state and mechanically enforced from the first feature.

## Decision

```
apps/web/src/
├── app/            Next.js file-convention files ONLY (page, layout, loading, error, not-found, route, …); thin shells
├── features/<feature>/
│   ├── components/             feature UI; 'use client' only on interactive leaves
│   ├── server/                 <feature>-queries.ts, <feature>-mutations.ts, <feature>-fixtures.ts; each imports 'server-only'
│   ├── <feature>-actions.ts    'use server'; thin: validate, authorise, delegate, revalidate
│   ├── <feature>-schemas.ts    Zod; shared by form and action
│   ├── <feature>-types.ts      DTOs: plain data, ISO date strings, integer money
│   └── <logic>.ts + <logic>.test.ts
├── components/ui/  primitives with no domain words;  components/layout/  chrome that takes slots, never imports features
├── lib/            pure helpers usable on server and client
└── server/         cross-feature server code: env.ts (the only reader of process.env), later db, search, llm, telegram
```

Folders are declared in the lint config now and created on first use. A route like a listing is `app/listings/[id]/page.tsx` as a shell, with everything else in `features/listings/`. A surface such as a future dealer dashboard gets a route group and, for dashboard-only widgets, its own feature; it reuses `features/listings` and `features/valuation`.

Rules, each checked by a tool:

1. `src/app/**` contains only Next.js file conventions; `page.tsx` and `layout.tsx` stay under 80 lines (`check-file` filename pattern, `max-lines`).
2. Imports flow one way: `app` → `features` → `components`, `server`, `lib`; `components` → `lib`; `server` → `lib`; `lib` imports nothing of ours. An undeclared top-level folder fails lint (`eslint-plugin-boundaries`, default disallow).
3. A feature never imports another feature. An exception is one explicit, one-way line in `eslint.config.mjs`, reviewed; cycles never. Otherwise compose in `app/` through children and slots.
4. Server-only code lives under a `server/` folder, every file there starts with `import 'server-only'`, a `'use client'` module never imports from `server/`, and `process.env` is read only in `src/server/env.ts` (two local lint rules, `no-restricted-syntax`, and the Next.js build error).
5. Reads are `get*`/`list*`/`search*` functions in `server/<feature>-queries.ts`, take every input as an argument, and return DTOs. Never read through a Server Action. Writes are `<verb><Noun>Action` in `<feature>-actions.ts`, parse with the feature's schema first, and return expected errors as values.
6. `'use client'` only on leaf interactive files; props are DTOs or children.
7. No `index.ts(x)` files and no `export *`; import the defining file through `@/…`, never `../`; kebab-case files and folders; named exports, default only where Next.js requires one (`check-file`, `import-x`, `no-restricted-imports`).
8. Tests sit next to the file as `<file>.test.ts(x)`; async Server Components and whole flows are covered in `e2e/`.
9. Horizontal styling uses logical utilities only (ADR-0005).

Config flags: `reactCompiler: true` (stable, and the default lint config already carries its 16 rules), `typedRoutes: true` (a mistyped link fails `tsc`), `cacheComponents: true` (caching becomes explicit and the build rejects uncached async work outside `<Suspense>`, which forces the page shape a real backend will need). TypeScript adds `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, `moduleDetection: "force"`, `noFallthroughCasesInSwitch`.

## Alternatives considered

- **Colocate everything by route inside `app/`** (a Next docs option, closest to Kent C. Dodds' colocation): lowest ceremony at first, but code shared by the search, listing and model pages has no home, paths fill with `[param]` and `(group)` that need escaping in shells and globs, and nothing keeps pages thin. We keep the colocation principle inside features instead.
- **Feature-Sliced Design**: six layers and mandatory index files; its own maintainers call finding entities and features "an advanced skill", its Next.js layout has broken twice since 16.0, and its linter is beta and blind to the server and client boundary.
- **Folders by type** (`components/`, `hooks/`, `utils/`; Josh Comeau's preference): fine for small apps; the sampled large codebases that did this grew 1,000-file `lib/` folders and 40 KB pages.
- **A per-feature `index.ts` public API**: gives privacy but creates barrels, which TkDodo measured, bulletproof-react reversed on, and Ronacher reports agents handle badly. Lint gives the privacy instead.
- **Clean or hexagonal architecture with repositories and dependency injection**: its best-known Next.js example advises against starting with it.
- **Biome instead of ESLint**: faster, but cannot express the generic per-feature boundary and lacks the React Compiler rules.

## Consequences

- Positive: one answer to "where does this go"; agents get fast, deterministic feedback; swapping fixtures for a database touches only `server/` folders; extraction into `packages/*` later is mechanical because dependencies already flow one way.
- Negative / risks: `cacheComponents` is the riskiest choice, since no sampled production repository enables it on main yet; reverting is one flag. ESLint 9 is past end of life. About 170 lines of lint config have to be maintained, including three small local rules. Composition through slots takes more thought than a cross-feature import.
- Reopen this decision if: `cacheComponents` blocks real work twice; the boundary rules are being disabled more often than obeyed; a second application appears.
- Follow-ups: the structure rules landed with the scaffold; the code-quality rules and the agent-facing knowledge (`.claude/rules/`, the `react-patterns` skill) landed with the frontend quality harness.
