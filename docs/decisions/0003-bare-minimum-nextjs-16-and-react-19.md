# ADR-0003: Next.js 16 and React 19 for the web app, kept bare; everything else arrives with the task that needs it

- Status: accepted
- Date: 2026-09-26 (scaffold procedure verified 2026-09-18)
- Deciders: Pedrum
- Related: ADR-0004, ADR-0005, ADR-0007, `docs/research/2026-09-18-nextjs-project-structure.md`

## Context

The owner chose the web framework: "I'm leaning towards nextjs, react. however no problem with postgres, elastic and llm context engineering" (2026-09-26). The repository starts from the owner's AI-first template, whose app shell was scaffolded and verified on 2026-09-18. This record fixes the exact versions and the scaffold procedure, and says what stays out of the web app until a task needs it, so nobody builds it early. The data, search and ingestion stack the product does need is a separate decision: ADR-0007.

## Decision

1. **Next.js 16 (App Router) with React 19 and TypeScript**, as one application at `apps/web` inside the pnpm workspace. Versions as scaffolded by `create-next-app@16.3.5`: `next` 16.3.5, `react` and `react-dom` 19.2.8, Turbopack for dev and build.
2. **Pinned on purpose**: TypeScript `~5.9.3` and ESLint `^9`. TypeScript 7.0.2 typechecks and builds faster, but `typescript-eslint` cannot load it, so lint crashes; ESLint 10 crashes `eslint-config-next` 16.3.5. Both pins are revisited when upstream support lands (typescript-eslint issue #10940, jsx-eslint PR #4022). TypeScript is a workspace catalog entry so every package uses the same compiler.
3. **Config flags on from day one**: `reactCompiler`, `typedRoutes` and `cacheComponents` (reasons and the revert path are in ADR-0004).
4. **Styling** is Tailwind CSS v4, installed by the scaffold (ADR-0005).
5. **The scaffold's agent files stay**: `apps/web/AGENTS.md` with the Next.js managed block that points agents at the version-matched docs in `node_modules/next/dist/docs/`, and `apps/web/CLAUDE.md` importing it.
6. **Nothing else in the web app until its trigger occurs** (table below). Data the UI needs before the database exists comes from in-repo fixtures behind server-only query functions (ADR-0004), so pages do not change when the real data layer arrives.

### Scaffold procedure (verified in a scratch pnpm workspace on 2026-09-18)

```bash
# required global tools: Node >= 22 (Next.js needs >= 20.9), pnpm 10.27 (packageManager field), git
mkdir -p apps                                   # create-next-app fails if the parent folder is missing
pnpm dlx create-next-app@16.3.5 apps/web --ts --app --src-dir --empty --eslint --react-compiler --tailwind \
  --import-alias "@/*" --use-pnpm --disable-git --skip-install --yes
# then: move `ignoredBuiltDependencies` (sharp, unrs-resolver) from apps/web/pnpm-workspace.yaml into the root
# pnpm-workspace.yaml, delete the nested file and the app-level `packageManager` field, add `apps/*` to the
# root `packages`, and run `pnpm install` once at the root.
```

Measured: install about 60 s, production build 13 s, the empty app lints and typechecks clean.

## Deferred, with the trigger that reopens each

| Deferred | Reopened by |
|---|---|
| Database, search index, job queue, LLM provider | **Triggered**: the product persists and searches crawled listings. Decided in ADR-0007 (proposed); nothing is installed until CS-4 accepts it |
| Authentication | the first feature that depends on who the visitor is (saved searches and alerts start with a Telegram chat instead of an account, CS-20) |
| Hosting and deployment | the first version someone outside this machine must see (CS-23) |
| Copy catalogue or i18n library | a second locale, or copy that non-developers must edit |
| Client data cache (TanStack Query) | the first client-owned read that must refetch without navigation (infinite scroll, typeahead, polling) |
| Component primitives, date inputs, form library | see ADR-0005 |
| PWA or offline layer, monitoring, analytics | a real user on a real network |
| Turborepo, `packages/*` extraction | a second consumer of the same code, such as the ingestion worker importing the web app's types (ADR-0007) |

## Alternatives considered

The owner chose the framework, so no stack comparison was made. The only choices here were versions: following the scaffold (taken) versus forcing the newest TypeScript and ESLint (rejected, both break lint today).

## Consequences

- Positive: the smallest app that can carry real UI work; every later decision is made with evidence from an actual need; agents get version-matched framework docs for free.
- Negative / risks: ESLint 9 is past end of life and must be revisited; fixture-backed data can drift from what the real data layer returns unless the query functions and DTO types are treated as the contract.
- Follow-ups: CS-2 (money and dates), CS-3 (UI foundations), CS-4 (data stack) reopen the items above when their triggers occur.
