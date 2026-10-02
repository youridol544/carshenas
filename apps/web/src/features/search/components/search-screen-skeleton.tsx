import { SkeletonBlock, SkeletonPill, SkeletonText } from '@/components/ui/skeleton';
import { ListingCardSkeleton } from '@/features/search/components/listing-card';
import { SEARCH_COPY } from '@/features/search/search-copy';

// The search page while its first answer is on the way (ui-design craft.md, section 3): the same columns and rows as the
// real screen, in grey, with as many cards as fill a phone, so nothing moves when the content arrives. It keeps its
// space from the first frame and fades in only after the pending delay, so a quick answer never flashes it.

const CARD_KEYS = ['card-1', 'card-2', 'card-3', 'card-4'] as const;
const CHIP_KEYS = ['chip-1', 'chip-2', 'chip-3', 'chip-4'] as const;
const RAIL_KEYS = ['rail-1', 'rail-2', 'rail-3', 'rail-4', 'rail-5'] as const;

export function SearchScreenSkeleton() {
  return (
    <div className="skeleton-delayed lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <p role="status" className="sr-only">
        {SEARCH_COPY.results.loading}
      </p>
      <div aria-hidden="true" className="hidden flex-col gap-4 lg:flex">
        <div className="h-7 w-24 text-heading">
          <SkeletonText lastLineWidth="w-full" />
        </div>
        {RAIL_KEYS.map((key) => (
          <div key={key} className="h-24 rounded-card">
            <SkeletonBlock />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div aria-hidden="true" className="flex gap-2">
          <div className="h-12 flex-1 overflow-hidden rounded-control">
            <SkeletonBlock />
          </div>
          <div className="h-12 w-24 overflow-hidden rounded-control">
            <SkeletonBlock />
          </div>
        </div>
        <div aria-hidden="true" className="-mx-4 flex gap-2 overflow-hidden px-4">
          {CHIP_KEYS.map((key) => (
            <SkeletonPill key={key} className="h-11 w-44 shrink-0" />
          ))}
        </div>
        <div aria-hidden="true" className="-mx-4 flex gap-2 border-b border-divider px-4 py-2 lg:hidden">
          <div className="h-12 flex-1 overflow-hidden rounded-control">
            <SkeletonBlock />
          </div>
          <div className="h-12 flex-1 overflow-hidden rounded-control">
            <SkeletonBlock />
          </div>
        </div>
        <div aria-hidden="true" className="h-lh w-32 text-control">
          <SkeletonText lastLineWidth="w-full" />
        </div>
        <ol aria-hidden="true" className="flex flex-col gap-3">
          {CARD_KEYS.map((key) => (
            <li key={key}>
              <ListingCardSkeleton />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
