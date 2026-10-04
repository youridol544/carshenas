import { toPersianDigits } from '@carshenas/locale/digits';
import { isAssumedMileage } from '@carshenas/search/mileage-reading';
import { formatCount, formatMileage, formatPercent } from '@carshenas/locale/format-number';
import { MIN_ADJUSTMENT_PCT } from '@/features/listing/listing-rules';
import type {
  AdjustmentTerm,
  Comparable,
  ListingFacts,
  NoRatingReason,
  ValuationFacts,
} from '@/features/listing/listing-types';
import { gapSentence } from '@/features/search/listing-card-view';
import { nameOnScreen } from '@carshenas/locale/names';

// «چرا این ارزیابی؟» (CS-64): the explanation of a rating, written by code from the stored facts through templates, with
// no language model. Every number a buyer reads in it is a stored number (the price gap, the comparables' count, years
// and mileage, the model's error) or arithmetic on stored numbers that is written down here (an adjustment's size is
// exp(coefficient × the car's value) − 1, from valuation_coefficient, the way valuation_rate_listing() applies it), so
// no number can be invented, and the rule that a number a buyer sees never comes from model text holds by construction.
// The model's own rules (its thresholds, its window, its method number) are not said to a buyer: they are not a number
// the buyer can check on the page (the voice guide, R7). It also answers the field survey's request for a faithfulness
// rate: each number is written through `figure`, which records it with its source, so a test can check every figure
// against the database and every digit in the text against the figures (listing-explanation.test.ts and
// listing-explanation.db.test.ts, the labelled sample).

/** One number of the explanation, with where it comes from. */
export type Figure = {
  readonly id: string;
  /** The number as stored or derived, not rounded; a range («مدل ۱۳۹۸ تا ۱۴۰۴») has its two ends. */
  readonly values: readonly number[];
  /** The number as the text writes it: formatted by the locale package. */
  readonly text: string;
  /** The column it is read from, or the formula it is computed by from columns. */
  readonly source: string;
};

export type ExplanationLine = {
  readonly id: string;
  readonly text: string;
  /** For an adjustment: whether it raises or lowers the value. */
  readonly direction?: 'up' | 'down';
};

export type Explanation = {
  /** The one-sentence verdict, shown first. */
  readonly verdict: string;
  /** What the market value rests on, then each adjustment, then how accurate the value is, or why there is no rating. */
  readonly lines: readonly ExplanationLine[];
  /** «روش محاسبه»: how the values are made, in general. */
  readonly method: readonly string[];
  readonly figures: readonly Figure[];
  /** The catalogue names quoted in the text («پژو ۲۰۶»): stored names, whose own digits are not figures. */
  readonly names: readonly string[];
};

export type ExplanationInput = {
  readonly listing: ListingFacts;
  readonly valuation: ValuationFacts | null;
  /** The comparables the page lists: their years and mileage are quoted. */
  readonly comparables: readonly Comparable[];
};

/** The part of the price model each adjustment term applies to, as the SQL does (valuation_rate_listing). */
const OFF_COLOUR_FAMILIES = new Set(['white', 'black', 'silver', 'grey']);

/** How far above (negative: below) the norm a car's mileage is: the model's own `mileage_deviation`, in kilometres. */
export function mileageAboveNorm(mileageKm: number, age: number, normKmPerYear: number): number {
  return mileageKm - normKmPerYear * Math.max(age, 0.5);
}

/** A car's age in the valuation: whole Solar Hijri years since its model year, never below zero. */
export function valuationAge(referenceYearSh: number, modelYearSh: number): number {
  return Math.max(referenceYearSh - modelYearSh, 0);
}

/** An adjustment's size in percent: how much a term of the price model moves the value for this car's own value of it. */
export function adjustmentPct(coefficient: number, valueOfTerm: number): number {
  return (Math.exp(coefficient * valueOfTerm) - 1) * 100;
}

const ADJUSTMENT_LABELS: Record<Exclude<AdjustmentTerm, 'mileage_deviation'>, string> = {
  zero_km: 'صفر کیلومتر بودن',
  body_minor: 'خط‌وخش جزئی بدنه',
  body_painted: 'رنگ‌شدگی بدنه',
  body_painted_around: 'دوررنگ بودن',
  chassis_repainted: 'رنگ‌شدگی شاسی',
  gearbox_automatic: 'گیربکس اتوماتیک',
  dual_fuel_aftermarket: 'دوگانه‌سوز بودن با کیت غیرکارخانه‌ای',
  electrified: 'هیبریدی یا برقی بودن',
  off_colour: 'رنگی غیر از سفید، مشکی، نقره‌ای و خاکستری',
};

