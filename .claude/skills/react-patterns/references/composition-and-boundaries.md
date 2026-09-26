# Composition and the server/client boundary

## 1. `'use client'` goes on the leaf

Smell: a page or feature component marked `'use client'` because one button inside it needs a handler.

```tsx
// before: src/features/listings/components/listing-details.tsx
'use client';
export function ListingDetails({ listing }: { listing: Listing }) {
  const [saved, setSaved] = useState(false);
  return (
    <article>
      <h1>{listing.title}</h1>
      <ListingGallery images={listing.images} />
      <ListingDescription text={listing.description} />
      {/* save button + price alert */}
    </article>
  );
}
```

```tsx
// after: the article stays a Server Component; only the interactive part is client code
export function ListingDetails({ listing }: { listing: ListingView }) {
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{listing.title}</h1>
      <ListingGallery images={listing.images} />
      <SaveListingForm listingId={listing.id} initiallySaved={listing.saved} />
    </article>
  );
}
```

Why: once a file says `'use client'`, it and everything it imports ship to the browser, and it can no longer read data on the server (Next docs; Abramov: `'use client'` is a typed `<script>`). The client leaf receives plain serialisable props (ids, numbers, strings) and Server Functions, nothing else.

## 2. Server-rendered UI through a client wrapper: `children`

Smell: a client component imports a server component, or the whole subtree becomes client code because its wrapper holds state.

```tsx
// after: the sheet owns open/closed; the list of makes is rendered on the server and passed in
'use client';
export function FilterSheet({ title, children }: { title: string; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="min-h-11 px-4" onClick={() => dialogRef.current?.showModal()}>
        {title}
      </button>
      <dialog ref={dialogRef} aria-label={title} className="w-full max-w-md p-4">
        {children}
        <button type="button" className="min-h-11 px-4" onClick={() => dialogRef.current?.close()}>
          بستن
        </button>
      </dialog>
    </>
  );
}

// in a Server Component
<FilterSheet title="فیلترها">
  <MakeFilterOptions makes={makes} />
</FilterSheet>
```

Why: `children` is already-rendered output, so it crosses the boundary without becoming client code, and it is not re-rendered when the wrapper's state changes (Abramov, "Before You memo()"). The same move fixes slow typing: put the fast-changing state in a small component and pass the expensive part in as `children`. Native `<dialog>` gives focus trapping, Escape and the backdrop for free.

## 3. Context in React 19: provider component plus a hook that fails loudly

```tsx
'use client';
import { createContext, use, useState } from 'react';

type CompareDrawer = { isOpen: boolean; open: () => void; close: () => void };

const CompareDrawerContext = createContext<CompareDrawer | null>(null);

export function CompareDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const drawer: CompareDrawer = {
    isOpen,
    open: () => {
      setIsOpen(true);
    },
    close: () => {
      setIsOpen(false);
    },
  };
  return <CompareDrawerContext value={drawer}>{children}</CompareDrawerContext>;
}

export function useCompareDrawer() {
  const drawer = use(CompareDrawerContext);
  if (drawer === null) throw new Error('useCompareDrawer must be used inside <CompareDrawerProvider>');
  return drawer;
}
```

Why: React 19 renders `<Context value>` directly and reads it with `use` ("`SomeContext.Provider` is a legacy way", react.dev); lint rejects the old forms. The raw context is not exported, and the hook throws outside its provider, so a missing provider fails at the first render instead of later with `undefined` (Dodds, "How to use React Context effectively", paraphrased). The React Compiler memoises `drawer`, so it needs no `useMemo`. Context is transport, not state management (Erikson): one context per concern, the provider as deep as it can go, and prefer passing props or `children` when only one or two levels need the value.

## 4. Props for data, compound components only for layout freedom

```tsx
// after: the trims come from data, so they are a prop
<TrimPicker label="تیپ" options={model.trims} selectedId={selectedTrimId} />
```

Why: a list that comes from data is a prop; compound components (`<Tabs><Tabs.Tab/></Tabs>`) earn their place only when callers need to arrange the parts themselves (TkDodo, 2026-01-02). Static members such as `Menu.Item` do not survive the server/client boundary.

## 5. A pattern component that cannot be used wrongly

Smell: icon-only buttons without an accessible name; a generic `Tooltip` bolted on later.

```tsx
type IconButtonProps = Omit<React.ComponentProps<'button'>, 'aria-label' | 'children' | 'type'> & {
  label: string;
  icon: React.ReactNode;
};

export function IconButton({ label, icon, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex size-11 items-center justify-center ${className ?? ''}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
```

Why: making `label` required turns an accessibility rule into a type error (TkDodo, design-system principles, 2025-11-17). `size-11` is the 44 px touch target; `ref` arrives through `ComponentProps<'button'>` in React 19, so no `forwardRef`.

## 6. Keep unrelated state apart; lift only as far as needed

```tsx
// before: the page owns every piece of UI state, so typing in the search box re-renders every result
// after: SearchBox owns its text; the results read the submitted query from the URL on the server
<SearchBox defaultQuery={query} />   {/* client: local text, submits a GET form */}
<ListingList listings={listings} /> {/* server: rendered from the query in searchParams */}
```

Why: global and far-lifted state is a leading cause of slow React apps (Dodds, "State Colocation"). Ask whether rendering the component twice should show the interaction in both copies (Abramov); if not, it is local state. Search and filters belong in the URL so Back works and results can be shared.
