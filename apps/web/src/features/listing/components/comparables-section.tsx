import type { Route } from 'next';
import Link from 'next/link';
import { NumericText } from '@/components/ui/numeric-text';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { ComparableRow } from '@/features/listing/listing-view';

// The comparables behind the market value (CS-64; the explanation in the teardown, pattern 29, that Autolist does not
// show): the nearest listings the valuation used, each leading to its own page, with its own asking price and what it
// would ask if it were this car. Not prefetched: ten links to pages the buyer may never open.

const COPY = LISTING_COPY.comparables;

export function ComparablesSection({ rows }: { rows: readonly ComparableRow[] }) {
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
          <ul
            aria-label={COPY.listLabel}
            className="flex flex-col overflow-hidden rounded-card border border-divider"
          >
            {rows.map((row) => (
              <li key={row.id} className="border-b border-divider last:border-b-0">
                <Link
                  href={row.href as Route}
                  prefetch={false}
                  className="flex flex-col gap-2 bg-surface p-3 transition-colors hover:bg-surface-muted active:bg-surface-hover"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-control font-semibold text-balance">
                      <bdi>{row.title}</bdi>
                    </span>
                    <span className="text-meta text-muted">
                      {[row.facts, row.offMarket ? COPY.offMarket : '']
                        .filter((part) => part !== '')
                        .join(' · ')}
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
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