/** Which terms apply to a car, and by which value of the term's variable (1 for a flag), exactly as the SQL reads them. */
function termValues(
  listing: ListingFacts,
  valuation: ValuationFacts,
  age: number,
): readonly { term: AdjustmentTerm; value: number }[] {
  const { declared } = listing;
  const values: { term: AdjustmentTerm; value: number }[] = [];
  if (listing.mileageKm !== null) {
    values.push({
      term: 'mileage_deviation',
      value: mileageAboveNorm(listing.mileageKm, age, valuation.run.mileageNormKmPerYear) / 100_000,
    });
    if (listing.mileageKm < 1_000) values.push({ term: 'zero_km', value: 1 });
  }
  if (declared.body === 'minor_scratches') values.push({ term: 'body_minor', value: 1 });
  if (declared.body === 'partly_repainted') values.push({ term: 'body_painted', value: 1 });
  if (declared.body === 'repainted_around') values.push({ term: 'body_painted_around', value: 1 });
  if (declared.frontChassis === 'repainted' || declared.rearChassis === 'repainted') {
    values.push({ term: 'chassis_repainted', value: 1 });
  }
  if (listing.gearbox === 'automatic') values.push({ term: 'gearbox_automatic', value: 1 });
  if (listing.fuel === 'dual_fuel_aftermarket') values.push({ term: 'dual_fuel_aftermarket', value: 1 });
  if (listing.fuel === 'hybrid' || listing.fuel === 'plug_in_hybrid' || listing.fuel === 'electric') {
    values.push({ term: 'electrified', value: 1 });
  }
  if (!OFF_COLOUR_FAMILIES.has(listing.colourFamily ?? 'white'))
    values.push({ term: 'off_colour', value: 1 });
  return values;
}

/** The sentence for a listing without a rating: what is missing, in the buyer's words and with no rule's number. */
function reasonText(reason: NoRatingReason, listing: ListingFacts): string {
  switch (reason) {
    case 'unmatched_model':
      return 'مدل این آگهی را نشناخته‌ایم، پس ارزش بازارش را حساب نمی‌کنیم.';
    case 'missing_attributes':
      return 'سال ساخت، کارکرد یا نوع گیربکس در آگهی نیامده یا معلوم نیست. بدون آن‌ها ارزش بازار حساب نمی‌شود.';
    case 'excluded_condition':
      return 'وضعیتی که فروشنده اعلام کرده، مثل تصادف یا تمام‌رنگی، با آگهی‌های مشابه قابل مقایسه نیست.';
    case 'too_few_comparables':
      return 'برای این مدل آگهی مشابه کافی نداریم.';
    case 'uncertain_segment':
      return 'برآورد ما برای این مدل به‌اندازه‌ی کافی دقیق نیست.';
    case 'year_out_of_range':
      return 'آگهی مشابه کافی با سال ساخت یا کارکردی نزدیک به این خودرو نداریم.';
    case 'unknown_price':
      return 'قیمت این آگهی معلوم نیست.';
    case 'no_asking_price':
      return 'قیمت این آگهی توافقی است و چیزی برای سنجیدن نیست.';
    case 'placeholder_price':
      return 'قیمت نوشته‌شده در آگهی نمایشی است، نه قیمت خودرو.';
    case 'installment_price':
      return listing.priceType === 'installment'
        ? 'قیمت این آگهی پیش‌پرداخت یک فروش قسطی است، نه قیمت خودرو.'
        : 'قیمت این آگهی خیلی زیر ارزش بازار است و فروش قسطی هم دارد. چنین قیمتی اغلب پیش‌پرداخت است.';
    case 'dealer_new_car':
      return 'نمایشگاه‌ها قیمت خودروی صفر را اغلب به‌صورت پیش‌فروش، پیش‌پرداخت یا قیمت شروع می‌نویسند.';
    case 'price_outlier':
      return 'قیمت این آگهی خیلی با ارزش بازار فاصله دارد. شاید اشتباه تایپی یا قیمت نمایشی باشد.';
  }
}

