'use client';

import { useEffect } from 'react';

// Records that the buyer looked at the file when they leave its page (CS-70): the tab hidden or closed, the page
// reloaded, or a move to another page of the app. A beacon, which the browser sends even while the page unloads; the
// server treats looks within a few minutes of each other as one visit, so a refresh or a quick return still shows
// what was new when the visit began (search_file.previous_viewed_at). A page shown for a tenth of a second is not a
// look: development's second mount. The page itself keeps showing what was new when it opened.
// Renders nothing.

const MIN_SHOWN_MS = 100;
const REPEAT_MS = 1_000;
const ENDPOINT = '/api/search-files/viewed';

export function MarkViewed({ id }: { id: number }) {
  useEffect(() => {
    const shownAt = Date.now();
    let sent = 0;
    function record() {
      // visibilitychange and pagehide both fire on a close: once each is enough, and not twice within a second.
      if (Date.now() - shownAt < MIN_SHOWN_MS || Date.now() - sent < REPEAT_MS) return;
      sent = Date.now();
      const body = new Blob([JSON.stringify({ id })], { type: 'text/plain' });
      if (!navigator.sendBeacon(ENDPOINT, body)) {
        void fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => undefined);
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') record();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', record);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', record);
      record();
    };
  }, [id]);
  return null;
}
