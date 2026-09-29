# Data loading, Server Actions and errors (Next.js 16.3, React 19.3)

Structure and names follow ADR-0004: `src/features/<feature>/server/<feature>-queries.ts` for reads, `<feature>-actions.ts` for mutations, `<feature>-schemas.ts`, `<feature>-types.ts`. Until the data layer exists the queries read typed fixtures (ADR-0003, ADR-0007).

## 1. Read on the server, not in an effect

```tsx
// before
'use client';
export function ModelListings({ modelId }: { modelId: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  useEffect(() => {
    fetch(`/api/models/${modelId}/listings`)
      .then((response) => response.json())
      .then(setListings);
  }, [modelId]);
  return <ListingList listings={listings} />;
}
```

```tsx
// after: a Server Component calls the query function directly
import { listModelListings } from '@/features/listings/server/listings-queries';

export async function ModelListings({ modelId }: { modelId: ModelId }) {
  const listings = await listModelListings(modelId);
  return <ListingList listings={listings} />;
}
```

Why: the effect version ships the component to the browser, waits for hydration before it even starts, races when `modelId` changes, and needs an API route of our own. Next: "Fetch data in Server Components directly from its source, not via Route Handlers."

## 2. A dynamic page under Cache Components: pass the params promise down, read in parallel

```tsx
// src/app/models/[slug]/page.tsx: not async, so the shell prerenders
import { Suspense } from 'react';
import { ModelPageContent, ModelPageSkeleton } from '@/features/listings/components/model-page-content';

export default function ModelPage({ params }: PageProps<'/models/[slug]'>) {
  return (
    <main className="flex flex-col gap-6 p-4">
      <Suspense fallback={<ModelPageSkeleton />}>
        <ModelPageContent params={params} />
      </Suspense>
    </main>
  );
}
```

```tsx
// src/features/listings/components/model-page-content.tsx
export async function ModelPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [model, listings] = await Promise.all([getModelBySlug(slug), listListingsForModelSlug(slug)]);
  if (model === null) notFound();
  return (
    <>
      <ModelHeader model={model} />
      <ListingList listings={listings} />
    </>
  );
}
```

Why: with `cacheComponents`, a dynamic `params` is request-time data; awaiting it at the top would block the whole route, so the docs pass the promise into a component under `<Suspense>` ("Maximizing the static shell"). Both reads start before either is awaited: one round trip, no waterfall. Trade-off: `notFound()` after streaming has started sends the not-found UI with HTTP 200 and `noindex`; when a real 404 status matters for a route, prerender its known slugs with `generateStaticParams`, or make the route blocking: read the params and check existence at the top of the page, with no boundary above it, and export `instant = false`, without which the build fails with a blocking-prerender error. Listing pages do the latter (`next-app-router.md`).

## 3. Hand a slow read to the client as a promise

```tsx
// server: start the read, do not await it
const comparablesPromise = listComparables(listing.id);
<Suspense fallback={<ComparablesSkeleton />}>
  <Comparables comparablesPromise={comparablesPromise} />
</Suspense>
```

```tsx
// client leaf
'use client';
import { use } from 'react';

export function Comparables({ comparablesPromise }: { comparablesPromise: Promise<readonly ComparableView[]> }) {
  const comparables = use(comparablesPromise);
  return (
    <ul className="flex flex-col gap-2">
      {comparables.map((comparable) => (
        <li key={comparable.id}>{comparable.title}</li>
      ))}
    </ul>
  );
}
```

Why: the page streams without waiting for the comparables, and the client component still gets the data. Never create the promise during a client render (`use(fetch(url))`): it is recreated every render and suspends forever (react.dev, `use`).

## 4. A form is an Action: `useActionState`, a result union, Farsi messages

```tsx
// before
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setIsLoading(true);
  const response = await fetch('/api/alerts', { method: 'POST', body: new FormData(event.currentTarget) });
  if (!response.ok) setError('Error');
  setIsLoading(false);
}
```

```ts
// src/features/alerts/alerts-types.ts
export type SetMileageLimitState =
  | { status: 'idle' }
  | { status: 'invalid'; message: string }
  | { status: 'failed'; message: string }
  | { status: 'saved'; maxMileageKm: number };
```

