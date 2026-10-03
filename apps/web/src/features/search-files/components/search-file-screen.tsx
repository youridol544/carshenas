import { ChevronRight, ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { connection } from 'next/server';
import { formatTimeAgo, formatDate, formatDateTime } from '@carshenas/locale/format-date';
import { searchHref } from '@carshenas/search/search';
import { Icon } from '@/components/ui/icon';
import { ChipRow } from '@/features/search-files/components/chip-row';
import { FileAlerts } from '@/features/search-files/components/file-alerts';
import { FileControls } from '@/features/search-files/components/file-controls';
import { MarkViewed } from '@/features/search-files/components/mark-viewed';
import { FileResultsFailed, FileUnreadable } from '@/features/search-files/components/file-states';
import { RequestCard, shouldShowRequestCard } from '@/features/search-files/components/request-card';
import { ListingCard } from '@/features/search/components/listing-card';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';
import { readFileId } from '@/features/search-files/search-files-schemas';
import { readSearchFilePage } from '@/features/search-files/server/file-queries';
import { SEARCH_FILES_PATH } from '@/lib/return-path';
import { requireAccount } from '@/server/auth/current-account';

// One search file (CS-70 #3): its name, its state and what the buyer can do with it, the search as chips, then the
// matches now, ranked by deal, with what is new since the buyer last looked marked on the photo and counted. The
// session decides whose file it is: an id that is not the account's is not found, never forbidden. The look is
// recorded a moment after the page is on screen (MarkViewed), and the page keeps showing what was new when it opened.

const COPY = SEARCH_FILES_COPY.file;

export function FileBackLink() {
  return (
    <Link
      href={SEARCH_FILES_PATH}
      className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-secondary text-muted transition-colors hover:bg-surface-hover"
    >
      <Icon icon={ChevronRight} size={16} />
      {COPY.back}
    </Link>
  );
}

export async function SearchFileScreen({ params }: { params: Promise<{ id: string }> }) {
  const id = readFileId((await params).id);
  if (id === undefined) notFound();
  const account = await requireAccount(`${SEARCH_FILES_PATH}/${String(id)}`);
  await connection();
  const data = await readSearchFilePage(account.id, id);
  if (data === null) notFound();
  const { file, search, cards, newIds } = data;
  const now = new Date().toISOString();
  // One unbreakable run: a time never wraps away from its date («ساعت ۲:۴۶» alone on a line).
  const since = formatDateTime(file.viewedAt).replaceAll(' ', '\u00a0');
  const newCount = file.counts?.newCount ?? 0;
  const matches = file.counts?.matches;
  const fresh = new Set(newIds);
  const openHref = search === null ? null : searchHref(search);
  const total = matches === undefined ? undefined : COPY.matchesCount(matches.count, matches.exact);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
        <div className="flex flex-col items-start gap-2">
          <FileBackLink />
          <h1 className="text-title font-bold text-balance">
            <bdi>{file.name}</bdi>
          </h1>
          <FileControls id={file.id} name={file.name} state={file.state} />
          <p className="text-secondary text-muted">{COPY.createdOn(formatDate(file.createdAt))}</p>
        </div>
        {file.state === 'closed' ? null : (
          <div className="w-full rounded-card border border-divider bg-surface p-3">
            <FileAlerts id={file.id} muted={file.alertsMuted} state={file.state} />
          </div>
        )}
        {file.readable ? (
          <section aria-labelledby="file-search" className="flex flex-col gap-2">
            <h2 id="file-search" className="text-label font-medium text-muted">
              {COPY.searchLabel}
            </h2>
            <ChipRow chips={file.chips} label={COPY.searchLabel} scrollOnPhone />
            {openHref === null ? null : (
              <Link
                href={openHref as never}
                className="inline-flex min-h-11 items-center gap-1 self-start text-control text-link underline"
              >
                {COPY.openInSearch}
                <Icon icon={ExternalLink} size={16} />
              </Link>
            )}
          </section>
        ) : null}
      </aside>
      <div className="flex min-w-0 flex-col gap-6">
        {file.state === 'paused' ? <Notice tone="warning">{COPY.pausedNotice}</Notice> : null}
        {file.state === 'closed' ? <Notice tone="neutral">{COPY.closedNotice}</Notice> : null}

        {data.crawl !== null && shouldShowRequestCard(data.crawl) ? (
          <RequestCard
            panel={data.crawl}
            fileId={file.id}
            matches={file.counts?.matches.count ?? null}
            searchHref={openHref}
          />
        ) : null}

        {!file.readable ? <FileUnreadable /> : null}
        {file.readable && data.resultsFailed ? <FileResultsFailed /> : null}

        {file.readable && !data.resultsFailed ? (
          <section aria-labelledby="file-matches" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="file-matches" className="text-heading font-bold">
                {COPY.matchesHeading}
                {total === undefined ? null : <span className="font-medium text-muted">{`: ${total}`}</span>}
              </h2>
              <p className="text-secondary text-muted">{COPY.rankedBy}</p>
              {file.state === 'closed' || file.lastAlertAt === null ? null : (
                <p data-last-alert-note className="text-secondary text-pretty text-muted">
                  {COPY.alertNote(formatTimeAgo(file.lastAlertAt, now))}
                </p>
              )}
              {file.state === 'closed' ? null : (
                <p
                  data-new-summary={newCount}
                  className={`text-control ${newCount > 0 ? 'font-semibold text-on-action-subtle' : 'text-muted'}`}
                >
                  {newCount > 0 ? COPY.newSince(newCount, since) : COPY.nothingNew(since)}
                </p>
              )}
            </div>
            {cards.length === 0 ? (
              <div className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-6">
                <h3 className="text-control font-semibold">{COPY.emptyTitle}</h3>
                <p className="max-w-reading text-body text-pretty text-muted">
                  {file.state === 'watching' ? COPY.emptyWatching : COPY.emptyOther}
                </p>
              </div>
            ) : (
              <ol className="grid gap-3 2xl:grid-cols-2 [&>li>*]:h-full">
                {cards.map((card, index) => (
                  <li key={card.id}>
                    <ListingCard
                      card={card}
                      now={now}
                      eager={index < 2}
                      mark={fresh.has(card.id) && file.state !== 'closed' ? COPY.newBadge : undefined}
                    />
                  </li>
                ))}
              </ol>
            )}
            {matches !== undefined && openHref !== null && matches.count > cards.length ? (
              <div className="flex flex-col items-start gap-1">
                <p className="text-secondary text-muted">
                  {COPY.shownOf(cards.length, COPY.matchesCount(matches.count, matches.exact))}
                </p>
                <Link
                  href={openHref as never}
                  className="inline-flex min-h-11 items-center text-control text-link underline"
                >
                  {COPY.seeAll(COPY.matchesCount(matches.count, matches.exact))}
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}
        <MarkViewed id={file.id} />
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'warning' | 'neutral'; children: React.ReactNode }) {
  return (
    <p
      role="note"
      className={`max-w-reading rounded-card p-4 text-secondary text-pretty ${tone === 'warning' ? 'bg-warning-subtle text-warning' : 'bg-surface-muted text-muted'}`}
    >
      {children}
    </p>
  );
}
