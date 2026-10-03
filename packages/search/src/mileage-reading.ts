import { formatCount, formatMileage, formatPercent } from '@carshenas/locale/format-number';

// How a mileage under the floor is read, and what a buyer is told about it (CS-101, ADR-0040). The thresholds are here
// because both sides use them: the worker's valuation run decides with them, and the info control quotes them, so the
// words can never say a number the rule does not use. A mileage is read in three ways: really that low (the listing's
// text says so), in thousands (the text says so, or the asking price fits the car at 1,000 times the figure), or not
// at all. The note exists for the middle reading only; it is the one a buyer could be misled by.

/**
 * How far the asking price may sit above a car's market value at 1,000 times the written figure for the figure to be
 * read in thousands, and how much higher the value at the figure as written must be: the 15 % a model's leave-one-out
 * error may be for it to rate listings at all (S01), because a difference below the model's error cannot tell two
 * readings apart.
 */
export const THOUSANDS_PRICE_BAND = 0.15;

/**
 * The most a car is believed to drive in a year when its mileage is assumed to count thousands. 40,000 km is above the
 * 99th percentile (37,000 km a year) of the 3,852 stated mileages of cars three or more model years old, 2026-10-03.
 */
export const MOST_ASSUMED_KM_PER_YEAR = 40_000;

export type MileageReadingKind = 'really_low' | 'thousands_text' | 'thousands_price' | 'unread';

export type MileageReadingInput = {
  readonly reading: MileageReadingKind | null;
  /** What the seller wrote; set whenever `reading` is. */
  readonly writtenKm: number | null;
  /** The mileage everything reads: the assumed one for a reading in thousands. */
  readonly mileageKm: number | null;
};

export type MileageNote = {
  /** One sentence for the line under the mileage on the listing page. */
  readonly line: string;
  /** The figure written, for a card: «۱۰۰ کیلومتر نوشته شده». */
  readonly short: string;
  /** The info control's content: its title and paragraphs. */
  readonly info: { readonly title: string; readonly paragraphs: readonly string[] };
};

const INFO_TITLE = 'کارکرد نوشته‌شده و کارکرد تخمینی';

/** Whether a reading is the assumed one: a figure the seller wrote that we read as thousands of kilometres. */
export function isAssumedMileage(reading: MileageReadingKind | null): boolean {
  return reading === 'thousands_text' || reading === 'thousands_price';
}

/**
 * The note shown wherever an assumed mileage is: «۱۰۰ کیلومتر نوشته شده؛ با توجه به قیمت و سال، احتمالاً ۱۰۰٬۰۰۰
 * کیلومتر», with the rule behind it for the info control. Null for any other mileage.
 */
export function mileageNote({ reading, writtenKm, mileageKm }: MileageReadingInput): MileageNote | null {
  if (!isAssumedMileage(reading) || writtenKm === null || mileageKm === null) return null;
  const intro = `برخی فروشنده‌ها کارکرد را به هزار کیلومتر می‌نویسند: «${formatCount(writtenKm)}» یعنی ${formatMileage(writtenKm * 1000)}. برای خودرویی که چند سال از ساختش گذشته، چند صد کیلومتر باورپذیر نیست، مگر آگهی بگوید.`;
  const rest = 'ارزش بازار، رتبه و جست‌وجو با همین کارکرد تخمینی کار می‌کنند.';
  const short = `${formatMileage(writtenKm)} نوشته شده`;
  if (reading === 'thousands_text') {
    return {
      line: `${formatCount(writtenKm)} نوشته شده؛ متن آگهی آن را هزار کیلومتر می‌داند: ${formatMileage(mileageKm)}`,
      short,
      info: {
        title: INFO_TITLE,
        paragraphs: [
          intro,
          `متن این آگهی کارکرد را هزارتایی گفته (مثلاً ${formatCount(writtenKm)} هزار)؛ همان را می‌پذیریم.`,
          rest,
        ],
      },
    };
  }
  return {
    line: `${formatMileage(writtenKm)} نوشته شده؛ با توجه به قیمت و سال، احتمالاً ${formatMileage(mileageKm)}`,
    short,
    info: {
      title: INFO_TITLE,
      paragraphs: [
        intro,
        `آگهی نمی‌گوید خودرو صفر است، پس قیمت را با ارزش بازار سنجیدیم: اگر قیمت حداکثر ${formatPercent(THOUSANDS_PRICE_BAND)} بالاتر از ارزش خودرو با کارکرد هزارتایی باشد و ارزش با کارکرد نوشته‌شده دست‌کم ${formatPercent(THOUSANDS_PRICE_BAND)} بیشتر باشد، هزارتایی می‌خوانیم؛ بیش از ${formatMileage(MOST_ASSUMED_KM_PER_YEAR)} در سال را هم نمی‌پذیریم.`,
        rest,
      ],
    },
  };
}

/** The sentence for a really-low reading on the listing page: the text says the figure is real. */
export function reallyLowNote({ reading, writtenKm }: MileageReadingInput): string | null {
  return reading === 'really_low' && writtenKm !== null
    ? `طبق متن آگهی، کارکرد واقعاً ${formatMileage(writtenKm)} است.`
    : null;
}
