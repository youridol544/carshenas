'use client';

import Link, { useLinkStatus } from 'next/link';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import type { PipelineWindow } from '@/features/admin/admin-types';
import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';

// The window the crawl and listing sections count over (CS-41; the owner's decision: one hour, 24 hours or seven
// days). Links, so the window is in the address and a reload keeps it; the chosen one is marked for screen readers
// with aria-current, and for the eye with a check beside the label (the chosen fill alone is 1.19:1 against white,
// under the 3:1 a state needs). The page is read at request time and not prefetched, so a slow answer shows the spinner in the
// pressed link's reserved slot after the pending delay, and nothing moves.

const WINDOWS = ['1h', '24h', '7d'] as const satisfies readonly PipelineWindow[];

/** Beside the label, out of its flow, so the label stays centred: the pending spinner, or the chosen window's check. */
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

export function WindowSwitcher({ current }: { current: PipelineWindow }) {
  return (
    <nav aria-labelledby="window-label" className="flex flex-wrap items-center gap-3">
      <span id="window-label" className="text-label font-medium text-muted">
        {WORKER_COPY.window}
      </span>
      <ul className="flex flex-wrap gap-2">
        {WINDOWS.map((window) => (
          <li key={window}>
            <Link
              href={`/admin/worker?window=${window}`}
              prefetch={false}
              scroll={false}
              aria-current={window === current ? 'page' : undefined}
              className="relative inline-flex min-h-11 min-w-24 items-center justify-center rounded-control border border-control px-8 text-label font-medium text-default transition-colors hover:bg-surface-hover aria-[current=page]:bg-action-subtle aria-[current=page]:text-on-action-subtle"
            >
              {WORKER_COPY.windows[window]}
              <Indicator chosen={window === current} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
