import type { Route } from 'next';
import Link from 'next/link';
import { NumericText } from '@/components/ui/numeric-text';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { ComparableRow } from '@/features/listing/listing-view';
import { ListingPhoto } from '@/features/search/components/listing-photo';

// The comparables behind the market value (CS-64; the explanation in the teardown, pattern 29, that Autolist does not
// show): the nearest listings the valuation used, each leading to its own page, with its photo, its own asking price and what it
// would ask if it were this car. The first five are shown; the rest wait in a native disclosure (no script), because ten
// rows of two prices are a long scroll on a phone. Not prefetched: ten links to pages the buyer may never open.

const COPY = LISTING_COPY.comparables;
const SHOWN = 5;

function Rows({ rows }: { rows: readonly ComparableRow[] }) {
  return (
    <ul aria-label={COPY.listLabel} className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} className="border-b border-divider last:border-b-0">
          <Link
            href={row.href as Route}
            prefetch={false}
            className="flex gap-3 bg-surface p-3 transition-colors hover:bg-surface-muted active:bg-surface-hover"
          >
            <span className="relative aspect-4/3 w-20 shrink-0 self-start overflow-hidden rounded-inner bg-surface-muted outline-1 -outline-offset-1 outline-photo">
              <ListingPhoto src={row.photoUrl} eager={false} sizes="5rem" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex flex-col gap-0.5">
                <span className="text-control font-semibold text-balance">
                  <bdi>{row.title}</bdi>
                </span>
                <span className="text-meta text-muted">
                  {[row.facts, row.offMarket ? COPY.offMarket : ''].filter((part) => part !== '').join(' · ')}
                </span>
              </span>
              <span className="grid grid-cols-2 gap-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-meta text-muted">{COPY.asking}</span>
                  <span className="text-control font-semibold">
                    <NumericText>{row.asking}</NumericText>
                  </span>
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-meta text-muted">{COPY.adjusted}</span>
                  <span className="text-control">
                    <NumericText>{row.adjusted}</NumericText>
                  </span>
                </span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ComparablesSection({ rows }: { rows: readonly ComparableRow[] }) {
  const first = rows.slice(0, SHOWN);
  const rest = rows.slice(SHOWN);
  return (
    <section aria-labelledby="comparables-title" className="flex flex-col gap-3">
      <h2 id="comparables-title" className="text-heading font-bold">
        {COPY.title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-body text-pretty text-muted">{COPY.none}</p>
      ) : (
        <>
          <p className="text-secondary text-pretty text-muted">{COPY.hint}</p>
          <div className="overflow-hidden rounded-card border border-divider">
            <Rows rows={first} />
            {rest.length === 0 ? null : (
              <details className="border-t border-divider">
                <summary className="flex min-h-12 items-center justify-center px-3 text-control text-link">
                  {COPY.showAll(rows.length)}
                </summary>
                <Rows rows={rest} />
              </details>
            )}
          </div>
        </>
      )}
    </section>
  );
}
