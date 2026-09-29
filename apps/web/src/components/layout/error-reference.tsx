'use client';

import { browserErrorReference, reportBrowserError } from '@carshenas/observability/browser';
import { useEffect } from 'react';
import { toPersianDigits } from '@carshenas/locale/digits';

export const ERROR_REFERENCE_LABEL = 'کد پیگیری';

type ScreenError = Error & { digest?: string };

/**
 * The reference code an error screen shows, so a visitor's report leads to one log line (ADR-0016). A server error
 * arrives with the digest Next.js gave it and is already in the server log. An error thrown in the browser never
 * reaches window once a boundary catches it, so it is reported here, carrying the code the screen shows.
 */
export function useErrorReference(error: ScreenError): string {
  const { digest } = error;
  useEffect(() => {
    if (digest === undefined) reportBrowserError(error, 'boundary');
  }, [error, digest]);
  return digest ?? browserErrorReference(error);
}

// Persian digits like every number on screen, isolated left to right like a phone number, and selected whole with
// one tap so it can be copied. No lang="en": the digits are Persian, and a screen reader would read them in English.
export function ErrorReference({ code }: { code: string }) {
  return (
    <p className="text-secondary text-muted">
      {ERROR_REFERENCE_LABEL}:{' '}
      <span dir="ltr" className="select-all">
        {toPersianDigits(code)}
      </span>
    </p>
  );
}
