---
name: react-patterns
description: Worked before/after examples for React 19 and Next.js 16 code in Carshenas's apps/web. Covers deriving state instead of syncing it, what replaces an effect, resetting with a key, useEffectEvent, unions instead of boolean flags, reducers named after events, external stores, composition through children, context in React 19, 'use client' at the leaf, server data loading with Suspense and parallel reads, promises passed to use(), Server Actions with useActionState and useFormStatus, useOptimistic, 'use cache' with tags, and error recovery. Use when writing or reviewing a component, hook, form, context, Server Action or data-loading page in this app, or when a react-hooks, @eslint-react or typescript-eslint rule fires and the fix is not obvious.
---

# react-patterns: how React 19 and Next.js 16 code looks in this app

The path-scoped rules (`.claude/rules/react.md`, `next-app-router.md`, `server-actions-data.md`, `typescript.md`, `testing.md`) state the rules in one line each. This skill shows them as code, in Carshenas's own domain (listings, valuations, deal ratings, saved searches, filters). Read only the module you need:

| Module | Read when |
|---|---|
| `references/state-and-effects.md` | adding `useState`, `useEffect`, `useReducer`; a value "must stay in sync"; an `exhaustive-deps`, `set-state-in-effect` or purity rule fires; loading/error flags multiply |
| `references/composition-and-boundaries.md` | deciding where `'use client'` goes; passing server-rendered UI into an interactive wrapper; creating a context; a component takes a fifth boolean prop; an icon-only button |
| `references/data-and-actions.md` | a page or component needs data; a form submits; a list should update before the server answers; cached data must refresh after a change; an error needs a retry |

Every "after" pattern in these modules was linted and type-checked against this repo's configuration on 2026-09-21 (except the Zod schema, whose package is added with the first real schema). On 2026-09-26 the examples' names and copy were translated into the Carshenas domain without changing the patterns; they have not been re-linted since, so run the check again when you next edit one. If a pattern here and a lint rule disagree, the lint rule wins and this skill gets fixed.

## Precedence

This skill and the project rules outrank any user-level or third-party React skill installed on the machine. In particular, Vercel's `react-best-practices` skill (if present in `~/.claude/skills`) predates React 19.2's `useEffectEvent` and still recommends latest-ref and handler-ref patterns and manual memoisation; here the React Compiler is on, so do not add `useMemo`, `useCallback` or `memo` without a measured reason.

## Sources

React documentation (react.dev: `useActionState`, `useOptimistic`, `use`, `useEffectEvent`, `useSyncExternalStore`, "You Might Not Need an Effect", "Preserving and Resetting State", React Compiler 1.0 post of 2025-10-07); Next.js 16.3.5 bundled docs (fetching data, caching, mutating data, error handling, `catchError`); Dan Abramov (overreacted.io: "Before You memo()", "Writing Resilient Components", "What Does 'use client' Do?"); Kent C. Dodds (kentcdodds.com: "Don't Sync State. Derive It!", "How to use React Context effectively", "Stop using isLoading booleans", "State Colocation"; paraphrased, not quoted, because his posts are licensed GPL v3 for non-commercial use); Dominik Dorfmeister (tkdodo.eu: "Don't over useState", "Component Composition is great btw", design-system principles 2025-12-01); Mark Erikson (React rendering behaviour). The research note `docs/research/2026-09-21-react-19-nextjs-16-knowledge-for-agents.md` has dates, links and the reasoning.
