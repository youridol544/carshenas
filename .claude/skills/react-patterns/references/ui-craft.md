# UI craft in code: skeletons, pending states, optimistic updates, undo, tooltips, view transitions

The `ui-design` skill's `references/craft.md` says what to do and why, with sources. This module shows how, with the installed versions: Next.js 16.3.5 with per-link prefetching and unoptimized images, React 19.3.0 (Vitest) and Next.js's bundled React 19.3 canary (App Router). Names follow the glossary; tokens such as `bg-muted`, `delay-stale` or `duration-press` are CS-3 proposals and render nothing until `docs/design/design-language.md` defines them.

**Verified on 2026-09-26.** Every file below passed this repo's lint (strict typed rules, React, accessibility, boundaries) and `pnpm typecheck` in place, and ran in `next dev` in headless Chromium:

- **Skeleton**: skeleton and real rows measured 145 px each at 412 px, the photo frames stayed 112 × 84 px (4:3), and layout shift was 0. The skeleton was mounted invisible and faded in after the pending delay.
- **Optimistic save**: the bookmark flipped 25 ms after the tap and held with `updateTag`. The same action with `revalidateTag(tag, 'max')` flipped at 20 ms, then jumped back at 451 ms when the action ended.
- **Failed save**: it flipped, rolled back within 200 ms and showed its toast. When the action threw instead (a server error), the version without `try`/`catch` flipped back silently: no toast, only an uncaught page error. The version below shows «نشان نشد…» with a retry.
- **Undo list, by keyboard**: pressing «حذف» moved focus to the next row's button at once, and it stayed there when the row left; pressing «بازگرداندن» in the toast returned focus to where it had come from, and the row came back.
- **Photo and its fallback** (CS-27): with `images.unoptimized`, the card's image kept its URL as its `src`, had no `srcset`, rendered in its 112 × 84 frame, and made no `/_next/image` request. When the photo answered 404, `ListingPhoto` showed «بدون عکس» in the same frame instead of the alt text. Photos load from the source's own addresses (ADR-0025); the check used a stand-in host.
- **Tooltip group**: the first hint opened after 600 ms and its neighbour at once; after the 400 ms window the delay applied again. A hint stayed open under the pointer, closed on Escape without moving focus, opened on keyboard focus but not on a click's focus, and never opened on touch.

The type, schema and `server/` modules the examples import are not shown: they follow `data-and-actions.md`.

## 1. A skeleton built from the component's own frame

Smell: a `ListingCardSkeleton` written by hand next to the card, or an `isLoading` prop on the card. Both drift from the real layout, and the page jumps when the data arrives.

```tsx
// src/components/ui/skeleton.tsx
// Placeholders for the first load of a view (ui-design craft.md, section 3). Server Components: no hooks, no
// 'use client'. The look lives in the globals.css utilities skeleton-bar and skeleton-block.

const LINE_KEYS = ['line-1', 'line-2', 'line-3'] as const; // fixed keys: the lint rejects index keys

type SkeletonTextProps = { lines?: 1 | 2 | 3; lastLineWidth?: 'w-1/3' | 'w-1/2' | 'w-2/3' | 'w-full' };

/** Placeholder text: each line is one line box of the surrounding text style, so it is as tall as the real text. */
export function SkeletonText({ lines = 1, lastLineWidth = 'w-2/3' }: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className="flex flex-col">
      {LINE_KEYS.slice(0, lines).map((key, position) => (
        <span key={key} className="flex items-center block-lh">
          <span className={`skeleton-bar ${position === lines - 1 ? lastLineWidth : 'w-full'}`} />
        </span>
      ))}
    </span>
  );
}

/** Placeholder media: it fills the frame it is given, so the frame keeps the real photo's ratio. */
export function SkeletonBlock() {
  return <span aria-hidden="true" className="skeleton-block block size-full" />;
}
```

