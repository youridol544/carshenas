# State and effects

Each pattern: the smell, the code an agent usually writes, the code that belongs here, and why.

## 1. Derive, don't sync

Smell: a `useState` whose setter is only called from a `useEffect` (TkDodo: remove that state).

```tsx
// before
const [greatDeals, setGreatDeals] = useState(0);
const [hasCheaperCopy, setHasCheaperCopy] = useState(false);
useEffect(() => {
  setGreatDeals(listings.filter((listing) => listing.dealRating === 'great').length);
  setHasCheaperCopy(duplicates.some((duplicate) => duplicate.askingPrice < listing.askingPrice));
}, [listings, duplicates, listing.askingPrice]);
```

```tsx
// after
const greatDeals = listings.filter((listing) => listing.dealRating === 'great').length;
const hasCheaperCopy = duplicates.some((duplicate) => duplicate.askingPrice < listing.askingPrice);
```

Why: the effect version renders once with stale numbers, then again; "If you can calculate something during render, you don't need an Effect" (react.dev). The React Compiler memoises the calculation, so no `useMemo` either. The same goes for filtered lists, counts, labels and "is valid" flags.

## 2. Reset with a key, not an effect

Smell: an effect that copies a prop into state when the prop changes.

```tsx
// before
function SavedSearchForm({ search }: { search: SavedSearch }) {
  const [name, setName] = useState(search.name);
  useEffect(() => {
    setName(search.name);
  }, [search.name]);
  // …
}
```

```tsx
// after: the parent decides when the form starts over
<SavedSearchForm key={search.id} initialName={search.name} action={renameSavedSearchAction} />

export function SavedSearchForm({ initialName, action }: SavedSearchFormProps) {
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="search-name">نام جست‌وجو</label>
      <input id="search-name" name="name" defaultValue={initialName} />
      <button type="submit">ذخیره</button>
    </form>
  );
}
```

Why: "You can force a subtree to reset its state by giving it a different key" (react.dev). Copying a prop into state ignores every later update to it (Abramov, "Writing Resilient Components"); an intentional starting value is named `initialX`. A form submitted through an Action needs no state at all: named inputs with `defaultValue`.

## 3. What the user did belongs in the handler

Smell: state that exists only so an effect can react to a click.

```tsx
// before
const [saved, setSaved] = useState(false);
useEffect(() => {
  if (saved) {
    announce(SAVED_MESSAGE);
    onSaved(listing.id);
  }
}, [saved, onSaved, listing.id]);
// <button onClick={() => setSaved(true)}>…
```

```tsx
// after
function handleSave() {
  announce(SAVED_MESSAGE);
  onSaved(listing.id);
}
// <button type="button" onClick={handleSave}>{SAVE_LABEL}</button>
```

Why: react.dev, "Sharing logic between event handlers": code that runs because of an interaction goes in the handler. The effect version fires again on remount and in development twice, and it is one render late.

## 4. `useEffectEvent` instead of silencing `exhaustive-deps`

Smell: `// eslint-disable-next-line react-hooks/exhaustive-deps`, or a `latestRef.current = value` assignment, to read a value without re-subscribing.

```tsx
// before
useEffect(() => {
  const subscription = subscribeToSavedSearch(searchId, (newListings) => {
    if (newListings >= notifyAfter) showNewListings(newListings, cityLabel);
  });
  return () => {
    subscription.close();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchId]);
```

```tsx
// after (React 19.2)
const onNewListings = useEffectEvent((newListings: number) => {
  if (newListings >= notifyAfter) showNewListings(newListings, cityLabel);
});

useEffect(() => {
  const subscription = subscribeToSavedSearch(searchId, (newListings) => {
    onNewListings(newListings);
  });
  return () => {
    subscription.close();
  };
}, [searchId]);
```

Why: the subscription depends only on `searchId`; the threshold and the label are read fresh when new listings arrive. Effect Events "can only be called from inside Effects or other Effect Events" (react.dev): never list them in dependencies, never pass them to children, call them from a wrapper inside the effect.

## 5. A union instead of boolean flags

Smell: `isLoading`, `isError`, `data` that can all be set at once.

```tsx
// before
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [valuation, setValuation] = useState<Valuation | null>(null);
```

```tsx
// after
type ValuationState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ready'; valuation: Valuation }
  | { status: 'failed'; message: string };

export function ValuationPanel({ state }: { state: ValuationState }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'pending':
      return <ValuationSkeleton />;
    case 'failed':
      return <p role="alert">{state.message}</p>;
    case 'ready':
      return <ValuationSummary valuation={state.valuation} />;
  }
}
```

Why: three booleans allow eight combinations, most impossible and untested (Dodds, "Stop using isLoading booleans"; TkDodo on the first boolean prop). The typed lint checks the `switch` is exhaustive. With Actions, `useActionState` already gives you `isPending`; model the rest of the result as a union.

## 6. A reducer named after events

Smell: several setters called together in every handler.

```tsx
// after: a filter sheet keeps a draft until the buyer presses «اعمال»
type FilterDraft = { makeIds: readonly MakeId[]; paintFreeOnly: boolean };
type FilterEvent =
  | { type: 'makeToggled'; makeId: MakeId }
  | { type: 'paintFreeOnlyToggled' }
  | { type: 'cleared' };

export function filterDraftReducer(draft: FilterDraft, event: FilterEvent): FilterDraft {
  switch (event.type) {
    case 'makeToggled':
      return draft.makeIds.includes(event.makeId)
        ? { ...draft, makeIds: draft.makeIds.filter((id) => id !== event.makeId) }
        : { ...draft, makeIds: [...draft.makeIds, event.makeId] };
    case 'paintFreeOnlyToggled':
      return { ...draft, paintFreeOnly: !draft.paintFreeOnly };
    case 'cleared':
      return { makeIds: [], paintFreeOnly: false };
  }
}
// const [draft, dispatch] = useReducer(filterDraftReducer, initialDraft);
```

Why: "state that updates together should live together", and actions describe what happened, not which setter to call (TkDodo). A pure reducer is also the easiest thing in the app to unit test. Independent values stay separate `useState` calls (Dodds). Applied filters live in the URL, not in state.

## 7. An external store without a hydration mismatch

Smell: `useState(navigator.onLine)` plus an effect adding listeners (crashes on the server, mismatches on hydration).

```tsx
// after
function subscribeToConnection(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useIsOnline() {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true, // the server assumes online; the client corrects it after hydration
  );
}
```

Why: `useSyncExternalStore` is React's API for values that live outside React, and its third argument gives the server and the first client render the same snapshot (react.dev; TkDodo, "Avoiding Hydration Mismatches with useSyncExternalStore"). Use it for connectivity, media queries that CSS cannot express, and storage.
