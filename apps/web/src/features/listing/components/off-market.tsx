import { Archive } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { NumericText } from '@/components/ui/numeric-text';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { SimilarListing } from '@/features/listing/listing-types';
import { nameWithYear } from '@/features/listing/listing-view';
import { DealBadge } from '@/features/search/components/deal-badge';
import { ListingPhoto } from '@/features/search/components/listing-photo';
import { formatMileage } from '@carshenas/locale/format-number';
import { withAssumption } from '@/lib/mileage-info';
import { formatToman, toToman } from '@carshenas/locale/toman';
import { deal } from '@carshenas/search/filters';

// A listing that has left the market says so plainly, at the top, before anything else (CS-64 criterion 7), and offers
// the nearest listings that are still on it. The page keeps its facts and its price history (they are what we last saw),
// and the photos from the source's own addresses, which show while the source still serves them and fall back to the
// placeholder when it does not (ADR-0025 point 4: we keep no copy to outlive them).

const COPY = LISTING_COPY.state;

export function OffMarketBanner({ message, since }: { message: string; since: string }) {
  return (
    <div
      role="status"
      data-off-market
      className="flex items-start gap-3 rounded-card border border-divider bg-surface-muted p-4"
    >
      <span className="flex h-lh shrink-0 items-center text-muted">
        <Icon icon={Archive} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-control font-semibold">{message}</p>
        <p className="text-secondary text-pretty text-muted">
          {COPY.since(since)}. {COPY.offHint}
        </p>
      </div>
    </div>
  );
}

type SimilarProps = {
  items: readonly SimilarListing[];
  searchLink: string | null;
  /** The section's own words, for a page that offers listings for another reason than a listing that left (CS-65). */
  words?: { title: string; hint: string; all: string; none?: string };
};

export function SimilarSection({ items, searchLink, words }: SimilarProps) {
  const text = {
    title: COPY.similarTitle,
    hint: COPY.similarHint,
    all: COPY.similarAll,
    none: COPY.similarNone,
    ...words,
  };
  return (
    <section aria-labelledby="similar-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="similar-title" className="text-heading font-bold">
          {text.title}
        </h2>
        <p className="text-secondary text-muted">{text.hint}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-body text-muted">{text.none}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
          {items.map((item) => {
            const rating =
              item.dealRating === null
                ? null
                : deal.options.find((option) => option.value === item.dealRating);
            return (
              <li
                key={item.id}
                className="relative rounded-card border border-divider bg-surface transition-colors hover:bg-surface-muted"
              >
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 p-2">
                  <div className="relative aspect-4/3 overflow-hidden rounded-inner bg-surface-muted outline-1 -outline-offset-1 outline-photo">
                    <ListingPhoto src={item.photoUrl} eager={false} sizes="6rem" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 p-1">
                    <Link
                      href={`/listings/${String(item.id)}` as Route}
                      prefetch={false}
                      className="text-control font-semibold text-balance after:absolute after:inset-0"
                    >
                      <bdi>{nameWithYear(item.name, item.modelYearSh)}</bdi>
                    </Link>
                    {item.mileageKm === null ? null : (
                      <p className="text-secondary text-muted">
                        {withAssumption(
                          formatMileage(item.mileageKm),
                          item.mileageAssumed ? 'thousands_price' : null,
                        )}
                      </p>
                    )}
                    {item.askingPriceToman === null ? null : (
                      <p className="text-control font-semibold">
                        <NumericText>{formatToman(toToman(item.askingPriceToman))}</NumericText>
                      </p>
                    )}
                    {rating === undefined || rating === null || item.dealRating === null ? null : (
                      <p>
                        <DealBadge rating={item.dealRating} label={rating.label} />
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {searchLink === null ? null : (
        <Link href={searchLink as Route} className={`${actionClasses('secondary')} self-start`}>
          {text.all}
        </Link>
      )}
    </section>
  );
}
