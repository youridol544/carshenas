'use client';

import { StatusScreen } from '@/components/layout/status-screen';
import { ActionLink, actionClasses } from '@/components/ui/action-link';

// A route that threw. retry() re-fetches and re-renders the segment (stable since Next.js 16.3); the link home is
// the way out when retrying does not help.
export default function RouteError({ retry }: { retry: () => void }) {
  return (
    <StatusScreen
      status={500}
      title="مشکلی پیش آمد"
      description="این صفحه باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، از صفحه‌ی اصلی ادامه دهید."
      errorScreen
    >
      <button type="button" onClick={retry} className={actionClasses('primary')}>
        دوباره امتحان کنید
      </button>
      <ActionLink level="secondary" href="/">
        صفحه‌ی اصلی
      </ActionLink>
    </StatusScreen>
  );
}
