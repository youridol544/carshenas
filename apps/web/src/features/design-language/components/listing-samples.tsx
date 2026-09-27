import {
  DEAL_LEVELS,
  type DealLevel,
  SAMPLE_LISTED_AT,
  SAMPLE_LISTINGS,
  SAMPLE_NOW,
} from '@/features/design-language/design-language-samples';
import { formatTimeAgo } from '@/lib/format-date';
import { formatPercent } from '@/lib/format-number';
import { formatToman } from '@/lib/toman';

// Two listing cards built only from tokens and the formatters: how the pieces combine, not the card CS-16 builds.
const classes = {
  great: 'bg-deal-great text-on-deal-great',
  good: 'bg-deal-good text-on-deal-good',
  fair: 'bg-deal-fair text-on-deal-fair',
  high: 'bg-deal-high text-on-deal-high',
  overpriced: 'bg-deal-overpriced text-on-deal-overpriced',
} as const satisfies Record<DealLevel, string>;

function dealLabel(rating: DealLevel) {
  return DEAL_LEVELS.find((level) => level.rating === rating)?.label ?? '';
}

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
              <p className="text-heading font-bold wrap-anywhere">{formatToman(listing.price)}</p>
              <p className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-badge px-2 py-0.5 text-label font-medium ${classes[listing.rating]}`}
                >
                  {dealLabel(listing.rating)}
                </span>
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
