'use client';

import { useSyncExternalStore } from 'react';

// Which layout the page is in, so that only the controls that are shown are mounted (a rail and a sheet, two sort
// selects, would otherwise each exist twice with every label and info control, hidden by CSS only). It matches
// Tailwind's `lg` (64rem), the width the page switches its layout at. On the server and during hydration the layout is
// not known: `null`, and the page renders both, hidden by CSS, so nothing is missing before a script runs.

const DESKTOP = '(min-width: 64rem)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** `true` on a desktop layout, `false` on a phone's, `null` until the browser can say. */
export function useIsDesktop(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => null,
  );
}
