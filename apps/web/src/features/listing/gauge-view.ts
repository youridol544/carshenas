import { formatDate } from '@carshenas/locale/format-date';
import { formatCount, formatPercent } from '@carshenas/locale/format-number';
import { formatToman, formatTomanEstimate, toToman } from '@carshenas/locale/toman';
import { DEAL_GAP_PCT, deal } from '@carshenas/search/filters';
import type { InfoContent } from '@/components/ui/info-popover';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import {
  gaugeBands,
  isBeyondGauge,
  markerShare,
  MAX_SEGMENT_ERROR_PCT,
  MIN_COMPARABLES,
  MIN_NEAR_YEAR_COMPARABLES,
  NEAR_YEARS,
} from '@/features/listing/listing-rules';
import type { DealRating, ListingFacts, ValuationFacts } from '@/features/listing/listing-types';
import { gapSentence } from '@/features/search/listing-card-view';
import type { DealTone } from '@/features/search/listing-card-view';

// The price analysis's gauge (CS-64; teardown pattern 28): the five deal bands as one continuous bar from the cheap end,
// a marker where this listing's price falls against the market value, and the numbers under it. The bands' limits are
// S01's (DEAL_GAP_PCT in @carshenas/search, which the rating itself applies), never retyped. A listing with a market
// value but no rating (a negotiable one, an instalment one, an outlier) gets the bar without bands, the marker placed
// from the value and the price, and the reason instead of a verdict: the page computes that gap only for the marker.

/** The deal's short names, as the glossary writes them: the band's label inside the bar. */
const SHORT_NAMES: Readonly<Record<DealRating, string>> = {
  great: 'عالی',
  good: 'خوب',
  fair: 'منصفانه',
  high: 'گران',
  overpriced: 'خیلی گران',
};

export type GaugeBandView = {
  readonly rating: DealRating;
  /** Share of the bar's length, 0 to 1. */
  readonly share: number;
  readonly shortName: string;
  /** «معامله‌ی عالی» in full, for a screen reader and the info control. */
  readonly name: string;
};

export type GaugeView = {
  /** True when the listing has a rating: the bar shows its bands. */
  readonly banded: boolean;
  readonly bands: readonly GaugeBandView[];
  /** The marker's place, 0 at the cheap end to 1; null when this listing's price cannot be placed. */
  readonly marker: number | null;
  /** The price lies beyond the bar's range: the marker sits at that end. */
  readonly beyond: 'cheap' | 'dear' | null;
  readonly rating: DealTone;
  readonly ratingLabel: string;
  /** «۸٪ زیر ارزش بازار»; null when there is no rating. */
  readonly gap: string | null;
  /** The asking price in full digits; null when the listing has none. */
  readonly price: string | null;
  /** The market value to three significant digits, and the day it was computed. */
  readonly value: string;
  readonly valuedOn: string;
  /** The words for a screen reader: where the price is on the bar. */
  readonly description: string;
};

const percent = (pct: number) => formatPercent(Math.abs(pct) / 100);

function nameOf(rating: DealRating): string {
  return deal.options.find((option) => option.value === rating)?.label ?? SHORT_NAMES[rating];
}

/** The gauge of a listing with a market value; null when the listing has none. */
export function gaugeView(listing: ListingFacts, valuation: ValuationFacts | null): GaugeView | null {
  if (valuation === null) return null;
  const rated = valuation.dealRating !== null && valuation.priceGapPct !== null;
  const asking =
    valuation.ratedPriceToman ?? (listing.priceType === 'asking' ? listing.askingPriceToman : null);
  // The marker's own gap: the stored one for a rated listing, computed from the value and the price otherwise.
  const gapPct =
    valuation.priceGapPct ??
    (asking === null ? null : ((asking - valuation.marketValueToman) / valuation.marketValueToman) * 100);
  const bands = rated
    ? gaugeBands().map((band) => ({
        rating: band.rating,
        share: band.share,
        shortName: SHORT_NAMES[band.rating],
        name: nameOf(band.rating),
      }))
    : [];
  const rating: DealTone = valuation.dealRating ?? 'none';
  const ratingLabel = valuation.dealRating === null ? 'بدون ارزیابی' : nameOf(valuation.dealRating);
  const price = asking === null ? null : formatToman(toToman(asking));
  const value = formatTomanEstimate(toToman(valuation.marketValueToman));
  const gap = rated ? gapSentence(valuation.priceGapPct) : null;
  const description =
    gapPct === null
      ? `${LISTING_COPY.analysis.marketValue}: ${value}`
      : `${LISTING_COPY.analysis.thisPrice}: ${price ?? ''}، ${LISTING_COPY.analysis.marketValue}: ${value}`;
  return {
    banded: rated,
    bands,
    marker: gapPct === null ? null : markerShare(gapPct),
    beyond: gapPct === null || !isBeyondGauge(gapPct) ? null : gapPct < 0 ? 'cheap' : 'dear',
    rating,
    ratingLabel,
    gap,
    price,
    value,
    valuedOn: formatDate(valuation.run.asOfDate),
    description: gap === null ? description : `${description}، ${gap}`,
  };
}

/**
 * What the info control beside «تحلیل قیمت» says: the filter's own description, the five bands with the limits S01 (and the
 * rating's SQL) use, and what a model needs before its listings are rated. Every number is printed from the constants
 * the rating applies, so the words and the rating cannot disagree.
 */
export function gaugeInfo(): InfoContent {
  const great = percent(DEAL_GAP_PCT.great);
  const good = percent(DEAL_GAP_PCT.good);
  const fair = percent(DEAL_GAP_PCT.fair);
  const high = percent(DEAL_GAP_PCT.high);
  const rows: { rating: DealRating; text: string }[] = [
    { rating: 'great', text: `${great} یا بیشتر زیر ارزش بازار` },
    { rating: 'good', text: `از ${good} تا ${great} زیر ارزش بازار` },
    { rating: 'fair', text: `کمتر از ${fair} بالاتر یا پایین‌تر از ارزش بازار` },
    { rating: 'high', text: `از ${fair} تا ${high} بالاتر از ارزش بازار` },
    { rating: 'overpriced', text: `${high} یا بیشتر بالاتر از ارزش بازار` },
  ];
  return {
    title: LISTING_COPY.analysis.info,
    sections: [
      { id: 'what', paragraphs: [deal.description] },
      {
        id: 'bands',
        heading: 'پنج رده، از ارزان‌ترین',
        rows: rows.map((row) => ({ label: nameOf(row.rating), text: row.text })),
      },
      {
        id: 'needs',
        heading: 'چه وقت ارزیابی نمی‌کنیم؟',
        paragraphs: [
          `فقط وقتی ارزیابی می‌کنیم که برای آن مدل دست‌کم ${formatCount(MIN_COMPARABLES)} آگهی مشابه داشته باشیم، دست‌کم ${formatCount(MIN_NEAR_YEAR_COMPARABLES)} تا از آن‌ها با فاصله‌ی حداکثر ${formatCount(NEAR_YEARS)} سال از این خودرو باشند و خطای معمول برآورد برای آن مدل از ${percent(MAX_SEGMENT_ERROR_PCT)} بیشتر نباشد. آگهی توافقی و قسطی هم ارزیابی نمی‌شود.`,
        ],
      },
    ],
  };
}
