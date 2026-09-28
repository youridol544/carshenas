'use client';

import { ErrorReference, useErrorReference } from '@/components/layout/error-reference';
import { StatusScreen } from '@/components/layout/status-screen';
import { ActionLink, actionClasses } from '@/components/ui/action-link';

// A route that threw. retry() re-fetches and re-renders the segment (stable since Next.js 16.3); the link home is
// the way out when retrying does not help. On a fresh load React's <title> names the error instead of the failing
// page; after a client-side navigation Next.js's own title for that page comes first (checked in Chromium). The
// message stays in the server log; the screen shows only the reference code that finds it there.
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const reference = useErrorReference(error);
  return (
    <>
      <title>مشکلی پیش آمد | کارشناس</title>
      <StatusScreen
        status={500}
        title="مشکلی پیش آمد"
        description="این صفحه باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، از صفحه‌ی اصلی ادامه دهید."
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
    </>
  );
}
