'use client';

import { appFont } from '@/components/layout/app-font';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { StatusScreen } from '@/components/layout/status-screen';
import { ActionLink, actionClasses } from '@/components/ui/action-link';
import { DIRECTION, LANGUAGE } from '@carshenas/locale/locale';
import './globals.css';

// The root layout itself threw, so this replaces it: it repeats the document's language, direction, typeface and
// styles. Metadata exports are not supported here, so React's <title> names the page. The link home is the way out
// when retrying does not help; the reference code finds the error in the server log.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const reference = useErrorReference(error);
  return (
    <html lang={LANGUAGE} dir={DIRECTION} className={appFont.variable}>
      <body>
        <title>کارشناس باز نشد</title>
        <StatusScreen
          status={500}
          title="کارشناس باز نشد"
          details={<ErrorReference code={reference} />}
          errorScreen
        >
          <button type="button" onClick={retry} className={actionClasses('primary')}>
            تلاش دوباره
          </button>
          <ActionLink level="secondary" href="/">
            صفحه‌ی اصلی
          </ActionLink>
        </StatusScreen>
      </body>
    </html>
  );
}
