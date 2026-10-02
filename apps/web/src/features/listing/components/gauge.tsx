import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { GaugeView } from '@/features/listing/gauge-view';
import type { DealRating } from '@carshenas/db/db-types';

// The deal bands as one continuous bar (CS-64, teardown pattern 28): the five bands of the deal ramp from the cheap end,
// which in this right-to-left page is the right edge, each named under the bar (colour never carries a band alone),
// a marker where this listing's price falls, and under the bar the bands' names and the market value in
// the middle. Server markup only. The marker and its callout are positioned from the inline start by a share of the
// bar's length, in a zero-width box that centres its content, so no physical offset or transform exists to mirror; the
// callout is kept clear of both ends so it never leaves the card. A listing with a market value but no rating gets the
// same bar in the neutral, with no band names: only where the price falls against the value.

const BAND_COLOURS = {
  great: 'bg-deal-great text-on-deal-great',
  good: 'bg-deal-good text-on-deal-good',
  fair: 'bg-deal-fair text-on-deal-fair',
  high: 'bg-deal-high text-on-deal-high',
  overpriced: 'bg-deal-overpriced text-on-deal-overpriced',
} as const satisfies Record<DealRating, string>;

/** The band widths as flex-grow weights in thousandths, so no arbitrary width class is needed. */
function weight(share: number): number {
  return Math.round(share * 1000);
}

/** Keeps the callout's centre away from the bar's ends by this share, so its text stays inside the card. */
const CALLOUT_MARGIN = 0.14;

export function Gauge({ view }: { view: GaugeView }) {
  const COPY = LISTING_COPY.analysis;
  const marker = view.marker;
  const calloutAt = marker === null ? null : Math.min(Math.max(marker, CALLOUT_MARGIN), 1 - CALLOUT_MARGIN);
  return (
    <div className="mt-12">
      <div role="img" aria-label={view.description} className="relative">
        {marker === null || calloutAt === null ? null : (
          <>
            <div
              aria-hidden="true"
              className="absolute -top-8 flex w-0 justify-center"
              style={{ insetInlineStart: `${String(calloutAt * 100)}%` }}
            >
              <span className="rounded-badge bg-action px-2 py-0.5 text-label font-medium whitespace-nowrap text-on-action">
                {COPY.thisPrice}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="absolute -inset-y-1 z-10 flex w-0 justify-center"
              style={{ insetInlineStart: `${String(marker * 100)}%` }}
            >
              <span className="w-1 shrink-0 rounded-full border-x border-canvas bg-action" />
            </div>
          </>
        )}
        <div aria-hidden="true" className="flex h-8 overflow-hidden rounded-full bg-deal-none">
          {view.bands.map((band) => (
            <div
              key={band.rating}
              className={BAND_COLOURS[band.rating]}
              style={{ flexGrow: weight(band.share), flexBasis: 0 }}
            />
          ))}
        </div>
        {view.bands.length === 0 ? (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 flex w-0 justify-center"
            style={{ insetInlineStart: `${String(50)}%` }}
          >
            <span className="h-full shrink-0 border-s border-control" />
          </div>
        ) : null}
      </div>
      <ul className="sr-only">
        {view.bands.map((band) => (
          <li key={band.rating}>{band.name}</li>
        ))}
      </ul>
      <div aria-hidden="true" className="mt-1 flex text-meta font-medium text-muted">
        {view.bands.map((band) => (
          <span
            key={band.rating}
            className="min-w-0 truncate text-center"
            style={{ flexGrow: weight(band.share), flexBasis: 0 }}
          >
            {band.shortName}
          </span>
        ))}
      </div>
      <p aria-hidden="true" className="mt-1 text-center text-meta text-default">
        {COPY.marketValue}
      </p>
      {view.beyond === null ? null : (
        <p className="mt-1 text-meta text-muted">
          {view.beyond === 'cheap' ? COPY.beyondCheap : COPY.beyondDear}
        </p>
      )}
    </div>
  );
}
