'use client';

import { useEffect } from 'react';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';

/**
 * «خطا: ورود | کارشناس» while a form shows errors (GOV.UK): the first thing a screen reader says about the page.
 * The title is the browser's, an outside system; it is given back only if nothing else changed it meanwhile (a
 * navigation writes the next page's own title).
 */
export function useErrorTitle(hasErrors: boolean): void {
  useEffect(() => {
    if (!hasErrors) return;
    const original = document.title;
    const withPrefix = `${ACCOUNT_COPY.errors.titlePrefix}${original}`;
    document.title = withPrefix;
    return () => {
      if (document.title === withPrefix) document.title = original;
    };
  }, [hasErrors]);
}
