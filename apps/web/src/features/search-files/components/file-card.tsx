import type { Route } from 'next';
import Link from 'next/link';
import { formatTimeAgo } from '@carshenas/locale/format-date';
import { ChipRow } from '@/features/search-files/components/chip-row';
import { StateBadge } from '@/features/search-files/components/state-badge';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';
import { SEARCH_FILES_PATH } from '@/lib/return-path';
import type { SearchFileSummary } from '@/features/search-files/search-files-types';

// One search file in the list (CS-70): its name, its state, the search as chips, how many cars match it now and how
// many are new since the buyer last looked, and when that was. The whole card is one link, the name's, stretched over
// it; a card for a file whose search no longer fits this build says so and still opens, to be deleted.

const COPY = SEARCH_FILES_COPY.list;

export function FileCard({ file, now }: { file: SearchFileSummary; now: string }) {
  const counts = file.counts;
  return (
    <article
      data-search-file={file.id}
      className="relative flex flex-col gap-3 rounded-card border border-divider bg-surface p-4 transition-colors hover:bg-surface-muted active:bg-surface-hover has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-control font-semibold text-balance">
          <Link
            href={`${SEARCH_FILES_PATH}/${String(file.id)}` as Route}
            aria-label={COPY.open(file.name)}
            className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
          >
            <bdi>{file.name}</bdi>
          </Link>
        </h3>
        <StateBadge state={file.state} />
      </div>
      {file.readable ? (
        <ChipRow chips={file.chips} limit={4} label={SEARCH_FILES_COPY.file.searchLabel} />
      ) : (
        <p className="text-secondary text-pretty text-warning">{COPY.unreadable}</p>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-secondary">
        {!file.readable ? null : counts === null ? (
          <span className="text-muted">{COPY.countFailed}</span>
        ) : (
          <>
            <span className="font-medium">
              {counts.matches.count === 0
                ? COPY.noMatches
                : COPY.matches(counts.matches.count, counts.matches.exact)}
            </span>
            {counts.newCount > 0 && file.state !== 'closed' ? (
              <span className="rounded-badge bg-action-subtle px-2 py-0.5 text-label font-medium text-on-action-subtle">
                {COPY.newCount(counts.newCount)}
              </span>
            ) : null}
          </>
        )}
      </p>
      <p className="text-meta text-muted">
        <time dateTime={file.viewedAt}>
          {SEARCH_FILES_COPY.list.viewed(formatTimeAgo(file.viewedAt, now))}
        </time>
      </p>
    </article>
  );
}
