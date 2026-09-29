---
paths:
  - "apps/web/**"
---

# Working in `apps/web` (Next.js 16, React 19)

**Before writing Next.js code, read the matching guide in `apps/web/node_modules/next/dist/docs/`** (version-matched, searchable offline: `01-app/01-getting-started`, `02-guides`, `03-api-reference`). This Next.js differs from older training data: `proxy.ts` replaced middleware, request APIs are async, `next lint` is gone, caching is opt-in through `'use cache'`.

Where things go (ADR-0004; ESLint enforces all of it, so read the lint message and fix the cause, never disable the rule inline):

- `src/app/` holds only Next.js files (`page`, `layout`, `loading`, `error`, `not-found`, `route`, …). They stay under 80 lines: read params, export metadata, compose feature components inside `<Suspense>`.
- `src/features/<feature>/` holds the domain: `components/`, `server/` (every file starts with `import 'server-only'`), `<feature>-actions.ts` (`'use server'`, exports only `async function <verb><Noun>Action`), `<feature>-schemas.ts`, `<feature>-types.ts`, logic files with their `*.test.ts(x)` beside them.
- `src/components/ui/` primitives without domain words; `src/lib/` pure helpers; `src/server/` cross-feature server code, and `src/server/env.ts` is the only file that reads `process.env`.
- Imports flow one way: `app` → `features` → `components`, `server`, `lib`. A feature never imports another feature: compose them in `app/` through children and slot props. A new top-level folder under `src/` must first be declared in `eslint.config.mjs`.
- No `index.ts` barrels, no `export *`, no `../` imports: import the defining file through `@/…`. kebab-case files, named exports (default only where Next.js requires one).
- `'use client'` only on interactive leaves; pass Server Components as children; props are plain serialisable data.
- Create folders when the first file needs them. Do not pre-create empty structure.
- `import 'server-only'` needs no package: Next.js resolves it in builds, and `vitest.config.mts` aliases it to the same empty module for tests (both checked on 2026-09-21), so data stays behind `server/` from the first fixture.
- The other packs: `react.md` (components), `ui.md` (anything visible), `next-app-router.md` (`src/app`), `server-actions-data.md` (actions, schemas, `server/`), `database.md` (tables, migrations, queries), `typescript.md`, `testing.md`. Worked examples: the `react-patterns` skill.

Deferred on purpose (ADR-0003): auth, hosting, i18n library, client data cache, component library, form library. Do not add or research them until the task at hand hits the trigger listed there. The data layer is decided: PostgreSQL through Kysely (ADR-0011, ADR-0012), in `src/server/db`, with its own rule (`database.md`) and skill (`database`); the job queue (pg-boss) arrives with the worker in CS-33. A feature whose tables do not exist yet reads typed fixtures behind `server/<feature>-queries.ts` functions that return the same DTOs the database version will.

Styling (ADR-0005): Tailwind CSS v4. Anything horizontal uses logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `inset-s-`, `inset-e-`, `border-s/e`, `rounded-s/e`, `text-start/end`); `space-x-*` and `divide-x` are already logical in v4. No `rtl:`/`ltr:` variants, no `start-*`/`end-*` (deprecated). Width, height and the block axis stay as usual (`w-`, `max-w-`, `mt-`, `pb-`).

Commands, from the repo root: `pnpm dev` · `pnpm check` (lint, typecheck, unit tests, formatting) · `pnpm e2e` (production build plus browser tests) · `E2E_BASE_URL=http://127.0.0.1:3000 pnpm e2e tests/app` against a running dev server. A `next dev` already running is recorded in `apps/web/.next/dev/lock`; reuse it instead of starting a second one.
