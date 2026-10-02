import { NumericText } from '@/components/ui/numeric-text';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { GaugeView } from '@/features/listing/gauge-view';
import type { PriceView } from '@/features/listing/listing-view';
import { DealBadge } from '@/features/search/components/deal-badge';

// The price and its verdict side by side (CS-64, teardown pattern 26): the asking price in full digits at the hero size
// (the title role on a phone, the display role from a 24 rem container, design-language.md section 2), the deal badge
// with the gap to market value beside it, and the market value with its date under them. An instalment sale shows its
// down payment with the words that say so; a negotiable one says «توافقی» and gets no badge.

const COPY = LISTING_COPY.price;

type PriceCardProps = { price: PriceView; gauge: GaugeView | null; hasAnalysis: boolean };

export function PriceCard({ price, gauge, hasAnalysis }: PriceCardProps) {
  const showBadge = price.kind === 'amount' && gauge !== null;
  return (
    <div className="@container flex flex-col gap-2">
      {price.caption === null ? null : <p className="text-label font-medium text-muted">{price.caption}</p>}
      <p
        className={`font-bold ${price.kind === 'words' ? 'text-title text-muted' : 'text-title @sm:text-display'}`}
        data-price
      >
        {price.kind === 'words' ? price.text : <NumericText>{price.text}</NumericText>}
      </p>
      {price.kind === 'down_payment' ? (
        <p className="text-secondary text-pretty text-muted">{COPY.downPaymentNote}</p>
      ) : null}
      {showBadge ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <DealBadge rating={gauge.rating} label={gauge.ratingLabel} />
          {gauge.gap === null ? null : <span className="text-label text-muted">{gauge.gap}</span>}
        </p>
      ) : null}
      {hasAnalysis && gauge !== null ? (
        <p className="text-secondary text-muted">
          {LISTING_COPY.analysis.marketValue}: <NumericText>{gauge.value}</NumericText>
          {`، ${gauge.valuedOn}`}
        </p>
      ) : null}
    </div>
  );
}