```css
/* globals.css: the token names are proposals until CS-3 */
@utility skeleton-bar {
  display: block;
  block-size: var(--skeleton-bar-size); /* a bar centred inside a 1lh line box */
  border-radius: var(--radius-sm);
  background-color: var(--color-skeleton);
}
@utility skeleton-block {
  position: relative;
  overflow: hidden;
  background-color: var(--color-skeleton);
  @media (prefers-reduced-motion: no-preference) {
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      translate: 100% 0;
      background-image: linear-gradient(to left, transparent, var(--color-skeleton-highlight), transparent);
      animation: skeleton-shimmer var(--transition-duration-shimmer) ease-in-out 3; /* three 1.5 s runs end before 5 s (WCAG 2.2.2) */
    }
  }
}
@keyframes skeleton-shimmer {
  /* this app is right-to-left only: the highlight travels the way Persian reads */
  from { translate: 100% 0; }
  to { translate: -100% 0; }
}
@utility skeleton-delayed {
  /* a fast answer never flashes grey boxes; opacity leaves the reserved space in place */
  animation: skeleton-appear var(--transition-duration-popover) ease-out var(--transition-delay-pending) both;
}
@keyframes skeleton-appear {
  from { opacity: 0; }
}
@utility min-block-2lh {
  min-block-size: 2lh;
}
```

```tsx
// src/features/listings/components/listing-card.tsx
import Link from 'next/link';
import { type ReactNode } from 'react';
import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
import { ListingPhoto } from '@/features/listings/components/listing-photo';
import { ListingPhotoTransition } from '@/features/listings/components/listing-photo-transition';
import type { ListingCardView } from '@/features/listings/listings-types';

type ListingCardSlots = {
  media: ReactNode;
  title: ReactNode;
  price: ReactNode;
  facts: ReactNode;
  actions?: ReactNode;
};

/** The card's geometry in one place. ListingCard and ListingCardSkeleton both render it, so they cannot drift. */
function ListingCardFrame({ media, title, price, facts, actions }: ListingCardSlots) {
  return (
    <div className="relative flex gap-3 p-3">
      {/* first in source order = the right-hand side in RTL: the thumbnail sits on the right. self-start, because a
          stretched flex item ignores its aspect ratio */}
      <div className="bg-muted relative aspect-4/3 w-28 shrink-0 self-start overflow-hidden rounded-md">
        {media}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* every slot has a fixed number of lines (two, one, two), so a skeleton row is exactly as tall as a real one */}
        <div className="min-block-2lh text-base font-bold">{title}</div>
        {/* a static price stays proportional: tabular Persian digits would make it half as wide again */}
        <div className="text-base">{price}</div>
        <div className="min-block-2lh text-sm">{facts}</div>
      </div>
      {/* reserved in the skeleton too; after the title link in source order and positioned, so it sits above the
          link's stretched hit area and keeps its own 44 px target */}
      <div className="relative size-11 shrink-0">{actions}</div>
    </div>
  );
}

type ListingCardProps = {
  listing: ListingCardView;
  actions?: ReactNode;
  /** One of the cards the first screen shows: its link prefetches the whole listing page. */
  aboveTheFold?: boolean;
};

export function ListingCard({ listing, actions, aboveTheFold = false }: ListingCardProps) {
  return (
    <ListingCardFrame
      media={
        // the source's own photo, loaded from its address (ADR-0025)
        <ListingPhotoTransition listingId={listing.id}>
          <ListingPhoto src={listing.photoUrl} alt={listing.title} />
        </ListingPhotoTransition>
      }
      title={
        <h3 className="line-clamp-2">
          {/* the title link covers the whole card, so the card is one target (craft.md, targets) */}
          <Link
            href={`/listings/${listing.id}`}
            // the first screen's cards prefetch the whole listing page, so a tap opens it at once and the
            // photo morph plays
            prefetch={aboveTheFold ? true : undefined}
            transitionTypes={['nav-forward']}
            className="after:absolute after:inset-0"
          >
            {listing.title}
          </Link>
        </h3>
      }
      price={listing.priceLabel}
      facts={<p className="line-clamp-2">{listing.factsLabel}</p>}
      actions={actions}
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <ListingCardFrame
      media={<SkeletonBlock />}
      title={<SkeletonText lines={2} />}
      price={<SkeletonText lastLineWidth="w-1/3" />}
      facts={<SkeletonText lines={2} lastLineWidth="w-1/2" />}
    />
  );
}
```

