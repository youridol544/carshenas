'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Keeps the worker screen current (CS-41 criterion 1): the page asks the server again every 15 seconds while it is
// visible, so a worker that stops shows as down within a minute (40 s of silence plus one refresh of 15 s: 55 s at most). router.refresh()
// keeps the page's state and scroll position and swaps the numbers in place; a hidden tab asks nothing and catches up
// as soon as it is shown again. A part marked data-refresh-hold holds the refresh while the pointer or focus is in it.

export const REFRESH_INTERVAL_MS = 15_000;

export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      // Not while the person is working in a part of the page marked to hold still (the failures, with their buttons):
      // the next tick asks again once the pointer and focus have left it.
      const holding = document.querySelector('[data-refresh-hold]:hover, [data-refresh-hold]:focus-within');
      if (document.visibilityState === 'visible' && holding === null) router.refresh();
    };
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  return null;
}
