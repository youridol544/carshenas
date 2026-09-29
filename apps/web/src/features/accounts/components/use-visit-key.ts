'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// Next.js keeps a page the person left in the document, hidden, with its state (React's Activity; Next.js's guide
// "Preserving UI state"), so a form's last answer, its errors and a typed password would still be there when they
// come back, by a link or by the back button. A form keyed by this number starts afresh instead: once it has been
// used, the key moves on as the page is hidden (a layout effect's clean-up runs then, before the page disappears). A
// form nobody touched keeps its key, so the development build's double mount never resets it.

export function useVisitKey(): { key: number; markUsed: () => void } {
  const [key, setKey] = useState(0);
  const used = useRef(false);
  useLayoutEffect(
    () => () => {
      if (!used.current) return;
      used.current = false;
      setKey((current) => current + 1);
    },
    [],
  );
  const markUsed = useCallback(() => {
    used.current = true;
  }, []);
  return { key, markUsed };
}