```tsx
// src/features/listings/components/listing-photo.tsx
'use client';
import Image from 'next/image';
import { useState } from 'react';

/** A listing photo, loaded from the source's own address with no referrer (ADR-0025). A listing without one, or a
 *  photo that fails to load, shows the same-size placeholder instead of its alt text. */
export function ListingPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (src === null || failed) {
    return <span className="flex size-full items-center justify-center text-sm">بدون عکس</span>;
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      referrerPolicy="no-referrer"
      className="object-cover"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
```

```tsx
// src/features/listings/components/listing-list.tsx
import { ListingCard, ListingCardSkeleton } from '@/features/listings/components/listing-card';
import type { ListingCardView } from '@/features/listings/listings-types';

const LIST_CLASS = 'flex flex-col divide-y';
const SKELETON_ROWS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5'] as const; // one 412 × 915 screen of rows
const FIRST_SCREEN_ROWS = SKELETON_ROWS.length;

export function ListingList({ listings }: { listings: ListingCardView[] }) {
  return (
    <ol aria-label="نتایج جست‌وجو" className={LIST_CLASS}>
      {listings.map((listing, position) => (
        <li key={listing.id}>
          <ListingCard listing={listing} aboveTheFold={position < FIRST_SCREEN_ROWS} />
        </li>
      ))}
    </ol>
  );
}

/** The first load of the results. Its height is reserved from the first frame, but it fades in only after the
 *  pending delay, so a fast answer never flashes grey boxes. */
export function ListingListSkeleton() {
  return (
    <div className="skeleton-delayed">
      <p role="status" className="sr-only">
        در حال بارگذاری آگهی‌ها…
      </p>
      <ol aria-hidden="true" className={LIST_CLASS}>
        {SKELETON_ROWS.map((key) => (
          <li key={key}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ol>
    </div>
  );
}
```

```tsx
// src/features/listings/components/listing-results.tsx
import { ListingList } from '@/features/listings/components/listing-list';
import { searchListings } from '@/features/listings/server/listings-queries';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The streamed part of the search page. While a filter chip's navigation runs, the old results stay and dim after
 *  the stale delay instead of turning back into a skeleton. */
export async function ListingResults({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const listings = await searchListings(typeof q === 'string' ? q : '');
  return (
    <div className="group-has-data-pending:delay-stale transition-opacity group-has-data-pending:opacity-50">
      <ListingList listings={listings} />
    </div>
  );
}
```

```tsx
// src/app/search/page.tsx
import { Suspense } from 'react';
import { ListingListSkeleton } from '@/features/listings/components/listing-list';
import { ListingResults } from '@/features/listings/components/listing-results';
import { ListingResultsErrorBoundary } from '@/features/listings/components/listing-results-error-boundary';

// Not async, so the shell (heading, filters) prerenders and only the results stream.
export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">جست‌وجوی خودرو</h1>
      {/* `group`: the filter chips in this section set data-pending while their navigation runs */}
      <section aria-label="نتایج" className="group flex flex-col gap-3">
        <ListingResultsErrorBoundary>
          <Suspense fallback={<ListingListSkeleton />}>
            <ListingResults searchParams={searchParams} />
          </Suspense>
        </ListingResultsErrorBoundary>
      </section>
    </main>
  );
}
```

Why: the geometry is written once, so the skeleton cannot drift from the card; the skeleton is a Server Component that costs no client JavaScript, and the card needs no optional data or `isLoading` branches. Two things broke that promise when it was measured, and both are now in the frame:

- **Every slot needs a fixed number of lines.** On a 412 px phone the facts line wrapped to two lines, which made real rows 20 px taller than skeleton rows. A clamp on the content plus `min-block-2lh` on the slot fixes the count.
- **A thumbnail frame in a flex row needs `self-start`.** A stretched flex item ignores `aspect-ratio`, so the 4:3 frame had grown to the row's height.

