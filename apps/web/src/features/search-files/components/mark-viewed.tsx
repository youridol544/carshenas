'use client';

import { useEffect } from 'react';
import { markSearchFileViewedAction } from '@/features/search-files/search-files-actions';

// Records, a couple of seconds after the file's page is on screen, that the buyer looked at it, so the next visit shows
// what came since. Not at once: a page opened by a prefetch, a bounce or a slip is not a look. The page itself keeps
// what was new when it opened (the action does not refresh it). Renders nothing.

const LOOK_DELAY_MS = 2_000;

export function MarkViewed({ id }: { id: number }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void markSearchFileViewedAction({ id }).catch(() => undefined);
    }, LOOK_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [id]);
  return null;
}