```ts
// src/features/alerts/alerts-schemas.ts (Zod 4)
import { toLatinDigits } from '@carshenas/locale/digits';
import * as z from 'zod';

export const setMileageLimitSchema = z.object({
  searchId: z.string().min(1),
  maxMileageKm: z
    .string()
    .overwrite((value) => toLatinDigits(value).trim())
    .regex(/^\d{1,7}$/, { error: 'کارکرد را با رقم وارد کنید' })
    .transform(Number)
    .pipe(z.int().min(0, { error: 'کارکرد نمی‌تواند منفی باشد' })),
});
```

```ts
// src/features/alerts/alerts-actions.ts
'use server';
import { updateTag } from 'next/cache';

export async function setMileageLimitAction(
  _previous: SetMileageLimitState,
  formData: FormData,
): Promise<SetMileageLimitState> {
  const parsed = setMileageLimitSchema.safeParse({
    searchId: formData.get('searchId'),
    maxMileageKm: formData.get('maxMileageKm'),
  });
  if (!parsed.success) {
    return { status: 'invalid', message: parsed.error.issues[0]?.message ?? 'ورودی را بررسی کنید' };
  }
  // the saved search, its owner and its filters are looked up on the server, never taken from the form;
  // "set the limit to N" is safe to repeat when a button is pressed twice
  const result = await upsertMileageLimit(parsed.data.searchId, parsed.data.maxMileageKm);
  if (result.kind === 'search-not-found') return { status: 'failed', message: 'این جست‌وجو دیگر وجود ندارد' };
  updateTag(`saved-search:${result.searchId}`);
  return { status: 'saved', maxMileageKm: result.maxMileageKm };
}
```

```tsx
// src/features/alerts/components/mileage-limit-form.tsx
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Spinner } from '@/components/ui/spinner';

function SaveButton() {
  const { pending } = useFormStatus(); // reads the parent <form>, so it must be a child component
  return (
    <button
      type="submit"
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      // a second press while the first is in flight does nothing; aria-disabled alone does not stop clicks
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className="group inline-flex min-h-12 items-center gap-2 px-4"
    >
      ذخیره
      {/* its slot is always there, so the label and width never change; it turns only while pending (never shown
          mid-turn) and fades in after the pending delay, so a fast save never flashes it */}
      <Spinner className="size-4 opacity-0 transition-opacity group-data-pending:animate-spin group-data-pending:opacity-100 group-data-pending:delay-pending" />
    </button>
  );
}

export function MileageLimitForm({ searchId, initialMaxMileageKm }: { searchId: string; initialMaxMileageKm: number }) {
  const [state, formAction] = useActionState(setMileageLimitAction, { status: 'idle' });
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="searchId" value={searchId} />
      <label htmlFor={`mileage-${searchId}`}>حداکثر کارکرد (کیلومتر)</label>
      <input
        id={`mileage-${searchId}`}
        name="maxMileageKm"
        type="text"
        inputMode="numeric"
        defaultValue={initialMaxMileageKm}
        aria-invalid={state.status === 'invalid'}
        aria-describedby={`mileage-${searchId}-message`}
      />
      {/* the line is always there (one line box tall), so a message appearing never pushes the button down */}
      <p id={`mileage-${searchId}-message`} role="status" className="min-block-lh">
        {state.status === 'invalid' || state.status === 'failed' ? state.message : null}
      </p>
      <SaveButton />
    </form>
  );
}
```

Why: "Unlike `onSubmit`, an `action` runs in a Transition and calling `e.preventDefault()` isn't needed" (react.dev, `<form>`); the form works before JavaScript loads. Expected failures come back as state and render next to the field; only unknown errors throw to `error.tsx`. `aria-disabled` rather than `disabled` keeps focus on the button while it is pending. The button keeps its label and width while pending (a label swap resizes it and moves its neighbours); the indicator waits for the pending delay (`--transition-delay-pending`, a CS-3 token, about 400 ms) so a fast save never flashes it. The `ui-design` skill's `references/craft.md` has the timing sources. The action parses everything itself because it is a public endpoint (Next data-security guide).

