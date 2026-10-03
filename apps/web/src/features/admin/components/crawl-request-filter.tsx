'use client';

import { Check } from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { CRAWL_REQUESTS_ADMIN_COPY as COPY } from '@/features/admin/crawl-requests-admin-copy';
import type { RequestFilter } from '@/features/admin/server/crawl-request-queries';

// The state filter of the crawl-request screen (CS-71): links, so the filter is in the address and a reload keeps it.
// The chosen one is marked for screen readers with aria-current and for the eye with a check (a fill alone is under the
// 3:1 a state needs); the page is read at request time and not prefetched, so a slow answer shows the spinner in the
// pressed link's reserved slot after the pending delay and nothing moves. Same pattern as the worker's window switcher.

const FILTERS = [
  'all',
  'pending',
  'approved',
  'declined',
  'fulfilled',
] as const satisfies readonly RequestFilter[];

function Indicator({ chosen }: { chosen: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      data-pending={pending ? '' : undefined}
      className="group absolute inset-e-2 top-1/2 inline-flex -translate-y-1/2"
    >
      {chosen && !pending ? <Icon icon={Check} size={16} /> : <Spinner />}
    </span>
  );
}

export function CrawlRequestFilter({
  current,
  counts,
}: {
  current: RequestFilter;
  counts: Record<RequestFilter, number>;
}) {
  return (
    <nav aria-label={COPY.filterLabel}>
      <ul className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <li key={filter}>
            <Link
              href={`/admin/crawl-requests?state=${filter}`}
              prefetch={false}
              scroll={false}
              data-filter={filter}
              aria-current={filter === current ? 'page' : undefined}
              className="relative inline-flex min-h-11 items-center justify-center rounded-control border border-control ps-4 pe-8 text-label font-medium text-default transition-colors hover:bg-surface-hover aria-[current=page]:bg-action-subtle aria-[current=page]:text-on-action-subtle"
            >
              {COPY.filterCount(COPY.filter[filter], counts[filter])}
              <Indicator chosen={filter === current} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
