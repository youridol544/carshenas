---
paths:
  - "apps/web/src/app/**"
  - "apps/web/next.config.ts"
---

# Next.js 16 App Router files (`src/app`)

The bundled docs (`apps/web/node_modules/next/dist/docs/`) are the reference for every API; read the guide before using one. This file is what the docs do not decide for us. `web-app.md` has the structure; lint keeps app files under 80 lines and default-exported only where Next requires it.

## Server first

- Everything is a Server Component until it needs state, effects, browser APIs or event handlers; then `'use client'` goes on that leaf, not on the file that composes it. Once a file says `'use client'`, everything it imports is client code (Abramov: `'use client'` is a typed `<script>`, `'use server'` a typed `fetch()`). Pass server-rendered UI into client components as `children` or props; never import it there.
- Props across the boundary are plain serialisable data; the only function props are Server Functions (`action` or `*Action`). Compound `Menu.Item` exports break across the boundary.
- Fetch in Server Components directly from the source (a `server/<feature>-queries.ts` function), never through a Route Handler and never through a Server Action (actions are serialised, so reads through them queue). Start independent requests together, then `await Promise.all`; `fetch` memoisation and `React.cache` last for one request only.
- `notFound()` before the first suspending `await`; a 404 raised after streaming starts returns HTTP 200 with a `noindex` tag. With Partial Prefetching on, a page reads its `params` behind Suspense, so a listing that turns out to be missing gets exactly that; CS-17 decides whether that is acceptable for listing pages.

## Cache Components (`cacheComponents: true`)

- Every `await` on a route is one of three things on purpose: streamed inside `<Suspense>` (the default), cached with `'use cache'` plus `cacheLife(...)`, or explicitly blocking. Put async work as deep as possible so the shell prerenders.
- `'use cache'` functions are async, take serialisable arguments, and never read `cookies()`, `headers()` or `searchParams` inside; read those outside and pass values in. `children` pass through without joining the cache key. Tags and keys are stored in plain text: no personal data in them.
- Invalidate from actions with `updateTag(tag)` (read-your-writes) or `revalidateTag(tag, 'max')`; `refresh()` re-renders uncached data. Route segment exports `dynamic`, `revalidate` and `fetchCache` fail the build here; `unstable_cache` still works but is replaced by `'use cache'`, so add no new uses; `experimental.dynamicIO`, `useCache` and `ppr` are replaced by `cacheComponents` (bundled migration guide).
- Synchronous IO in the prerendered shell fails the build: `new Date()`, `Date.now()`, `Math.random()`, `crypto.randomUUID()`. Call `connection()` first inside a `<Suspense>` boundary, or do it in a client component. A Jalali «امروز» date is exactly this case.
- `params`, `searchParams`, `cookies()`, `headers()` are async; type pages with the generated `PageProps<'/route'>` / `LayoutProps` and run `next typegen` (part of `pnpm typecheck`). Root `<html lang="fa" dir="rtl">` is hard-coded: root attributes cannot be wrapped in Suspense.

## Files and built-ins

- `loading.tsx` does not wrap the segment's `layout` or `error`; `error.tsx` is a client component using `retry` (stable since 16.3), and a single failing widget gets a component boundary made with `catchError(Fallback)` from `next/error` instead of failing the route; `global-error.tsx` must repeat `lang`, `dir` and the font; the root element of `error.tsx` and `global-error.tsx` carries `data-error-screen`, which the gorilla's error-screen oracle looks for; `not-found.tsx` renders Farsi copy (CS-3). Parallel slots need `default.tsx`.
- `proxy.ts` replaced middleware: Node only, constant `matcher`, never the authorisation boundary (five middleware bypass CVEs in 2026); authorise in the data layer.
- `next/image`: images are unoptimized app-wide (`images.unoptimized` in `next.config.ts`), so a listing photo is hotlinked from its source and never downloaded, resized or cached by our server (ADR-0008); turning the optimizer back on needs an ADR that supersedes that. `loading="eager"` with `fetchPriority="high"` for the one above-the-fold image (`priority` is deprecated); `fill` inside a positioned `aspect-*` frame.
- Fonts: `next/font/local` only (`next/font/google` downloads at build time, which fails from inside Iran); call the loader once at module scope and expose it as a CSS variable for Tailwind's `@theme`.
- `<Link>` for internal navigation. Partial Prefetching is on (`next.config.ts`): each link prefetches its route's shared App Shell, and `params`, `searchParams` and anything read from them sit behind Suspense. `prefetch={true}` only where URL-specific content must be ready on arrival (above-the-fold listing cards); it brings only content cached with `'use cache'`, so that content must be cached. `prefetch={false}` only where prefetching is wasteful, then with a fixed-size `useLinkStatus` hint that fades in after about 100 ms so a slow navigation still answers the tap; `next/form` for GET search forms; anything reading `useSearchParams` sits under `<Suspense>` or the build fails. `useRouter` comes from `next/navigation`.
- Metadata through the `metadata`/`generateMetadata` exports and the `viewport` export, with `metadataBase` and `title.template` in the root layout; every page gets a unique Farsi title (the route announcer reads it). JSON-LD in a native `<script>` with every `<` in the JSON escaped as `\u003c`. The bundled OG image renderer (satori) does not support RTL: use a static `opengraph-image.png` for Farsi.
- Environment variables are read only in `src/server/env.ts` (lint); `NEXT_PUBLIC_*` values are frozen at build time.
- `next build` no longer prints bundle sizes; use `next experimental-analyze`. Turbopack is the default bundler for dev and build: no `--turbopack` flags and no webpack config (`--webpack` exists only as an escape hatch and needs an ADR).
