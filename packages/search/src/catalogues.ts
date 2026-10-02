// The premade searches the home page, the search page and search files share (CS-58 criterion 2; the owner's product
// plan of 2026-09-29). A catalogue is nothing more than filter values, an order and words: a Farsi title and
// description for the buyer, and the reason it exists for whoever changes it. «پیشنهاد کارشناس» comes first; the
// others answer what Iranian buyers ask for most (docs/specs/S02-filters-and-catalogues.md). Filter values are
// relative where time matters («حداکثر ۱۰ سال عمر»), so a catalogue never goes stale at Nowruz.
import { formatCountOf } from '@carshenas/locale/format-number';
import { formatTomanCompact, toToman } from '@carshenas/locale/toman';
import { postedWithin } from './filters.ts';
import type { SearchFilters } from './search.ts';
import type { SortId } from './sorts.ts';

export type Catalogue<Id extends string = string> = {
  readonly id: Id;
  /** The row's title on the home page and the chip on the search page. */
  readonly title: string;
  /** One Farsi sentence under the title: what the buyer gets. */
  readonly description: string;
  /** Why the catalogue exists, for the people who maintain it (English, like the rest of the code). */
  readonly reason: string;
  /** Words and phrases buyers write when they mean it, for plain-Farsi search (CS-62) to open it. */
  readonly words: readonly string[];
  readonly filters: SearchFilters;
  readonly sort: SortId;
};

// The numbers catalogues are built on; titles and descriptions print them through the locale's formatters, and the
// info control lists each filter's own rule (explain.ts), so no number is written twice.
/** The budget of «معامله‌های عالی زیر ۱ میلیارد», in tomans. */
export const GREAT_DEALS_PRICE_MAX_TOMAN = 1_000_000_000;
/** The oldest car, in years, «خانوادگی» and «مناسب کار در تاکسی اینترنتی» offer. */
export const FAMILY_MAX_AGE_YEARS = 10;
export const RIDE_HAILING_MAX_AGE_YEARS = 10;
/** «تازه‌ترین آگهی‌ها»: posted within this many days (one: the last 24 hours). */
export const NEWEST_WITHIN_DAYS = 1;

const budget = formatTomanCompact(toToman(GREAT_DEALS_PRICE_MAX_TOMAN));

function catalogue<const Id extends string>(definition: Catalogue<Id>): Catalogue<Id> {
  return definition;
}

/** Sound engine, sound gearbox and an intact chassis, as sellers declare them: "technically sound". */
export const TECHNICALLY_SOUND: SearchFilters = {
  engine_condition: ['sound'],
  gearbox_condition: ['sound'],
  chassis: ['intact'],
};

/** No paint, no accident and no replaced body part stated anywhere: "clean". */
export const CLEAN_BODY: SearchFilters = {
  paint_free: true,
  no_accident: true,
  no_replaced_parts: true,
};

