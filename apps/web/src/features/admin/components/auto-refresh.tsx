'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Keeps the worker screen current (CS-41 criterion 1): the page asks the server again every 15 seconds while it is
// visible, so a worker that stops shows as down within a minute (45 s of silence plus one refresh). router.refresh()
// keeps the page's state and scroll position and swaps the numbers in place; a hidden tab asks nothing and catches up
// as soon as it is shown again.

export const REFRESH_INTERVAL_MS = 15_000;

export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
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
