---
paths:
  - "apps/web/src/**/*.tsx"
---

# React 19 in this app (what the linter cannot see)

ESLint already rejects `forwardRef`, `Context.Provider`, `useContext`, `useFormState`, index keys, nested component definitions, leaked `&&` renders, missing effect deps and the rest of the React 19 API drift. These rules are the judgement calls. Sources: react.dev reference and "You Might Not Need an Effect"; Dan Abramov (overreacted.io); Kent C. Dodds (kentcdodds.com, paraphrased, GPL); Dominik Dorfmeister (tkdodo.eu); Mark Erikson. Worked before/after examples: the `react-patterns` skill.

## Mutations and data

- A mutation is an Action: `<form action={fn}>`, `useActionState`, or `startTransition(async () => …)`. Never `onSubmit` + `preventDefault` + an `isLoading` boolean. Inputs are named and uncontrolled (`defaultValue`), and they reset on success.
- Expected failures (validation, "listing no longer available", "link not supported") are returned as state from the action; only unknown errors throw. `useFormStatus` reads only a parent `<form>`; put the submit button in its own child component.
- Call the `useOptimistic` setter only inside an Action; use it where the outcome is predictable (saving a listing, switching an alert on), not for anything the server must confirm first.
- `use(promise)`: the promise is created outside render (a Server Component starts the fetch and passes it down; `use` reads it under `<Suspense>`). `use(fetch(url))` or `use(p.then(f))` in a component re-suspends every render. Start every request before the first `use` to avoid waterfalls.
- Server data has no client cache library yet (ADR-0003): read in Server Components, mutate through actions, refresh through revalidation. Do not copy server data into `useState`.

## State and effects

- Derive, don't sync: if a value can be computed from props and state during render, compute it (`total = lines.reduce(...)`); a `useState` whose setter is only called from an effect is a bug (TkDodo). Client picks that depend on server data stay raw and are validated on read (`validId = users.some(u => u.id === selectedId) ? selectedId : null`).
- Effects are for external systems only (subscriptions, DOM measurements, non-React widgets). Instead of an effect: derived values → compute; reset state → `key`; react to a user action → the handler or Action; notify a parent → call `onChange` in the same handler; external store → `useSyncExternalStore`; DOM node work → a ref callback (React 19 ref callbacks return a cleanup). No `useMount`/`useEffectOnce` wrappers.
- The dependency array is the truth. Never silence `exhaustive-deps`; if a dependency is unwanted, change the code: read the latest value with `useEffectEvent` (19.2), move the logic into the handler, or make the effect depend on the primitive. `useEffectEvent` functions are never listed in deps and never passed to other components.
- Reset a form or a subtree by changing its `key` (`<SavedSearchForm key={search.id} initialName={search.name} />`); never mirror a prop into state. An intentional initial copy is named `initialX`.
- Colocate state in the component that uses it; lift only to the closest common parent. Ask "if this component rendered twice, should this interaction show in both copies?" (Abramov). Global state is the leading cause of slow apps (Dodds).
- Composition before context and before `memo`: move state down, or lift content up as `children` so the moving part re-renders alone. Context is transport, not state management; one context per concern, provider as deep as possible. Split value and dispatch contexts only after measuring.
- Model exclusive states as a union or a status field (`{ status: 'pending' } | { status: 'resolved', listing } | { status: 'rejected', error }`), rendered with early returns; the first boolean prop is where impossible states start (Dodds, TkDodo).
- `useState` for independent values; `useReducer` when several values update together, with actions named after events (`filterApplied`), not `setX`.
- Controlled first, uncontrolled if necessary, and typed either way (TkDodo); Action forms are the uncontrolled case.
- Custom hooks only when they hide real complexity, named `use*` only if they call hooks; some duplication is fine; a reusable hook must not force callers to memoise inputs (use `useEffectEvent` inside).

## Rendering and performance

- The React Compiler is on (`reactCompiler: true`). Do not add `useMemo`/`useCallback`/`memo` by default; add them only with a measured reason and keep existing ones (removing changes compilation output). `"use no memo"` is a debugging escape, never committed.
- Never call a component as a function (`{Row(item)}`): render it (`<Row item={item} />`), or its hooks and state belong to the caller. Lint catches the other Rules of React (purity, refs during render, mutation, components declared inside components).
- Client-only values (viewport, media queries, time, locale) without a hydration mismatch: `useSyncExternalStore` with a deterministic server snapshot, or render them under `<Suspense>` after mount. Jalali dates and Persian digits are formatted on the server (`persian-type-formatting` reference).
- Suspense boundaries match the loading sequence a user should see, not one per component; every boundary has an error boundary partner; updates that may suspend go inside a Transition. `<Activity mode="hidden">` for tabs and drawers whose state must survive; its effects are torn down, so every effect has a cleanup.
- Fix slow renders before unnecessary renders (Dodds); measure before optimising; keep lists keyed by id and DOM small.