export const CATALOGUES = [
  catalogue({
    id: 'karshenas-pick',
    title: 'پیشنهاد کارشناس',
    description: 'معامله‌های خوب و عالی با بدنه‌ی بدون رنگ، بدون تصادف و موتور، گیربکس و شاسی سالم.',
    reason:
      "The product's headline (owner, 2026-09-29): what an expert would shortlist, a price at or below market value on a car whose seller declares nothing that needs a mechanic. It is the first row everywhere.",
    words: ['پیشنهاد کارشناس', 'بهترین‌ها', 'پیشنهاد شما', 'چی بخرم'],
    filters: { deal: 'good', ...CLEAN_BODY, ...TECHNICALLY_SOUND },
    sort: 'best_deal',
  }),
  catalogue({
    id: 'great-deals-under-1b',
    title: `معامله‌های عالی زیر ${budget}`,
    description: `آگهی‌هایی که کارشناس «معامله‌ی عالی» ارزیابی کرده، با قیمت تا ${budget} تومان.`,
    reason:
      'One billion tomans is the budget line most first-car and family buyers in Tehran search under in 1405 (Pride, Peugeot 206 and 405, Samand, Tiba, Quick); a great rating there is the deal most of them are hunting for.',
    words: ['زیر یک میلیارد', 'زیر ۱ میلیارد', 'ارزان', 'معامله عالی'],
    filters: { deal: 'great', price: { max: GREAT_DEALS_PRICE_MAX_TOMAN } },
    sort: 'best_deal',
  }),
  catalogue({
    id: 'clean-and-easy',
    title: 'تمیز و بی‌دردسر',
    description:
      'بدون رنگ و تصادف، موتور و گیربکس و شاسی سالم، کم‌کارکرد نسبت به سن و از مدل‌های پرطرفدار که قطعه و تعمیرکارش همه‌جا هست.',
    reason:
      "The request buyers make without naming a model (the owner's example for CS-62: «یک ماشین تمیز کم کار و بیدردسر میخوام که همه چیش از نظر فنی خوب باشه»): clean, little driven for its age, technically sound, and a popular model that is cheap and easy to service and to resell.",
    words: ['تمیز', 'بی‌دردسر', 'بیدردسر', 'بی دردسر', 'کم کار', 'سالم', 'از نظر فنی خوب', 'بی‌عیب'],
    filters: { ...CLEAN_BODY, ...TECHNICALLY_SOUND, low_mileage_for_age: true, popular_model: true },
    sort: 'best_deal',
  }),
  catalogue({
    id: 'family',
    title: 'خانوادگی',
    description: `سدان، کراس‌اوور، شاسی‌بلند، مینی‌ون و استیشن با حداکثر ${formatCountOf(FAMILY_MAX_AGE_YEARS, 'سال')} عمر و موتور، گیربکس و شاسی سالم.`,
    reason:
      'Families are the largest group of used-car buyers in Iran: room for four or five and a boot, a car young enough to be safe and reliable on trips, and nothing mechanical to fix.',
    words: ['خانوادگی', 'خانواده', 'جادار', 'سفر', 'بچه'],
    filters: {
      body_type: ['sedan', 'crossover', 'suv', 'minivan', 'wagon'],
      age: FAMILY_MAX_AGE_YEARS,
      ...TECHNICALLY_SOUND,
    },
    sort: 'best_deal',
  }),
  catalogue({
    id: 'low-mileage',
    title: 'کم‌کارکرد',
    description: 'خودروهایی که نسبت به سنشان کمتر از معمول بازار کار کرده‌اند.',
    reason:
      "Mileage is the second price factor after paint; a car driven well under the market's 20,000 km a year (S01's norm) wears less and resells better. The median in Tehran was about 16,000 km a year on 2026-09-30.",
    words: ['کم‌کارکرد', 'کم کارکرد', 'کم کار', 'کارکرد پایین', 'کم‌کیلومتر'],
    filters: { low_mileage_for_age: true },
    sort: 'best_deal',
  }),
  catalogue({
    id: 'automatic',
    title: 'دنده‌اتوماتیک',
    description: 'خودروهای اتوماتیک با قیمت منصفانه یا بهتر، برای ترافیک شهر.',
    reason:
      "Tehran's traffic makes an automatic gearbox the most asked-for comfort, and automatics are a small share of the market (338 of 2,223 listings that stated a gearbox on 2026-09-30), so they are hard to find by scrolling.",
    words: ['اتوماتیک', 'اتومات', 'دنده اتومات', 'ترافیک'],
    filters: { gearbox: ['automatic'], deal: 'fair' },
    sort: 'best_deal',
  }),
  catalogue({
    id: 'ride-hailing',
    title: 'مناسب کار در تاکسی اینترنتی',
    description: `مدل‌های پرطرفدار با قطعه‌ی ارزان، حداکثر ${formatCountOf(RIDE_HAILING_MAX_AGE_YEARS, 'سال')} عمر و موتور و گیربکس سالم. شرایط هر سرویس را جداگانه ببینید.`,
    reason:
      "Many buyers buy to work for Snapp or Tapsi (CS-62's example «مناسب اسنپ»): they need a popular model whose parts are cheap, a car young enough for the services, and a sound drivetrain. The services' exact rules change, so the description sends the buyer to them.",
    words: ['مناسب اسنپ', 'اسنپ', 'تپسی', 'تاکسی اینترنتی', 'کار', 'مسافرکشی'],
    filters: {
      popular_model: true,
      age: RIDE_HAILING_MAX_AGE_YEARS,
      engine_condition: ['sound'],
      gearbox_condition: ['sound'],
    },
    sort: 'best_deal',
  }),
  catalogue({
    id: 'installments',
    title: 'فروش قسطی',
    description: 'آگهی‌هایی که خرید قسطی یا با چک دارند، یا قیمتشان پیش‌پرداخت است.',
    reason:
      'Instalment and cheque sales are a large part of the Iranian market when cash is short; they are hard to spot because the shown price is often only a down payment (CS-52).',
    words: ['قسطی', 'اقساطی', 'اقساط', 'با چک', 'پیش پرداخت'],
    filters: { installments: true },
    sort: 'best_deal',
  }),
  catalogue({
    id: 'newest',
    title: 'تازه‌ترین آگهی‌ها',
    description: `${postedWithin.chip(NEWEST_WITHIN_DAYS)}، تازه‌ترین اول.`,
    reason:
      'Good deals sell within days in Tehran; buyers who check every day want only what is new since yesterday.',
    words: ['جدید', 'تازه', 'امروز', 'تازه‌ها'],
    filters: { posted_within: NEWEST_WITHIN_DAYS },
    sort: 'newest',
  }),
] as const;

export type CatalogueId = (typeof CATALOGUES)[number]['id'];
export const CATALOGUE_IDS = CATALOGUES.map((entry) => entry.id) as [CatalogueId, ...CatalogueId[]];
