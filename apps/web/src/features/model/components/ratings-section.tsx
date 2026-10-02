import type { DealRating } from '@carshenas/db/db-types';
import { deal } from '@carshenas/search/filters';
import { formatCount } from '@carshenas/locale/format-number';
import { InfoPopover } from '@/components/ui/info-popover';
import { DealBadge } from '@/features/search/components/deal-badge';
import { MODEL_COPY } from '@/features/model/model-copy';
import { ratingsInfo } from '@/features/model/model-info';
import type { ModelStats } from '@/features/model/model-types';

// How the model's listings are priced against their market value (CS-67): one bar cut into the five ratings, cheapest
// on the right in this right-to-left page, and under it each rating by name with its count. The colour only reinforces
// the name (design-language.md, section 3): every segment is named and counted in the list, and the bar is hidden from
// assistive technology because the list says the same in words.

const COPY = MODEL_COPY.ratings;
const BAND = {
  great: 'bg-deal-great',
  good: 'bg-deal-good',
  fair: 'bg-deal-fair',
  high: 'bg-deal-high',
  overpriced: 'bg-deal-overpriced',
} as const satisfies Record<DealRating, string>;
const ORDER = ['great', 'good', 'fair', 'high', 'overpriced'] as const satisfies readonly DealRating[];

export function RatingsSection({ stats }: { stats: ModelStats }) {
  const rated = ORDER.reduce((sum, rating) => sum + stats.ratings[rating], 0);
  if (stats.count === 0) return null;
  const labelOf = (rating: DealRating) => deal.options.find((option) => option.value === rating)?.label ?? rating;
  return (
    <section aria-labelledby="model-ratings" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <h2 id="model-ratings" className="text-heading font-bold">
            {COPY.title}
          </h2>
          <InfoPopover label={MODEL_COPY.info.ratingsLabel} closeLabel={MODEL_COPY.info.close} content={ratingsInfo()} />
        </div>
        <p className="text-secondary text-muted">{COPY.lead(stats.count)}</p>
      </div>
      {rated === 0 ? null : (
        <div aria-hidden="true" className="flex h-4 overflow-hidden rounded-full bg-deal-none">
          {ORDER.map((rating) =>
            stats.ratings[rating] === 0 ? null : (
              <div
                key={rating}
                className={BAND[rating]}
                style={{ flexGrow: stats.ratings[rating], flexBasis: 0 }}
              />
            ),
          )}
        </div>
      )}
      <ul aria-label={COPY.chartLabel} className="flex flex-wrap gap-x-4 gap-y-2">
        {ORDER.map((rating) => (
          <li key={rating} className="flex items-center gap-2 text-label">
            <DealBadge rating={rating} label={labelOf(rating)} />
            <span className="tabular-nums">{formatCount(stats.ratings[rating])}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-label">
          <DealBadge rating="none" label={COPY.unrated} />
          <span className="tabular-nums">{formatCount(stats.unrated)}</span>
        </li>
      </ul>
    </section>
  );
}
