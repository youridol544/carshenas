---
paths:
  - "apps/web/src/features/*/*-actions.ts"
  - "apps/web/src/features/*/*-schemas.ts"
  - "apps/web/src/features/*/server/**"
  - "apps/web/src/server/**"
---

# Server Actions, schemas and the data layer

Lint already enforces the shape: `'use server'` files export only `async function <verb><Noun>Action`, every `server/` file starts with `import 'server-only'`, and only `src/server/env.ts` reads `process.env`. This file is what lint cannot see. Sources: Next.js 16 guides "Mutating data" and "Data security" (bundled docs); Sebastian Markbåge, "How to Think About Security in Next.js" (2023-10-23); Dan Abramov, "One Roundtrip Per Navigation" (2025-05-29); Zod 4 docs and migration guide; lab runs on 2026-09-17 (Zod 4.6, Node 22). Worked examples: the `react-patterns` skill, `references/data-and-actions.md`.

## Every action is a public endpoint

- "Server Functions are reachable via direct POST requests, not just through your application's UI", and "a page-level authentication check does not extend to the Server Actions defined within it" (Next data-security guide). Each action establishes who is calling and whether they may touch this record, inside the action or the `server/` function it calls. Auth is deferred (ADR-0003); when it lands, verifying the session is the first line of every action and ownership is checked in the query, not in the page.
- Every argument is hostile: form fields, hidden inputs and `.bind()` arguments alike (bound arguments "are NOT encrypted", Markbåge). Parse the whole input with the feature's schema before using any of it. Never trust a price, a market value, a deal rating or a listing id sent by the client: look them up.
- Whatever an action returns is serialised to the browser: return the minimum the UI needs, never a raw record, an `Error` or a stack.

## Shape of an action

- For forms: `(previous: State, formData: FormData) => Promise<State>` with `useActionState`, where `State` is a discriminated union (`idle` | `invalid` with field errors | `failed` with a Farsi message | `done` with what the UI needs). Expected failures (invalid input, listing no longer available, unsupported link) are returned; only unknown failures throw, and `error.tsx` catches those.
- Order inside: parse → authorise → mutate through `server/` → invalidate (`updateTag(tag)` for read-your-writes, `revalidateTag(tag, 'max')` otherwise; the one-argument form is deprecated) → `redirect()` last and outside any `try`, because it works by throwing. An action behind an optimistic control needs `updateTag` (or `refresh()`): `revalidateTag(tag, 'max')` sends no re-render with the response, so the control snaps back to the old value when the action ends (Next.js 16.3 server-actions guide).
- Make mutations safe to repeat where a double press is plausible: prefer setting a value to incrementing it (upsert "saved" rather than toggling it, set an alert's price threshold rather than adjusting it), and give operations that must happen once, such as sending an alert, a one-time token checked on the server. Our rule; the gorilla tests press buttons twice on purpose.
- Messages people read are Farsi and say what happened and how to fix it (`ui-design` skill, states reference). Technical detail is logged on the server, never returned.

## Schemas (`<feature>-schemas.ts`, Zod 4 as ADR-0004 lays out; add `zod` with the first schema)

- `import * as z from 'zod'`. Zod 3 habits that break or are deprecated in Zod 4: `invalid_type_error`, `required_error` and `errorMap` (one `error` parameter instead), `z.string().email()` (`z.email()`), `.flatten()`/`.format()` (`z.flattenError`, `z.treeifyError`), `.strict()` (`z.strictObject`), `z.nativeEnum` (`z.enum`). The forms example in the Next 16 docs is Zod 3 style and fails type-checking on Zod 4: do not copy it.
- Normalise before validating: Persian (۰–۹) and Arabic-Indic (٠–٩) digits to Latin, thousands separators (`٬` `,`) removed, whitespace trimmed. `z.coerce.number()` turns `''` and `null` into `0` and rejects «۱۲», so never use it on raw form data and never for money. `z.coerce.boolean('false')` is `true`: use `z.stringbool()`.
- Money is an integer in the smallest unit (the unit is CS-2's decision), validated with `z.int().nonnegative()`. Never a float, never `parseFloat`.
- Iranian mobile numbers are normalised to one canonical form before comparing or storing (any digit script; spaces, dashes and the `+98`/`0098` prefix handled).
- Write every Farsi error message explicitly on the rule; Zod's `fa` locale still prints English type names.
- The same schema serves the action and, only if instant field feedback is really needed, the client (then `zod/mini`: 4.9 KB gzip on the client instead of 24.3 KB, measured 2026-09-18).

## Data layer (`server/`)

- `import 'server-only'` needs no package: Next.js resolves it in builds and `vitest.config.mts` aliases it for tests (both checked on 2026-09-21).
- Until a database exists (ADR-0003), `server/<feature>-queries.ts` functions read typed fixtures and return exactly the DTOs a real backend will. Pages and components never import fixtures. Swapping in a database must not touch a component.
- Reads happen in Server Components through these functions: never through a Server Action (actions are queued, so reads through them run one after another) and never through a Route Handler of our own.
- Cacheable reads use `'use cache'`, `cacheLife('<profile>')` and `cacheTag('<entity>:<id>')` inside the query function; the action invalidates the same tag string. No personal data in tags or cache keys: they are stored in plain text.
- Start independent reads together and `await Promise.all(...)`: one round trip per navigation. `React.cache` deduplicates a function called by several components within one request; it does not persist between requests.
- Query functions accept plain values (ids, filters) and return plain data; they never read `cookies()` or `headers()` themselves when they are cached. The caller reads those and passes values in.
