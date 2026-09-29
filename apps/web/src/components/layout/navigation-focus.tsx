'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// After a client-side navigation the element that had focus may be gone: moving between route groups remounts the
// header (the sign-in link a visitor just pressed, the brand link), and Next.js 16.3 no longer moves focus itself.
// Focus would then fall back to the page, and a keyboard or screen-reader user would start again at the top (WCAG
// 2.4.3). Only in that case it moves to the new page's main content; focus that survived is left where it is.

/** Whether focus is still on something a person can see (a hidden element has no offset parent). */
function focusSurvived(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body && active.offsetParent !== null;
}

function visibleMain(): HTMLElement | undefined {
  // Next.js keeps the page just left in the document, hidden, so the first <main> may be the old one.
  return [...document.querySelectorAll('main')].find((main) => main.offsetParent !== null);
}

export function NavigationFocus() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (focusSurvived()) return;
    const main = visibleMain();
    if (main === undefined) return;
    // A landing place for focus, not a control: reachable by script, skipped by Tab.
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
