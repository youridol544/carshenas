import { DEAL_LEVELS, type DealLevel } from '@/features/design-language/design-language-samples';

// The five deal ratings as one ramp whose lightness only rises from great to overpriced, plus «بدون ارزیابی» in
// the neutral. The word is always there; colour only reinforces it.
type BadgeLevel = DealLevel | 'none';

const classes = {
  great: 'bg-deal-great text-on-deal-great',
  good: 'bg-deal-good text-on-deal-good',
  fair: 'bg-deal-fair text-on-deal-fair',
  high: 'bg-deal-high text-on-deal-high',
  overpriced: 'bg-deal-overpriced text-on-deal-overpriced',
  none: 'bg-deal-none text-on-deal-none',
} as const satisfies Record<BadgeLevel, string>;

export function DealRamp() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {DEAL_LEVELS.map(({ rating, label }) => (
          <li key={rating} className={`rounded-badge px-2 py-0.5 text-label font-medium ${classes[rating]}`}>
            {label}
          </li>
        ))}
        <li className={`rounded-badge px-2 py-0.5 text-label font-medium ${classes.none}`}>بدون ارزیابی</li>
      </ul>
      {/* Wraps rather than clipping when doubled text makes the words wider than a phone. */}
      <ol aria-label="بازهٔ ارزیابی قیمت، از ارزان به گران" className="flex flex-wrap">
        {DEAL_LEVELS.map(({ rating, short }) => (
          <li
            key={rating}
            className={`grow py-1 text-center text-meta first:rounded-s-full last:rounded-e-full ${classes[rating]}`}
          >
            {short}
          </li>
        ))}
      </ol>
    </div>
  );
}
