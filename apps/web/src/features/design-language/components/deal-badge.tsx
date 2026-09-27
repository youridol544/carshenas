import {
  DEAL_LEVELS,
  type DealLevel,
  NO_RATING_LABEL,
} from '@/features/design-language/design-language-samples';

// A deal rating in the colours of its ramp: the word is always there, and colour only reinforces it.
type RatingOrNone = DealLevel | 'none';

const classes = {
  great: 'bg-deal-great text-on-deal-great',
  good: 'bg-deal-good text-on-deal-good',
  fair: 'bg-deal-fair text-on-deal-fair',
  high: 'bg-deal-high text-on-deal-high',
  overpriced: 'bg-deal-overpriced text-on-deal-overpriced',
  none: 'bg-deal-none text-on-deal-none',
} as const satisfies Record<RatingOrNone, string>;

/** The fill and ink of a rating, for a band of the ramp. */
export function dealColours(rating: RatingOrNone) {
  return classes[rating];
}

export function DealBadge({ rating }: { rating: RatingOrNone }) {
  const label =
    rating === 'none' ? NO_RATING_LABEL : DEAL_LEVELS.find((level) => level.rating === rating)?.label;
  return (
    <span className={`rounded-badge px-2 py-0.5 text-label font-medium ${classes[rating]}`}>{label}</span>
  );
}