/** Builds the explanation of one listing's valuation. Pure: the same facts always give the same words. */
export function buildExplanation(input: ExplanationInput): Explanation {
  const { listing, valuation, comparables } = input;
  const figures: Figure[] = [];
  const figure = (id: string, values: number | readonly number[], text: string, source: string): string => {
    figures.push({ id, values: typeof values === 'number' ? [values] : values, text, source });
    return text;
  };
  const lines: ExplanationLine[] = [];
  const modelName = nameOnScreen(listing.model?.name ?? listing.name);

  // No market value: the verdict says so, and the analysis box says when one comes (listing-copy.ts, notValued).
  if (valuation === null) {
    return {
      verdict: 'برای این آگهی هنوز ارزش بازاری حساب نشده است.',
      lines: [],
      method: [],
      figures,
      names: [],
    };
  }

  const { run, segment } = valuation;

  // The verdict.
  let verdict: string;
  if (valuation.dealRating !== null && valuation.priceGapPct !== null) {
    const gap = gapSentence(valuation.priceGapPct);
    figure('gap', valuation.priceGapPct, gap, 'listing_valuation.price_gap_pct, rounded to whole percent');
    verdict = `قیمت این آگهی ${gap} است.`;
  } else {
    verdict = 'ارزش بازار این خودرو را حساب کرده‌ایم، اما قیمت این آگهی را ارزیابی نمی‌کنیم.';
  }

  // The value itself, and its date, stand in the box above (the gauge's own figures): this says what it was made from.
  lines.push({
    id: 'value',
    text: `ارزش بازار این خودرو را از آگهی‌های مشابه ${modelName} حساب کرده‌ایم.`,
  });

  // What the value rests on: the model's comparables, and the nearest ones shown below.
  if (segment !== null) {
    const years = figure(
      'segment_years',
      [segment.minModelYearSh, segment.maxModelYearSh],
      segment.minModelYearSh === segment.maxModelYearSh
        ? toPersianDigits(String(segment.minModelYearSh))
        : `${toPersianDigits(String(segment.minModelYearSh))} تا ${toPersianDigits(String(segment.maxModelYearSh))}`,
      'valuation_segment.min_model_year_sh, max_model_year_sh',
    );
    const count = figure(
      'segment_count',
      segment.comparableCount,
      formatCount(segment.comparableCount),
      'valuation_segment.comparable_count',
    );
    const yearsOf = comparables.flatMap((item) => (item.modelYearSh === null ? [] : [item.modelYearSh]));
    const kmOf = comparables.flatMap((item) => (item.mileageKm === null ? [] : [item.mileageKm]));
    let basis = `این حساب بر پایه‌ی ${count} آگهی مشابه با مدل ${years} است.`;
    if (comparables.length > 0 && yearsOf.length > 0 && kmOf.length > 0) {
      const near = figure(
        'near_count',
        comparables.length,
        formatCount(comparables.length),
        'count of listing_valuation_comparable rows',
      );
      const fromYear = Math.min(...yearsOf);
      const toYear = Math.max(...yearsOf);
      const fromKm = Math.min(...kmOf);
      const toKm = Math.max(...kmOf);
      const nearYears = figure(
        'near_years_range',
        [fromYear, toYear],
        fromYear === toYear
          ? toPersianDigits(String(fromYear))
          : `${toPersianDigits(String(fromYear))} تا ${toPersianDigits(String(toYear))}`,
        'min and max model_year_sh of the comparables',
      );
      const nearKm = figure(
        'near_km_range',
        [fromKm, toKm],
        fromKm === toKm ? formatMileage(fromKm) : `${formatCount(fromKm)} تا ${formatMileage(toKm)}`,
        'min and max mileage_km of the comparables',
      );
      basis += ` نزدیک‌ترین ${near} آگهی را پایین همین صفحه می‌بینید. مدل آن‌ها ${nearYears} و کارکردشان ${nearKm} است.`;
    }
    lines.push({ id: 'basis', text: basis });
  }

  // The adjustments that moved the value for this car.
  if (listing.modelYearSh !== null) {
    const age = valuationAge(run.referenceYearSh, listing.modelYearSh);
    const adjustments: { id: string; text: string; direction: 'up' | 'down'; size: number }[] = [];

    if (valuation.modelAgeSlope !== null) {
      const perYear = adjustmentPct(valuation.modelAgeSlope, 1);
      if (Math.abs(perYear) >= MIN_ADJUSTMENT_PCT) {
        const size = figure(
          'age_slope',
          perYear,
          formatPercent(Math.round(Math.abs(perYear)) / 100),
          'exp(valuation_coefficient model_age_slope) - 1, rounded to whole percent',
        );
        const year = figure(
          'model_year',
          listing.modelYearSh,
          toPersianDigits(String(listing.modelYearSh)),
          'listing.model_year_sh',
        );
        adjustments.push({
          id: 'age',
          direction: perYear < 0 ? 'down' : 'up',
          size: Number.POSITIVE_INFINITY,
          text: `مدل ${year}: ارزش ${modelName} با هر سال عمر حدود ${size} ${perYear < 0 ? 'کم' : 'زیاد'} می‌شود.`,
        });
      }
    }

    for (const { term, value: termValue } of termValues(listing, valuation, age)) {
      const coefficient = valuation.coefficients[term];
      if (coefficient === undefined) continue;
      const pct = adjustmentPct(coefficient, termValue);
      if (Math.abs(pct) < MIN_ADJUSTMENT_PCT) continue;
      const size = figure(
        `adjustment_${term}`,
        pct,
        formatPercent(Math.round(Math.abs(pct)) / 100),
        `exp(valuation_coefficient ${term} × the car's value of the term) - 1, rounded to whole percent`,
      );
      const effect = `ارزش را حدود ${size} ${pct < 0 ? 'کم' : 'زیاد'} می‌کند`;
      if (term === 'mileage_deviation' && listing.mileageKm !== null) {
        const above = mileageAboveNorm(listing.mileageKm, age, run.mileageNormKmPerYear);
        const km = figure(
          'mileage',
          listing.mileageKm,
          formatMileage(listing.mileageKm),
          'listing.mileage_km',
        );
        const away = figure(
          'mileage_away',
          Math.abs(above),
          formatMileage(Math.abs(above)),
          'abs(listing.mileage_km - mileage norm × max(age, 0.5))',
        );
        adjustments.push({
          id: term,
          direction: pct < 0 ? 'down' : 'up',
          size: Math.abs(pct),
          text: `کارکرد ${isAssumedMileage(listing.mileageReading) ? 'احتمالاً ' : ''}${km} است، ${away} ${above > 0 ? 'بیشتر' : 'کمتر'} از کارکرد معمول. ${effect}.`,
        });
      } else if (term !== 'mileage_deviation') {
        adjustments.push({
          id: term,
          direction: pct < 0 ? 'down' : 'up',
          size: Math.abs(pct),
          text: `${ADJUSTMENT_LABELS[term]}: ${effect}.`,
        });
      }
    }

    // The age comes first, as the baseline every other adjustment is made on; the rest run from the largest.
    adjustments.sort((first, second) => second.size - first.size);
    for (const adjustment of adjustments) {
      lines.push({ id: adjustment.id, text: adjustment.text, direction: adjustment.direction });
    }
    if (adjustments.length === 0 && Object.keys(valuation.coefficients).length > 0) {
      lines.push({
        id: 'no_adjustment',
        text: 'نسبت به آگهی‌های مشابه، ویژگی‌ای که ارزش را کم یا زیاد کند در این خودرو پیدا نکردیم.',
      });
    }
  }

  // How accurate the model is for this car's model; or why there is no rating.
  if (valuation.dealRating !== null && segment !== null && segment.errorPct !== null) {
    const error = Math.max(1, Math.round(segment.errorPct));
    lines.push({
      id: 'accuracy',
      text: `برآورد ما برای ${modelName} معمولاً حدود ${figure('segment_error', error, formatPercent(error / 100), 'max(1, round(valuation_segment.error_pct))')} با قیمت آگهی‌ها فرق دارد.`,
    });
  }
  if (valuation.noRatingReason !== null) {
    lines.push({ id: 'reason', text: reasonText(valuation.noRatingReason, listing) });
  }

  // How the values are made, in general and in the buyer's terms: no window, no norm, no method number.
  const method = [
    'هر روز، از آگهی‌های همین مدل، ارزش بازار هر خودرو را حساب می‌کنیم. سال ساخت، کارکرد، بدنه، شاسی، گیربکس، سوخت و رنگ هر خودرو در آن اثر دارند.',
    'آگهی‌های توافقی، قسطی، تصادفی و تمام‌رنگ در این حساب نمی‌آیند.',
    'ارزیابی راهنماست و بازدید و کارشناسی خودرو را جایگزین نمی‌کند.',
  ];

  return { verdict, lines, method, figures, names: [modelName] };
}