`ListingListSkeleton` renders as many rows as fill one screen, with fixed keys. The first screen's cards pass `aboveTheFold`, so their links prefetch the whole listing page (`prefetch={true}`); the other links keep the default. Photos load from the source's own addresses in `listing_photo` (ADR-0025), unoptimized and with no referrer, and `ListingPhoto` falls back to the placeholder when one fails to load. `ListingResultsErrorBoundary` is `catchError` (`data-and-actions.md` §7), with its fallback in the same minimum height. Empty results render inside the same list frame, never a smaller box. Measure the row heights at 412 px before relying on a new frame (`/verify-ui`).

## 2. Pending without flashing: delayed indicators, stale content dimmed

```tsx
// src/features/listings/components/filter-chip.tsx
'use client';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';

/** A filter chip that answers at once: its own state is optimistic, and while the new results are on their way it
 *  marks itself data-pending, which dims the results section (craft.md, section 3). */
export function FilterChip({ label, selected, href }: { label: string; selected: boolean; href: Route }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shownSelected, setShownSelected] = useOptimistic(selected);
  return (
    <button
      type="button"
      aria-pressed={shownSelected}
      data-pending={isPending ? '' : undefined}
      onClick={() => {
        startTransition(() => {
          setShownSelected(!shownSelected);
          router.push(href, { scroll: false });
        });
      }}
      className="aria-pressed:bg-action-subtle inline-flex min-h-11 items-center gap-2 rounded-full border px-4"
    >
      {/* the check always takes its place: selecting changes the fill and the icon, never the chip's width. A stroke
          of 2 on the 24 grid renders 1.33 px at 16 px, the stem of the 16 px regular label (craft.md, icons) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`size-4 ${shownSelected ? 'opacity-100' : 'opacity-0'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M5 12l5 5 9-10" />
      </svg>
      {label}
    </button>
  );
}
```

Why: the chip answers the tap at once (optimistic `aria-pressed`) and keeps its width, because the check icon always takes its place. While the navigation runs, `data-pending` on the chip lets the results in §1 dim through `group-has-data-pending:` after the stale delay: the old results stay readable, nothing turns back into a skeleton, and no `isLoading` prop is threaded through (Next.js 16.3 guide, "Building interactive apps"). Buttons that submit follow `data-and-actions.md` §4: the label stays, and a spinner in a reserved slot fades in after the pending delay. Keeping an indicator on screen at least 300 ms once shown needs a timer: the owner approved the `spin-delay` package on 2026-09-26, and it arrives with the first real indicator (likely CS-61).

## 3. An optimistic toggle whose rollback moves nothing

```ts
// src/features/saved-listings/saved-listings-actions.ts
'use server';
import { updateTag } from 'next/cache';
import { setListingSavedSchema } from '@/features/saved-listings/saved-listings-schemas';
import type { SetListingSavedResult } from '@/features/saved-listings/saved-listings-types';
import { setListingSaved } from '@/features/saved-listings/server/saved-listings-mutations';

// The target state, not a toggle: pressing twice, or retrying after a lost response, ends in the same place.
export async function setListingSavedAction(input: {
  listingId: string;
  saved: boolean;
}): Promise<SetListingSavedResult> {
  const parsed = setListingSavedSchema.safeParse(input); // a public endpoint: parse everything
  if (!parsed.success) return { status: 'failed', message: 'این آگهی را نمی‌شود نشان کرد' };
  // the owner comes from the session inside the mutation, never from the client
  const result = await setListingSaved(parsed.data.listingId, parsed.data.saved);
  if (result.kind === 'listing-not-found')
    return { status: 'failed', message: 'این آگهی دیگر در دسترس نیست' };
  // read-your-writes: this response re-renders with the new truth. revalidateTag(tag, 'max') would not, and the
  // bookmark would jump back to its old state when the action ends
  updateTag(`saved-listings:${result.ownerId}`);
  return { status: 'saved', saved: parsed.data.saved };
}
```

```tsx
// src/features/saved-listings/components/save-listing-toggle.tsx
'use client';
import { startTransition, useOptimistic, useState } from 'react';
import { ToastMessage } from '@/components/ui/toast-message';
import { setListingSavedAction } from '@/features/saved-listings/saved-listings-actions';