## 5. An optimistic stepper: `useOptimistic` inside the action, and the result still shown

```tsx
'use client';
import { useActionState, useOptimistic } from 'react';

export function MileageLimitStepper({ searchId, maxMileageKm, stepKm }: MileageLimitStepperProps) {
  const [state, formAction] = useActionState(setMileageLimitAction, { status: 'idle' });
  const [shownLimit, setShownLimit] = useOptimistic(maxMileageKm);
  const atMinimum = shownLimit <= 0;

  function changeTo(nextLimit: number) {
    return (formData: FormData) => {
      setShownLimit(nextLimit);
      formData.set('maxMileageKm', String(nextLimit));
      formAction(formData);
    };
  }

  return (
    <div className="flex flex-col gap-1">
      <form className="flex items-center gap-2">
        <input type="hidden" name="searchId" value={searchId} />
        {/* first in source order = right-hand side in RTL: decrement on the right (NN/g) */}
        <button
          type={atMinimum ? 'button' : 'submit'}
          formAction={atMinimum ? undefined : changeTo(shownLimit - stepKm)}
          aria-disabled={atMinimum}
          aria-label="کارکرد کمتر"
          className="size-11 aria-disabled:opacity-60"
        >
          −
        </button>
        {/* tabular digits and a box sized for the widest value («۲۰۰٬۰۰۰»): the − and + buttons never move */}
        <output aria-live="polite" className="min-w-24 text-center tabular-nums">
          {formatCount(shownLimit)}
        </output>
        <button type="submit" formAction={changeTo(shownLimit + stepKm)} aria-label="کارکرد بیشتر" className="size-11">
          +
        </button>
      </form>
      <p role="status" className="min-block-lh">
        {state.status === 'failed' || state.status === 'invalid' ? state.message : null}
      </p>
    </div>
  );
}
```

Why: the optimistic value shows at once and falls back to the server's `maxMileageKm` automatically when the Action settles, including when it fails. That fallback alone is silent, so the action's own result is rendered too: «این جست‌وجو دیگر وجود ندارد» explains why the number jumped back. Call the `useOptimistic` setter only inside an Action or Transition (react.dev). Use it where the outcome is predictable (a limit, a saved listing), never for anything the server must confirm first. At the minimum the minus button stays focusable and says why through `aria-disabled` (a `disabled` button drops keyboard focus), and becomes a plain button so it submits nothing.

## 6. Cache a read, invalidate it after a write

```ts
// src/features/listings/server/listings-queries.ts
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

export async function listModelListings(modelId: ModelId): Promise<readonly ListingCardView[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(`model-listings:${modelId}`);
  const snapshot = await readListingsFixture();
  return snapshot.listings.filter((listing) => listing.modelId === modelId).map(toListingCardView);
}

// in the Server Action that hides a listing a buyer reported, after the write:
updateTag(`model-listings:${modelId}`);
```

Why: `'use cache'` with a profile and a tag makes the read part of the prerendered shell; `updateTag` in a Server Action gives read-your-writes. Work that happens outside a request, such as the ingestion worker writing new listings (ADR-0007), calls a Route Handler that runs `revalidateTag(tag, 'max')`, the stale-while-revalidate form (Next caching and revalidating guides). The tag contains an id, never personal data.

## 7. Errors: a route boundary with `retry`, component boundaries with `catchError`

```tsx
// src/app/models/[slug]/error.tsx
'use client';

export default function ModelError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-xl font-bold">صفحهٔ این مدل باز نشد</h1>
      <p>ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.</p>
      <button type="button" className="min-h-12 px-4" onClick={() => { retry(); }}>
        تلاش دوباره
      </button>
    </main>
  );
}
```

Why: `retry()` re-fetches and re-renders the segment inside a Transition, keeping client state outside the boundary (Next 16.3 error-handling docs; it replaces `reset`). For one failing widget inside a page, wrap it with a component made by `catchError(Fallback)` from `next/error` instead of failing the route. `global-error.tsx` must render its own `<html lang="fa" dir="rtl">` and `<body>`.
