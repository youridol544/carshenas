import type { DealTone } from '@/features/search/listing-card-view';

// A deal rating in the colours of its ramp (docs/design/design-language.md, section 3): the word is always there and
// the colour only reinforces it, so the five levels stay apart in greyscale and for colour-blind buyers; a priced
// listing the valuation did not rate wears the neutral. The same classes colour a gauge's bands on the listing page.

const COLOURS = {
  great: 'bg-deal-great text-on-deal-great',
  good: 'bg-deal-good text-on-deal-good',
  fair: 'bg-deal-fair text-on-deal-fair',
  high: 'bg-deal-high text-on-deal-high',
  overpriced: 'bg-deal-overpriced text-on-deal-overpriced',
  none: 'bg-deal-none text-on-deal-none',
} as const satisfies Record<DealTone, string>;

export function DealBadge({ rating, label }: { rating: DealTone; label: string }) {
  return (
    <span className={`inline-flex rounded-badge px-2 py-0.5 text-label font-medium ${COLOURS[rating]}`}>
      {label}
    </span>
  );
}
