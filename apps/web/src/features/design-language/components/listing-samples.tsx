import { NumericText } from '@/components/ui/numeric-text';
import { DealBadge } from '@/features/design-language/components/deal-badge';
import {
  SAMPLE_LISTED_AT,
  SAMPLE_LISTINGS,
  SAMPLE_NOW,
} from '@/features/design-language/design-language-samples';
import { formatTimeAgo } from '@/lib/format-date';
import { formatPercent } from '@/lib/format-number';
import { formatToman } from '@/lib/toman';

// Two listing cards built only from tokens and the formatters: how the pieces combine, not the card CS-61 builds.
// The card's own text uses two weights, 400 and 600; the badge brings its own.
export function ListingSamples() {
  const listedAgo = formatTimeAgo(SAMPLE_LISTED_AT, SAMPLE_NOW);
  return (
    <ul className="flex flex-col gap-3">
      {SAMPLE_LISTINGS.map((listing) => (
        <li key={listing.id} className="@container">
          {/* Side by side only when the card is wide enough for a full-digit price beside the photo; the
              breakpoint is in rem, so doubled text stacks the card again. */}
          <article className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-3 @xs:flex-row">
            <div
              aria-hidden
              className="flex aspect-4/3 w-24 shrink-0 items-center justify-center self-start rounded-control bg-surface-muted text-meta text-subtle"
            >
              بدون عکس
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-control font-semibold text-balance">{listing.title}</h3>
              <p className="text-heading font-semibold">
                <NumericText>{formatToman(listing.price)}</NumericText>
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <DealBadge rating={listing.rating} />
                <span className="text-secondary text-muted">
                  {formatPercent(Math.abs(listing.gap))} {listing.gap < 0 ? 'زیر' : 'بالاتر از'} ارزش بازار
                </span>
              </p>
              <p className="text-meta text-muted">
                {listing.facts} · {listedAgo}
              </p>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
