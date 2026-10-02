import { ChevronLeft, FileSearch } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';
import { readSearchFileOverview } from '@/features/search-files/server/file-queries';
import { SEARCH_FILES_PATH } from '@/lib/return-path';

// The account page's way to the buyer's search files (CS-70 #4): how many there are, the first few with what is new in
// each, and a link to all of them. It is a section of the account page, composed by the route (one feature never
// imports another). When there are none it says what a file is and links to the search.

const COPY = SEARCH_FILES_COPY.account;

export async function SearchFilesCard({ accountId }: { accountId: number }) {
  const overview = await readSearchFileOverview(accountId);
  return (
    <section
      aria-labelledby="account-files"
      className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-4"
    >
      <Link
        href={SEARCH_FILES_PATH}
        className="flex min-h-12 items-center gap-3 rounded-control transition-colors hover:bg-surface-hover"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-default">
          <Icon icon={FileSearch} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <h2 id="account-files" className="text-control font-semibold text-default">
            {COPY.heading}
          </h2>
          <span className="text-secondary text-muted">
            {overview.total === 0
              ? COPY.none
              : overview.newTotal > 0
                ? `${COPY.count(overview.total)} · ${COPY.newIn(overview.newTotal)}`
                : COPY.count(overview.total)}
          </span>
        </span>
        <Icon icon={ChevronLeft} className="text-muted" />
      </Link>
      {overview.top.length === 0 ? null : (
        <ul className="flex flex-col divide-y divide-divider border-t border-divider">
          {overview.top.map((file) => (
            <li key={file.id}>
              <Link
                href={`${SEARCH_FILES_PATH}/${String(file.id)}` as Route}
                className="flex min-h-12 items-center justify-between gap-3 py-2 transition-colors hover:bg-surface-hover"
              >
                <span className="min-w-0 text-control">
                  <bdi className="line-clamp-1">{file.name}</bdi>
                </span>
                {file.counts !== null && file.counts.newCount > 0 ? (
                  <span className="shrink-0 rounded-badge bg-action-subtle px-2 py-0.5 text-label font-medium text-on-action-subtle">
                    {COPY.newIn(file.counts.newCount)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The card's frame in grey, while the files are counted. */
export function SearchFilesCardSkeleton() {
  return (
    <div className="flex min-h-24 items-center gap-3 rounded-card border border-divider bg-surface p-4">
      <span className="skeleton-block block size-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col text-control">
        <span className="skeleton-bar w-1/3" />
        <span className="skeleton-bar w-1/2" />
      </div>
    </div>
  );
}
