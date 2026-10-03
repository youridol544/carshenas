import { FileSearch } from 'lucide-react';
import { ActionLink } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { ListingCardSkeleton } from '@/features/search/components/listing-card';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';

// The list's first-use and loading states (ui-design craft.md, sections 3 and 6). The empty list says what files are
// and offers the one way forward; the skeleton is the card's own frame in grey, fades in only after the pending delay
// and says in one hidden sentence what is loading.

export function FilesEmpty() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border border-divider bg-surface p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-default">
        <Icon icon={FileSearch} size={24} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-heading font-bold">{SEARCH_FILES_COPY.list.emptyTitle}</h2>
        <p className="max-w-reading text-body text-pretty text-muted">{SEARCH_FILES_COPY.list.emptyBody}</p>
      </div>
      <ActionLink level="primary" href="/search">
        {SEARCH_FILES_COPY.list.emptyAction}
      </ActionLink>
    </div>
  );
}

const CARD_KEYS = ['listing-1', 'listing-2', 'listing-3'] as const;
const SKELETON_CARDS = ['card-1', 'card-2', 'card-3', 'card-4'] as const;

/** One card's frame in grey: a title line, a row of chips, a count line and a time line. */
export function FileCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4">
      <div className="flex items-start justify-between gap-3 text-control">
        <span className="skeleton-bar h-lh w-1/2" />
        <span className="skeleton-block h-7 w-16 rounded-badge" />
      </div>
      <div className="flex gap-2">
        <span className="skeleton-block h-8 w-20 rounded-full" />
        <span className="skeleton-block h-8 w-28 rounded-full" />
      </div>
      <div className="flex min-h-lh items-center text-secondary">
        <span className="skeleton-bar w-1/3" />
      </div>
      <div className="flex min-h-lh items-center text-meta">
        <span className="skeleton-bar w-1/4" />
      </div>
    </div>
  );
}

export function FilesSkeleton() {
  return (
    <div className="flex flex-col gap-3 opacity-100 transition-opacity delay-pending duration-popover starting:opacity-0">
      <p role="status" className="sr-only">
        {SEARCH_FILES_COPY.list.loading}
      </p>
      <div aria-hidden className="grid gap-3 md:grid-cols-2">
        {SKELETON_CARDS.map((key) => (
          <FileCardSkeleton key={key} />
        ))}
      </div>
    </div>
  );
}

/** The file page's own frame in grey, in its two columns: the file's name, controls and search beside the matches. */
export function FileScreenSkeleton() {
  return (
    <div className="flex flex-col gap-6 opacity-100 transition-opacity delay-pending duration-popover lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-8 starting:opacity-0">
      <p role="status" className="sr-only">
        {SEARCH_FILES_COPY.file.loadingResults}
      </p>
      <aside aria-hidden className="flex flex-col gap-4">
        <div className="flex flex-col items-start gap-2">
          <span className="skeleton-block block h-11 w-40 rounded-control" />
          <div className="flex min-h-2lh w-2/3 items-center text-title">
            <span className="skeleton-bar w-full" />
          </div>
          <div className="flex gap-3">
            <span className="skeleton-block block h-7 w-20 rounded-badge" />
            <span className="skeleton-block block h-12 w-36 rounded-control" />
            <span className="skeleton-block block size-12 rounded-control" />
          </div>
        </div>
        <div className="flex gap-2 overflow-hidden">
          <span className="skeleton-block h-8 w-20 shrink-0 rounded-full" />
          <span className="skeleton-block h-8 w-28 shrink-0 rounded-full" />
          <span className="skeleton-block h-8 w-24 shrink-0 rounded-full" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-4">
        <div aria-hidden className="flex min-h-2lh w-1/2 items-center text-heading">
          <span className="skeleton-bar w-full" />
        </div>
        <ol aria-hidden className="grid gap-3 2xl:grid-cols-2">
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
