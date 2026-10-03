import { formatCount } from '@carshenas/locale/format-number';
import { Bookmark } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { actionClasses, ActionLink } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { MarkedList } from '@/features/marked-listings/components/marked-list';
import { MARKED_COPY } from '@/features/marked-listings/marked-copy';
import type { MarkedFilter } from '@/features/marked-listings/marked-types';
import { markedPage, readMarkedFilter } from '@/features/marked-listings/marked-view';
import { listMarkedListings } from '@/features/marked-listings/server/marked-queries';
import { MarksProvider } from '@/features/marks/components/marks-provider';
import type { MarkSnapshot } from '@/features/marks/marks-types';
import { MARKED_PATH, SEARCH_PATH } from '@/lib/return-path';
import { requireAccount } from '@/server/auth/current-account';

// The signed-in buyer's marked listings (CS-69 #2): a filter row (everything, on the market, price fallen, off the market)
// that is plain links, so it works before any script and a filtered page has an address; then the rows. The session
// decides whose they are. The count and the rows of a mark taken off in place stay until the page is read again.

type MarkedViewProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function filterHref(filter: MarkedFilter): Route {
  return filter === 'all' ? MARKED_PATH : `${MARKED_PATH}?show=${filter}`;
}

export async function MarkedView({ searchParams }: MarkedViewProps) {
  const account = await requireAccount(MARKED_PATH);
  const filter = readMarkedFilter((await searchParams).show);
  const rows = await listMarkedListings(account.id);
  const page = markedPage(rows, filter);
  const snapshot: MarkSnapshot = { signedIn: true, marked: rows.map((row) => row.listingId) };

  if (page.total === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-card border border-divider bg-surface p-6">
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-default">
          <Icon icon={Bookmark} size={24} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-heading font-bold">{MARKED_COPY.empty.heading}</h2>
          <p className="max-w-reading text-body text-pretty text-muted">{MARKED_COPY.empty.body}</p>
        </div>
        <ActionLink level="primary" href={SEARCH_PATH}>
          {MARKED_COPY.empty.action}
        </ActionLink>
      </div>
    );
  }

  return (
    <MarksProvider initial={snapshot}>
      <nav aria-label={MARKED_COPY.filtersLabel} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-2">
          {(['all', 'active', 'dropped', 'off'] as const).map((name) => (
            <li key={name}>
              <Link
                href={filterHref(name)}
                prefetch={false}
                aria-current={name === filter ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-control whitespace-nowrap transition-colors ${
                  name === filter
                    ? 'border-action bg-action-subtle font-semibold text-default'
                    : 'border-control bg-surface text-default hover:bg-surface-hover'
                }`}
              >
                {MARKED_COPY.filters[name]}
                <span className="text-meta text-muted tabular-nums">{formatCount(page.counts[name])}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {page.items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface p-6">
          <h2 className="text-heading font-bold">{MARKED_COPY.emptyFilter.heading}</h2>
          <Link href={MARKED_PATH} className={actionClasses('secondary')}>
            {MARKED_COPY.emptyFilter.action}
          </Link>
        </div>
      ) : (
        <MarkedList items={page.items} total={page.total} />
      )}
    </MarksProvider>
  );
}
