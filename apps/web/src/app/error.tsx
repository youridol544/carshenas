'use client';

import Link from 'next/link';
import { StatusScreen } from '@/components/layout/status-screen';

// A route that threw. retry() re-fetches and re-renders the segment (stable since Next.js 16.3); the link home is
// the way out when retrying does not help.
export default function RouteError({ retry }: { retry: () => void }) {
  return (
    <StatusScreen
      status={500}
      title="مشکلی پیش آمد"
      description="این صفحه باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، از صفحهٔ اصلی ادامه دهید."
      errorScreen
    >
      <button
        type="button"
        onClick={retry}
        className="inline-flex min-h-12 items-center justify-center rounded-control bg-action px-6 text-control font-semibold text-on-action transition-colors hover:bg-action-hover"
      >
        دوباره امتحان کنید
      </button>
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-control border border-control bg-surface px-6 text-control font-semibold text-default transition-colors hover:bg-surface-hover"
      >
        صفحهٔ اصلی
      </Link>
    </StatusScreen>
  );
}
