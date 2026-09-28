'use client';

import { appFont } from '@/components/layout/app-font';
import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { StatusScreen } from '@/components/layout/status-screen';
import { ActionLink, actionClasses } from '@/components/ui/action-link';
import { DIRECTION, LANGUAGE } from '@/lib/locale';
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
        <title>مشکلی پیش آمد | کارشناس</title>
        <StatusScreen
          status={500}
          title="مشکلی پیش آمد"
          description="کارشناس باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، چند دقیقه بعد سر بزنید."
          details={<ErrorReference code={reference} />}
          errorScreen
        >
          <button type="button" onClick={retry} className={actionClasses('primary')}>
            دوباره امتحان کنید
          </button>
          <ActionLink level="secondary" href="/">
            صفحه‌ی اصلی
          </ActionLink>
        </StatusScreen>
      </body>
    </html>
  );
}
