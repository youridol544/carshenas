import type { Route } from 'next';
import Link from 'next/link';
import { formatTimeAgo } from '@carshenas/locale/format-date';
import { ChipRow } from '@/features/search-files/components/chip-row';
import { FileControls } from '@/features/search-files/components/file-controls';
import { RequestStateBadge } from '@/components/ui/request-state-badge';
import { CRAWL_REQUESTS_COPY } from '@/lib/crawl-requests-copy';
import { DealBadge } from '@/features/search/components/deal-badge';
import { ListingPhoto } from '@/features/search/components/listing-photo';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';
import { SEARCH_FILES_PATH } from '@/lib/return-path';
import type { SearchFileSummary } from '@/features/search-files/search-files-types';

// One search file in the list (CS-70): the newest match's photo (from the source's own address, ADR-0025), the name, what
// is new as the main signal («۳۰ آگهی تازه»), how many cars match, the best deal among them, the search as chips and
// when the buyer last looked, then the file's controls (pause, resume, close, delete) so a file is handled without
// opening it. The state is not repeated on the card: the list is grouped by it. The whole card is one link, the name's,
// stretched over it; the controls sit above that link. A file whose search no longer fits this build says so.

const COPY = SEARCH_FILES_COPY.list;
const DEAL_TONES = ['great', 'good', 'fair', 'high', 'overpriced'] as const;
type DealTone = (typeof DEAL_TONES)[number];

function isDealTone(value: string | null): value is DealTone {
  return value !== null && (DEAL_TONES as readonly string[]).includes(value);
}

export function FileCard({ file, now }: { file: SearchFileSummary; now: string }) {
  const counts = file.counts;
  const showNew = counts !== null && counts.newCount > 0 && file.state !== 'closed';
  const best = file.highlight?.best ?? null;
  return (
    <article
      data-search-file={file.id}
      className="relative flex flex-col gap-3 rounded-card border border-divider bg-surface p-3 transition-colors hover:bg-surface-muted has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus"
    >
      <div className="flex gap-3">
        {file.readable ? (
          <div className="relative aspect-4/3 w-28 shrink-0 self-start overflow-hidden rounded-inner bg-surface-muted outline-1 -outline-offset-1 outline-photo sm:w-32">
            <ListingPhoto src={file.highlight?.photoUrl ?? null} eager={false} sizes="8rem" />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="text-control font-semibold text-balance">
            <Link
              href={`${SEARCH_FILES_PATH}/${String(file.id)}` as Route}
              aria-label={COPY.open(file.name)}
              className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
            >
              <bdi>{file.name}</bdi>
            </Link>
          </h3>
          {!file.readable ? (
            <p className="text-secondary text-pretty text-warning">{COPY.unreadable}</p>
          ) : counts === null ? (
            <p className="text-secondary text-muted">{COPY.countFailed}</p>
          ) : (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {showNew ? (
                <span
                  data-new-count={counts.newCount}
                  className="rounded-badge bg-action px-2 py-0.5 text-label font-semibold text-on-action"
                >
                  {COPY.newCount(counts.newCount)}
                </span>
              ) : (
                <span className="text-secondary text-muted">{COPY.nothingNew}</span>
              )}
              <span className="text-secondary font-medium">
                {counts.matches.count === 0
                  ? COPY.noMatches
                  : COPY.matches(counts.matches.count, counts.matches.exact)}
              </span>
            </p>
          )}
          {best === null ? null : (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-secondary">
              <span className="text-muted">{COPY.bestDeal}:</span>
              <span className="font-medium">
                <bdi>{best.price}</bdi>
              </span>
              {isDealTone(best.rating) && best.label !== null ? (
                <DealBadge rating={best.rating} label={best.label} />
              ) : null}
            </p>
          )}
          {file.crawl == null ? null : (
            <p
              data-file-crawl={file.crawl.states[0]}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-secondary"
            >
              <span className="text-muted">{CRAWL_REQUESTS_COPY.list.label}:</span>
              {file.crawl.states.map((state) => (
                <RequestStateBadge key={state} status={state} />
              ))}
              {file.crawl.count > 1 ? (
                <span className="text-muted">{CRAWL_REQUESTS_COPY.list.count(file.crawl.count)}</span>
              ) : null}
            </p>
          )}
        </div>
      </div>
      {file.readable ? (
        <ChipRow chips={file.chips} limit={3} label={SEARCH_FILES_COPY.file.searchLabel} />
      ) : null}
      <p className="text-meta text-muted">
        <time dateTime={file.viewedAt}>{COPY.viewed(formatTimeAgo(file.viewedAt, now))}</time>
      </p>
      <div className="relative z-10 border-t border-divider pt-3">
        <FileControls id={file.id} name={file.name} state={file.state} showBadge={false} />
      </div>
    </article>
  );
}
