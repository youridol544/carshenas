import { toPersianDigits } from '@carshenas/locale/digits';
import { formatDate } from '@carshenas/locale/format-date';
import { formatCount, formatMileage, formatPercent } from '@carshenas/locale/format-number';
import { formatTomanEstimate, toToman } from '@carshenas/locale/toman';
import {
  INSTALLMENT_GUARD_GAP_PCT,
  MAX_SEGMENT_ERROR_PCT,
  MIN_ADJUSTMENT_PCT,
  MIN_COMPARABLES,
  MIN_NEAR_YEAR_COMPARABLES,
  NEAR_YEARS,
  OUTLIER_FACTOR,
} from '@/features/listing/listing-rules';
import type {
  AdjustmentTerm,
  Comparable,
  ListingFacts,
  NoRatingReason,
  ValuationFacts,
} from '@/features/listing/listing-types';
import { gapSentence } from '@/features/search/listing-card-view';
import { nameOnScreen } from '@/features/search/search-labels';

// «چرا این ارزیابی؟» (CS-64): the explanation of a rating, written by code from the stored facts through templates, with
// no language model. Every number a buyer reads in it is a stored number (the market value, its date, the price gap, the
// comparables' count, years and mileage, the model's error, the run's window and mileage norm) or arithmetic on stored
// numbers that is written down here (an adjustment's size is exp(coefficient × the car's value) − 1, from
// valuation_coefficient, the way valuation_rate_listing() applies it), so no number can be invented, and the rule that a
// number a buyer sees never comes from model text holds by construction. It also answers the field survey's request for a
// faithfulness rate: each number is written through `figure`, which records it with its source, so a test can check
// every figure against the database and every digit in the text against the figures (listing-explanation.test.ts and
// listing-explanation.db.test.ts, the labelled sample).

const NO_BREAK_SPACE = '\u00A0';

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
  body_painted_around: 'دورِ رنگ بودن',
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

