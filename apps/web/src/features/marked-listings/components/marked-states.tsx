import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
import { MARKED_COPY } from '@/features/marked-listings/marked-copy';

// The marked page's loading state (ui-design craft.md, sections 3 and 6): rows of the real row's own frame, so they are as
// tall as real ones, faded in only after the pending delay so a quick answer never flashes them, with one hidden sentence
// saying what is loading.

const ROWS = ['row-1', 'row-2', 'row-3'] as const;

export function MarkedSkeleton() {
  return (
    <div className="flex flex-col gap-4 opacity-100 transition-opacity delay-pending duration-popover starting:opacity-0">
      <p role="status" className="sr-only">
        {MARKED_COPY.loading}
      </p>
      <div aria-hidden className="flex min-h-11 gap-2">
        <div className="h-11 w-16 rounded-full bg-skeleton" />
        <div className="h-11 w-24 rounded-full bg-skeleton" />
        <div className="h-11 w-32 rounded-full bg-skeleton" />
      </div>
      <ol aria-hidden className="flex flex-col gap-3">
        {ROWS.map((key) => (
          <li key={key} className="rounded-card border border-divider bg-surface">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 p-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <div className="col-start-1 row-start-1 aspect-4/3 w-full self-start">
                <SkeletonBlock />
              </div>
              <div className="col-start-2 row-start-1 flex min-w-0 flex-col gap-1 p-1 sm:px-2">
                <div className="min-h-2lh text-control">
                  <SkeletonText lines={2} lastLineWidth="w-2/3" />
                </div>
                <div className="text-secondary">
                  <SkeletonText lastLineWidth="w-1/2" />
                </div>
              </div>
              <div className="col-span-2 row-start-2 flex flex-col gap-1 px-1 pt-3 sm:col-span-1 sm:col-start-2 sm:px-2">
                <div className="text-heading">
                  <SkeletonText lastLineWidth="w-1/2" />
                </div>
                <div className="text-secondary">
                  <SkeletonText lastLineWidth="w-1/3" />
                </div>
              </div>
              <div className="col-span-2 row-start-3 min-h-11 px-1 pt-3 sm:col-span-1 sm:col-start-2 sm:px-2" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
