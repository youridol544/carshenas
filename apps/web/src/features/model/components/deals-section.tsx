import type { Route } from 'next';
import Link from 'next/link';
import { InfoPopover } from '@/components/ui/info-popover';
import { SkeletonText } from '@/components/ui/skeleton';
import { ListingCard, ListingCardSkeleton } from '@/features/search/components/listing-card';
import { MODEL_COPY } from '@/features/model/model-copy';
import { dealsOrderInfo } from '@/features/model/model-info';
import { readModelDeals } from '@/features/model/server/model-queries';
import { searchHref } from '@carshenas/search/search';

// The model's best current deals (CS-67): the search's own «بهترین معامله» order over this model (and model year), shown
// with the result card of CS-61, so a deal looks the same here as in the search. A link leads to all of the listings.

const COPY = MODEL_COPY.deals;

export async function DealsSection({ modelKey, year }: { modelKey: string; year: number | null }) {
  const { now, cards } = await readModelDeals(modelKey, year);
  const seeAll = searchHref({
    filters: { model: [modelKey], ...(year === null ? {} : { year: { min: year, max: year } }) },
  });
  return (
    <section aria-labelledby="model-deals" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
          <div className="flex items-center gap-1">
            <h2 id="model-deals" className="text-heading font-bold text-balance">
              {year === null ? COPY.title : COPY.titleOfYear(year)}
            </h2>
            <InfoPopover
              label={MODEL_COPY.info.dealsLabel}
              closeLabel={MODEL_COPY.info.close}
              content={dealsOrderInfo()}
            />
          </div>
          <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.lead}</p>
        </div>
        <Link
          href={seeAll as Route}
          className="inline-flex min-h-11 items-center px-2 text-control text-link underline"
        >
          {COPY.seeAll}
        </Link>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-card border border-divider p-4 text-secondary text-muted">{COPY.empty}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {cards.map((card, index) => (
            <li key={card.id} className="flex flex-col *:flex-1">
              <ListingCard card={card} now={now} eager={index < 2} modelLink={false} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SKELETON_KEYS = ['deal-1', 'deal-2'] as const;

export function DealsSectionSkeleton() {
  return (
    <section className="flex skeleton-delayed flex-col gap-4">
      <div aria-hidden="true" className="flex flex-col gap-1">
        <div className="w-56 text-heading">
          <SkeletonText lastLineWidth="w-full" />
        </div>
        <div className="w-80 max-w-full text-secondary">
          <SkeletonText lastLineWidth="w-full" />
        </div>
      </div>
      <ul aria-hidden="true" className="grid gap-3 lg:grid-cols-2">
        {SKELETON_KEYS.map((key) => (
          <li key={key}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ul>
    </section>
  );
}