/** The sentence for a listing without a rating: what was missing, in the rule's own numbers. */
function reasonText(
  reason: NoRatingReason,
  listing: ListingFacts,
  valuation: ValuationFacts | null,
  figure: (id: string, values: number | readonly number[], text: string, source: string) => string,
): string {
  const segment = valuation?.segment ?? null;
  switch (reason) {
    case 'unmatched_model':
      return 'این خودرو را با مدل‌های فهرست کارشناس تطبیق نداده‌ایم، پس برایش ارزش بازار حساب نمی‌شود.';
    case 'missing_attributes':
      return 'سال ساخت، کارکرد یا نوع گیربکس در آگهی نیست یا معتبر نیست؛ بدون آن‌ها ارزش بازار حساب نمی‌شود.';
    case 'excluded_condition':
      return 'وضعیتی که فروشنده اعلام کرده (تصادفی، تمام‌رنگ، تعویض یا نیاز به تعمیر موتور و گیربکس، یا شاسی ضربه‌خورده) با آگهی‌های هم‌ردیف قابل مقایسه نیست، پس قیمتش را نمی‌سنجیم.';
    case 'too_few_comparables': {
      const needed = figure(
        'min_comparables',
        MIN_COMPARABLES,
        formatCount(MIN_COMPARABLES),
        'rule: S01 enough comparables 1',
      );
      return segment === null
        ? `برای این مدل آگهی مشابه کافی نداریم؛ دست‌کم ${needed} آگهی لازم است.`
        : `برای این مدل فقط ${figure('segment_count', segment.comparableCount, formatCount(segment.comparableCount), 'valuation_segment.comparable_count')} آگهی مشابه داریم؛ دست‌کم ${needed} آگهی لازم است.`;
    }
    case 'uncertain_segment': {
      const limit = figure(
        'max_segment_error',
        MAX_SEGMENT_ERROR_PCT,
        formatPercent(MAX_SEGMENT_ERROR_PCT / 100),
        'rule: S01 enough comparables 3',
      );
      const errorPct = segment?.errorPct ?? null;
      if (errorPct === null) {
        return `برآورد ما برای این مدل هنوز به اندازه‌ی کافی دقیق نیست (خطای مجاز تا ${limit}).`;
      }
      const error = Math.max(1, Math.round(errorPct));
      return `برآورد ما برای این مدل معمولاً حدود ${figure('segment_error', error, formatPercent(error / 100), 'max(1, round(valuation_segment.error_pct))')} خطا دارد و این بیشتر از ${limit} است؛ برای همین قیمت‌ها را برای این مدل ارزیابی نمی‌کنیم.`;
    }
    case 'year_out_of_range':
      return `آگهی مشابه کافی با سال ساخت یا کارکردی نزدیک به این خودرو نداریم (دست‌کم ${figure('min_near_year', MIN_NEAR_YEAR_COMPARABLES, formatCount(MIN_NEAR_YEAR_COMPARABLES), 'rule: S01 enough comparables 2')} آگهی با فاصله‌ی حداکثر ${figure('near_years', NEAR_YEARS, formatCount(NEAR_YEARS), 'rule: S01 enough comparables 2')} سال لازم است).`;
    case 'unknown_price':
      return 'قیمت این آگهی هنوز خوانده نشده است.';
    case 'no_asking_price':
      return 'قیمت این آگهی توافقی است؛ ارزش بازار را می‌گوییم، اما قیمتی برای سنجیدن نیست.';
    case 'placeholder_price':
      return 'قیمت نوشته‌شده در آگهی قیمت واقعی خودرو نیست؛ نمایشی است.';
    case 'installment_price':
      return listing.priceType === 'installment'
        ? 'قیمت این آگهی پیش‌پرداخت یک فروش قسطی است، نه قیمت خودرو؛ آن را با ارزش بازار نمی‌سنجیم.'
        : `این آگهی فروش قسطی هم دارد و قیمتش ${figure('installment_guard', INSTALLMENT_GUARD_GAP_PCT, formatPercent(INSTALLMENT_GUARD_GAP_PCT / 100), 'rule: CS-87')} یا بیشتر زیر ارزش بازار است؛ چنین قیمتی اغلب پیش‌پرداخت یا قسط اول است، پس آن را ارزیابی نمی‌کنیم.`;
    case 'dealer_new_car':
      return 'نمایشگاه‌ها قیمت خودروی صفر را اغلب به‌صورت پیش‌فروش، پیش‌پرداخت یا «از ...» می‌نویسند؛ برای همین آن را ارزیابی نمی‌کنیم.';
    case 'price_outlier':
      return `قیمت آگهی بیش از ${figure('outlier_factor', OUTLIER_FACTOR, formatCount(OUTLIER_FACTOR), 'rule: S01 price_outlier')} برابر با ارزش بازار فاصله دارد؛ شاید اشتباه تایپی یا قیمت طعمه باشد، پس آن را ارزیابی نمی‌کنیم.`;
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
  const method: string[] = [];
  const modelName = nameOnScreen(listing.model?.name ?? listing.name);

  if (valuation === null) {
    return {
      verdict: 'برای این آگهی هنوز ارزش بازاری حساب نشده است.',
      lines: [
        {
          id: 'not_valued',
          text: 'ارزش بازار هر روز برای آگهی‌های خوانده‌شده حساب می‌شود؛ این آگهی هنوز در آن نیست.',
        },
      ],
      method: [],
      figures,
      names: [],
    };
  }

  const { run, segment } = valuation;
  const value = figure(
    'market_value',
    valuation.marketValueToman,
    formatTomanEstimate(toToman(valuation.marketValueToman)),
    'listing_valuation.market_value_toman, to three significant digits',
  );
  const date = figure(
    'run_date',
    Date.parse(run.asOfDate),
    formatDate(run.asOfDate),
    'valuation_run.as_of_date',
  );

  // The verdict.
  let verdict: string;
  if (valuation.dealRating !== null && valuation.priceGapPct !== null) {
    const gap = gapSentence(valuation.priceGapPct);
    figure('gap', valuation.priceGapPct, gap, 'listing_valuation.price_gap_pct, rounded to whole percent');
    verdict = `قیمت این آگهی ${gap} است.`;
  } else {
    verdict = 'ارزش بازار این خودرو را برآورد کرده‌ایم، اما قیمت این آگهی را ارزیابی نمی‌کنیم.';
  }

  lines.push({
    id: 'value',
    text: `ارزش بازار این خودرو ${value} است؛ آن را در ${date} از آگهی‌های مشابه ${modelName} حساب کرده‌ایم.`,
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
    let basis = `این برآورد بر پایه‌ی ${count} آگهی مشابه با مدل ${years} است.`;
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
      basis += ` نزدیک‌ترین ${near} آگهی (مدل ${nearYears}، کارکرد ${nearKm}) را پایین همین صفحه می‌بینید.`;
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
          text: `مدل ${year}: ${modelName} با هر سال کهنه‌تر شدن حدود ${size} ${perYear < 0 ? 'از ارزشش را از دست می‌دهد' : 'ارزشمندتر می‌شود'}.`,
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
        const norm = figure(
          'mileage_norm',
          run.mileageNormKmPerYear,
          formatMileage(run.mileageNormKmPerYear),
          'valuation_run.mileage_norm_km_per_year',
        );
        adjustments.push({
          id: term,
          direction: pct < 0 ? 'down' : 'up',
          size: Math.abs(pct),
          text: `کارکرد ${km} است، ${away} ${above > 0 ? 'بیشتر' : 'کمتر'} از کارکرد معمول (${norm} در سال)؛ ${effect}.`,
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
      text: `برآورد ما برای ${modelName} معمولاً حدود ${figure('segment_error', error, formatPercent(error / 100), 'max(1, round(valuation_segment.error_pct))')} با قیمت واقعی فاصله دارد (میانه‌ی خطا روی آگهی‌های همین مدل).`,
    });
  }
  if (valuation.noRatingReason !== null) {
    lines.push({
      id: 'reason',
      text: reasonText(valuation.noRatingReason, listing, valuation, figure),
    });
  }

  // How the values are made, in general: the run's own numbers.
  const windowDays = figure(
    'window_days',
    run.windowDays,
    formatCount(run.windowDays),
    'valuation_run.window_days',
  );
  const norm = figure(
    'method_norm',
    run.mileageNormKmPerYear,
    formatMileage(run.mileageNormKmPerYear),
    'valuation_run.mileage_norm_km_per_year',
  );
  const version = figure(
    'method_version',
    run.methodVersion,
    formatCount(run.methodVersion),
    'valuation_run.method_version',
  );
  method.push(
    `هر روز، از آگهی‌های ${modelName} که در ${windowDays}${NO_BREAK_SPACE}روز گذشته روی بازار بوده‌اند، قیمت هر خودرو را بر پایه‌ی سال ساخت، کارکرد (در برابر ${norm} در سال)، وضعیت بدنه و شاسی، گیربکس، سوخت و رنگ برآورد می‌کنیم (روش شماره‌ی ${version}).`,
    'آگهی‌های توافقی، قسطی و آگهی‌های تصادفی، تمام‌رنگ یا نیازمند تعمیر در این حساب نمی‌آیند، و قیمت‌های بسیار دور از بقیه کنار گذاشته می‌شوند.',
    'ارزیابی راهنماست، نه تضمین قیمت: بازدید و کارشناسی خودرو را جایگزین نمی‌کند.',
  );

  return { verdict, lines, method, figures, names: [modelName] };
}
