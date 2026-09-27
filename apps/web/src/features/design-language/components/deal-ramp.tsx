import { DealBadge, dealColours } from '@/features/design-language/components/deal-badge';
import { DEAL_LEVELS } from '@/features/design-language/design-language-samples';

// The five deal ratings as one ramp whose lightness only rises from great to overpriced, plus «بدون ارزیابی» in
// the neutral.
export function DealRamp() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {DEAL_LEVELS.map(({ rating }) => (
          <li key={rating}>
            <DealBadge rating={rating} />
          </li>
        ))}
        <li>
          <DealBadge rating="none" />
        </li>
      </ul>
      {/* Five equal bands once the widest word fits a fifth of the width: «خیلی گران» is 50 px in text-meta,
          so from 18rem, the 288 px of a 320 px phone. The threshold is in rem, so doubled text stacks the bands
          instead of clipping them. */}
      <div className="@container">
        <ol
          aria-label="بازه‌ی ارزیابی قیمت، از ارزان به گران"
          className="grid grid-cols-1 overflow-hidden rounded-control @2xs:grid-cols-5 @2xs:rounded-full"
        >
          {DEAL_LEVELS.map(({ rating, short }) => (
            <li key={rating} className={`py-1 text-center text-meta ${dealColours(rating)}`}>
              {short}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