export function SaveListingToggle({ listingId, saved }: { listingId: string; saved: boolean }) {
  const [shownSaved, setShownSaved] = useOptimistic(saved);
  const [failure, setFailure] = useState<string | null>(null);

  function save(nextSaved: boolean) {
    setFailure(null);
    startTransition(async () => {
      setShownSaved(nextSaved);
      try {
        const result = await setListingSavedAction({ listingId, saved: nextSaved });
        // the bookmark is already back to the server's truth; say why, in a place that moves nothing
        if (result.status === 'failed') setFailure(result.message);
      } catch {
        // a lost connection or a server error: React would only report it globally, and the bookmark would
        // silently flip back
        setFailure('نشان نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={shownSaved}
        aria-label="نشان کردن آگهی"
        // from the optimistic value, so a quick second tap undoes the first instead of repeating it
        onClick={() => {
          save(!shownSaved);
        }}
        className="inline-flex size-11 items-center justify-center"
      >
        {/* the fill changes as a colour (under 150 ms, kept under reduced motion): no pop, no bounce on a
            control people tap often */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`duration-press size-6 transition-colors ${shownSaved ? 'fill-current' : 'fill-transparent'}`}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        >
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
      </button>
      <ToastMessage
        notice={
          failure === null
            ? null
            : {
                message: failure,
                actionLabel: 'تلاش دوباره',
                onAction: () => {
                  save(!saved);
                },
              }
        }
        onDismiss={() => {
          setFailure(null);
        }}
      />
    </>
  );
}
```

```tsx
// src/components/ui/toast-message.tsx
'use client';
import { useRef, type FocusEvent } from 'react';

export type ToastNotice = { message: string; actionLabel: string; onAction: () => void };

/** One overlay line for messages that must not move the layout. Always mounted, so screen readers announce what
 *  appears in it; it stays until it is acted on or dismissed, never on a timer (craft.md, section 4). */
export function ToastMessage({ notice, onDismiss }: { notice: ToastNotice | null; onDismiss: () => void }) {
  // where focus was before it entered the toast: pressing a button here removes the button, so focus goes back
  // there instead of falling to <body>
  const returnFocusTo = useRef<HTMLElement | null>(null);

  function rememberOrigin(event: FocusEvent<HTMLButtonElement>) {
    const from = event.relatedTarget;
    // moving between the toast's own buttons keeps the original place
    if (from instanceof HTMLElement && !event.currentTarget.parentElement?.contains(from))
      returnFocusTo.current = from;
  }

  function close(then?: () => void) {
    const target = returnFocusTo.current;
    onDismiss();
    then?.();
    if (target?.isConnected) target.focus();
  }

  return (
    <div role="status" className="pointer-events-none fixed inset-x-4 bottom-4 flex justify-center">
      {notice === null ? null : (
        <div className="pointer-events-auto flex items-center gap-3 rounded-md px-4 py-2 shadow-md">
          <p>{notice.message}</p>
          <button
            type="button"
            className="min-h-11 px-3"
            onFocus={rememberOrigin}
            onClick={() => {
              close(notice.onAction);
            }}
          >
            {notice.actionLabel}
          </button>
          <button
            type="button"
            aria-label="بستن"
            className="size-11"
            onFocus={rememberOrigin}
            onClick={() => {
              close();
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
```

Why: `useOptimistic` shows the new state at once and falls back to the prop when the Action settles, so the prop must already be the new truth by then. That is why the action calls `updateTag`: `revalidateTag(tag, 'max')` sends no re-render, and the bookmark was measured jumping back 451 ms after the tap. The action receives the target state (`saved: true`), never "toggle", so a double tap or a retry is harmless. A failure needs no manual rollback, because the value is already back to the truth. It is explained in an overlay that moves nothing, with a retry, and it stays until acted on or dismissed, never on a timer. The `catch` matters: an action that throws (a lost connection, a server error) never reaches the component otherwise, because React reports it globally, so the person would see the bookmark flip back and nothing else. Pressing a button in the toast removes that button, so the toast returns focus to where it came from. Be optimistic only about what the person decides (saving, hiding, a threshold they typed), never about a market value, a deal rating, a count or a new record's id. In the app, one page-level toast region replaces the per-toggle `ToastMessage`.

## 4. Undo instead of a confirmation

```tsx
// src/features/saved-searches/components/saved-search-list.tsx
'use client';
import { startTransition, useLayoutEffect, useOptimistic, useRef, useState } from 'react';
import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import {
  removeSavedSearchAction,
  restoreSavedSearchAction,
} from '@/features/saved-searches/saved-searches-actions';
import type { SavedSearchView } from '@/features/saved-searches/saved-searches-types';

type ShownSearch = SavedSearchView & { removing?: true };

const OFFLINE = 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.';

export function SavedSearchList({ searches }: { searches: SavedSearchView[] }) {
  // the row stays, dimmed and labelled, until the server confirms; then it leaves and the undo appears
  const [shownSearches, markRemoving] = useOptimistic<ShownSearch[], string>(searches, (current, searchId) =>
    current.map((search) => (search.id === searchId ? { ...search, removing: true } : search)),
  );
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Next.js hides this route on navigation instead of unmounting it: an old undo must not greet the person on Back
  useLayoutEffect(
    () => () => {
      setNotice(null);
    },
    [],
  );

  function remove(search: SavedSearchView, pressed?: HTMLElement) {
    // the pressed button is about to disappear: hand focus to a neighbouring row's button, or to the list, first,
    // so it never falls back to <body> (craft.md, I-31)
    const row = pressed?.closest('li');
    const neighbour =
      row?.nextElementSibling?.querySelector('button') ??
      row?.previousElementSibling?.querySelector('button');
    if (pressed) (neighbour ?? listRef.current)?.focus();
    setNotice(null);
    startTransition(async () => {
      markRemoving(search.id);
      const retry = {
        actionLabel: 'تلاش دوباره',
        onAction: () => {
          remove(search);
        },
      };
      try {
        const result = await removeSavedSearchAction({ searchId: search.id });
        setNotice(
          result.status === 'done'
            ? {
                message: `جست‌وجوی «${search.name}» حذف شد`,
                actionLabel: 'بازگرداندن',
                onAction: () => {
                  restore(search);
                },
              }
            : { message: result.message, ...retry },
        );
      } catch {
        setNotice({ message: `حذف نشد. ${OFFLINE}`, ...retry });
      }
    });
  }

  function restore(search: SavedSearchView) {
    startTransition(async () => {
      const retry = {
        actionLabel: 'تلاش دوباره',
        onAction: () => {
          restore(search);
        },
      };
      try {
        const result = await restoreSavedSearchAction({ searchId: search.id });
        if (result.status === 'failed') setNotice({ message: result.message, ...retry });
      } catch {
        setNotice({ message: `بازگردانده نشد. ${OFFLINE}`, ...retry });
      }
    });
  }

  return (
    <>
      {/* focusable from script only: the place focus goes when the last row leaves */}
      <ul ref={listRef} tabIndex={-1} aria-label="جست‌وجوهای ذخیره‌شده" className="flex flex-col divide-y">
        {shownSearches.map((search) => (
          <li
            key={search.id}
            aria-busy={search.removing}
            className="flex min-h-14 items-center gap-4 transition-opacity aria-busy:opacity-50"
          >
            <span className="min-w-0 flex-1 truncate">{search.name}</span>
            {search.removing ? (
              <span className="text-sm">در حال حذف…</span>
            ) : (
              <button
                type="button"
                className="min-h-11 px-3"
                onClick={(event) => {
                  remove(search, event.currentTarget);
                }}
              >
                حذف
              </button>
            )}
          </li>
        ))}
      </ul>
      <ToastMessage
        notice={notice}
        onDismiss={() => {
          setNotice(null);
        }}
      />
    </>
  );
}
```

Why: a confirmation dialog gets clicked through by habit; undo removes the risk (Aza Raskin, NN/g). The row stays, dimmed and marked «در حال حذف…», until the server confirms, and only then leaves; «بازگرداندن» restores it. The pressed «حذف» is replaced at once, so focus first moves to a neighbouring row's button, or to the list, and never falls to `<body>` (`craft.md`, I-31). `removeSavedSearchAction` and `restoreSavedSearchAction` set a `removed` flag and call `updateTag`, so both are safe to repeat. The toast stays until the next action or a dismissal. Because a disappearing toast is still a time limit (WCAG 2.2.1), keep a lasting way back as well, such as a recently removed list. The `useLayoutEffect` cleanup clears the notice when Next.js hides the route in `<Activity>` on navigation, so Back does not show an old undo (Next.js 16.3 guide, "Preserving UI state").

## 5. A tooltip delay group

```tsx
// src/components/ui/icon-button.tsx
'use client';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';

// One delay group for the whole page (craft.md, tooltips): the first tooltip waits, then its neighbours open at once
// and without their fade while the pointer keeps exploring. Base UI's Tooltip.Provider does the same when it lands.
const FIRST_DELAY_MS = 600; // Base UI's default; libraries use 500 to 1500
const SKIP_WINDOW_MS = 400; // counted from when the previous tooltip closed; libraries use 300 to 400
const delayGroup = { lastClosedAt: Number.NEGATIVE_INFINITY };

type TooltipState = 'closed' | 'open' | 'instant';

/** An icon-only button. Its Farsi name is the aria-label; the tooltip repeats it for mouse users and is hidden from
 *  screen readers, which already hear the name. */
export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>('closed');
  const openTimer = useRef<number | undefined>(undefined);
  const isOpen = tooltip !== 'closed';

  function open(instant: boolean) {
    window.clearTimeout(openTimer.current);
    if (instant) setTooltip('instant');
    else
      openTimer.current = window.setTimeout(() => {
        setTooltip('open');
      }, FIRST_DELAY_MS);
  }

  function close() {
    window.clearTimeout(openTimer.current);
    if (isOpen) delayGroup.lastClosedAt = performance.now();
    setTooltip('closed');
  }

  // Escape dismisses it wherever focus and the pointer are (WCAG 1.4.13)
  const onEscape = useEffectEvent(close);
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // a mouse only: touch has no hover, and touch laptops defeat the hover media query
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') open(performance.now() - delayGroup.lastClosedAt < SKIP_WINDOW_MS);
      }}
      onPointerLeave={close}
      onPointerDown={close} // pressing performs the action; the hint gets out of the way
      // keyboard focus opens it at once; the focus a click causes does not
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) open(true);
      }}
      onBlur={close}
      className="relative inline-flex size-11 items-center justify-center"
    >
      {children}
      {/* centred with flex, not a translate, so nothing needs mirroring; padding rather than a margin joins it to the
          button, so the pointer can move onto the open hint without closing it (WCAG 1.4.13) */}
      <span
        aria-hidden="true"
        data-state={tooltip}
        className="group/tooltip pointer-events-none absolute inset-x-0 bottom-full flex justify-center pb-2 data-[state=instant]:pointer-events-auto data-[state=open]:pointer-events-auto"
      >
        <span className="duration-popover rounded-sm px-2 py-1 text-sm whitespace-nowrap opacity-0 transition-opacity group-data-[state=instant]/tooltip:opacity-100 group-data-[state=instant]/tooltip:transition-none group-data-[state=open]/tooltip:opacity-100">
          {label}
        </span>
      </span>
    </button>
  );
}
```

Why: the first hint waits, because the pointer may be passing by. Once the person is exploring a row of icon buttons, the neighbours open at once and without their fade, within a window counted from when the last hint closed (Emil Kowalski, Vercel, Radix, Base UI, React Aria, Ariakit). The hint opens for a mouse only, since touch has no hover and a tooltip must never be the only place for information. It opens at once on keyboard focus, closes on press, blur and Escape, and can be hovered (WCAG 1.4.13). It repeats the button's `aria-label` and is hidden from screen readers, which already hear the name. Because `onClick` is a function, `IconButton` is used from client components.

When Base UI lands (ADR-0005), its defaults are the same numbers: one `Tooltip.Provider` (`timeout` 400) around the toolbar, `Tooltip.Trigger` with its default `delay` of 600, and `data-instant:transition-none` on the popup; wrap the app in `DirectionProvider direction="rtl"` so its positioning and safe triangles mirror.

## 6. A photo that morphs from the results into the listing page

```tsx
// src/features/listings/components/listing-photo-transition.tsx
import { ViewTransition, type ReactNode } from 'react';

/** Names a listing's main photo so it morphs from the results card into the listing page and back (craft.md,
 *  morphs). One mounted element per name: wrap only the first photo, on the card and on the page. */
export function ListingPhotoTransition({ listingId, children }: { listingId: string; children: ReactNode }) {
  return (
    <ViewTransition name={`listing-photo-${listingId}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
```

```css
/* globals.css */
::view-transition {
  pointer-events: none; /* unnamed content stays tappable while a transition runs */
}
::view-transition-group(.morph) {
  animation-duration: var(--transition-duration-morph);
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation-duration: 0s; }
  ::view-transition-old(*) { animation: 150ms ease-out both vt-fade-out; }
  ::view-transition-new(*) { animation: 150ms ease-out both vt-fade-in; }
}
@keyframes vt-fade-out { to { opacity: 0; } }
@keyframes vt-fade-in { from { opacity: 0; } }
```

Why: the card's `<Link transitionTypes={['nav-forward']}>` (§1) and the listing page both wrap their main photo in `ListingPhotoTransition`, so the photo reads as one object moving, not two swapping (Next.js 16.3 guide, "Designing view transitions").

- `share="morph"` with `default="none"` keeps each named photo from cross-fading on every unrelated transition.
- One element per name: a duplicate cancels the morph.
- The pair forms only when the listing page's photo renders in the navigation's commit: the listing page reads its id and the listing at the top and keeps the photo outside any Suspense boundary (which also lets it answer a real 404), and the first screen's cards prefetch it fully (`aboveTheFold`, §1); a card without the prefetch waits for the server before the morph plays.
- Both frames share the 4:3 ratio, so nothing stretches.
- React ignores `prefers-reduced-motion` for view transitions, hence the CSS above.
- View transitions cannot be interrupted, so they are for navigations and rare reveals only, never for chips, sorting or the bookmark.
- Vitest runs React 19.3.0 (CS-27), so the wrapper renders in unit tests (checked: its children render); the morph itself is checked in e2e.

## 7. Motion preferences in script: reduced motion and the device tier

```ts
// src/components/ui/motion-preferences.ts
import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** For motion driven from script (the Web Animations API, a spring, scrollIntoView). Motion in CSS uses
 *  motion-safe: instead and needs no hook. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true, // the server cannot know: render the still version until the client says otherwise
  );
}

export type DeviceTier = 'full' | 'low';

function readDeviceTier(): DeviceTier {
  // deviceMemory exists only in Chromium (about 87 % of Iranian mobile browsing); Safari clamps the core count to 4
  // or 8. Read once, never sent anywhere (craft.md, weak devices).
  const memory: unknown = Reflect.get(navigator, 'deviceMemory');
  return (typeof memory === 'number' && memory < 4) || navigator.hardwareConcurrency <= 2 ? 'low' : 'full';
}

function subscribeToNothing() {
  return () => undefined; // the tier does not change while the page is open
}

/** The low tier drops blur, backdrop filters, morphs (fades instead), staggers and looping shimmer; never
 *  information or state feedback. It is a performance tier, not a motion preference. */
export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(subscribeToNothing, readDeviceTier, () => 'low');
}
```

Why: motion written in CSS needs no JavaScript: author it inside `motion-safe:`, and the still version wins whenever the preference is unknown. These hooks are for motion started from script. The server snapshot is the still, cheap version, so the first client render matches the server and an unknown device never gets the expensive effects first. A weak phone is a performance tier, not a motion preference: the low tier drops decoration, never information. Do not use the Battery Status API, Compute Pressure or frame-rate sampling (`craft.md`, weak devices).
