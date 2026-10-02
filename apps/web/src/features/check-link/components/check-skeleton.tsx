import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
import { CHECK_COPY } from '@/features/check-link/check-copy';

// The answer's first load, drawn from the answer's own frame (the summary card, the analysis box), so nothing moves when
// it arrives; one spoken status line says what is loading.

export function CheckAnswerSkeleton() {
  return (
    <div role="status" className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <span className="sr-only">{CHECK_COPY.page.loading}</span>
      <div className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-4">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 lg:grid-cols-1">
          <div className="aspect-4/3 overflow-hidden rounded-inner">
            <SkeletonBlock />
          </div>
          <div className="flex flex-col gap-1 text-heading">
            <SkeletonText lines={2} />
          </div>
        </div>
        <div className="text-title">
          <SkeletonText />
        </div>
        <div className="h-12 overflow-hidden rounded-control">
          <SkeletonBlock />
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-4">
        <div className="text-heading">
          <SkeletonText />
        </div>
        <div className="h-24 overflow-hidden rounded-control">
          <SkeletonBlock />
        </div>
        <div className="text-body">
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  );
}
