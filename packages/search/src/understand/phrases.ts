// The phrases code reads without a model (CS-62, docs/specs/S04-plain-farsi-search.md): the words buyers write for a
// filter's value, for a documented bundle (intents.ts), for an order, for Tehran and for the places and wishes the
// index cannot serve. Each is exact and unambiguous; a word that could mean two things («تمیز», «سالم», «جدید»,
// «مناسب») is not here, so it reaches the model, which reads it with the rest of the sentence. The filters' own words
// (CS-58, `words` in filters.ts) are the model's vocabulary, not this table: they include «تمیز» for three filters.
// Phrases are written with spaces; a half-space, a space, Arabic letters and digit scripts all fold to the same
// words (text.ts), so «کم‌کار» and «کم کار» are one entry. A test checks that every value is valid for its filter.
import type { FilterId } from '../filters.ts';
import type { SortId } from '../sorts.ts';
import type { FilterValue } from './claims.ts';
import type { IntentId } from './intents.ts';
import { ZERO_KM_MAX } from './quantities.ts';
import { normalisePhrase } from './text.ts';
import type { Basis } from './types.ts';

export type PhraseEffect =
  /** One or more filter values; `inferred` when the words imply the filter rather than name its value. */
  | { readonly kind: 'filters'; readonly filters: readonly FilterValue[]; readonly basis: Basis }
  | { readonly kind: 'intent'; readonly intent: IntentId }
  | { readonly kind: 'sort'; readonly sort: SortId }
  /** Tehran (the whole index) or a city the index does not cover. */
  | { readonly kind: 'scope'; readonly scope: 'default_scope' | 'outside_market' }
  /** A wish the data cannot serve, with the topic in Farsi. */
  | { readonly kind: 'unsupported'; readonly topic: string };

export type Phrase = {
  /** Folded words, single-spaced. */
  readonly phrase: string;
  readonly effect: PhraseEffect;
  /** Read by code only when the whole query is nothing but soft phrases and filler («ماشین تمیز»). */
  readonly soft: boolean;
};

type Spec = readonly [phrases: readonly string[], effect: PhraseEffect, soft?: true];

const stated = (filterId: FilterId, value: unknown): PhraseEffect => ({
  kind: 'filters',
  filters: [{ filterId, value }],
  basis: 'stated',
});
const inferred = (filterId: FilterId, value: unknown): PhraseEffect => ({
  kind: 'filters',
  filters: [{ filterId, value }],
  basis: 'inferred',
});
const intent = (id: IntentId): PhraseEffect => ({ kind: 'intent', intent: id });
const sort = (id: SortId): PhraseEffect => ({ kind: 'sort', sort: id });
const unsupported = (topic: string): PhraseEffect => ({ kind: 'unsupported', topic });

const BOTH_DUAL_FUELS = ['dual_fuel_aftermarket', 'dual_fuel_factory'];

// «بدون رنگ و تصادف»: one «بدون» that covers several conditions, in every order.
const CONDITIONS = [
  ['رنگ', 'paint_free'],
  ['تصادف', 'no_accident'],
  ['تعویض', 'no_replaced_parts'],
] as const;

function withoutSeveral(): Spec[] {
  const specs: Spec[] = [];
  const effectOf = (items: readonly (typeof CONDITIONS)[number][]): PhraseEffect => ({
    kind: 'filters',
    filters: items.map(([, filterId]) => ({ filterId, value: true })),
    basis: 'stated',
  });
  for (const first of CONDITIONS) {
    for (const second of CONDITIONS) {
      if (first === second) continue;
      specs.push([[`بدون ${first[0]} و ${second[0]}`], effectOf([first, second])]);
      for (const third of CONDITIONS) {
        if (third === first || third === second) continue;
        specs.push([[`بدون ${first[0]} و ${second[0]} و ${third[0]}`], effectOf([first, second, third])]);
      }
    }
  }
  return specs;
}

// Cities the index does not cover: its market is Tehran's (ADR-0017). A city that has listings is a filter value
// from the database (lexicon.ts); the names here only keep the others from being silently dropped.
const OTHER_CITIES = [
  'مشهد',
  'اصفهان',
  'شیراز',
  'تبریز',
  'اهواز',
  'رشت',
  'کرمان',
  'ارومیه',
  'یزد',
  'همدان',
  'اراک',
  'بوشهر',
  'زاهدان',
  'سنندج',
  'کرمانشاه',
  'ساری',
  'گرگان',
  'قزوین',
  'زنجان',
  'خرم آباد',
  'سمنان',
  'بجنورد',
  'بیرجند',
  'ایلام',
  'یاسوج',
  'شهرکرد',
  'کیش',
  'قشم',
  'بابل',
  'آمل',
  'سبزوار',
  'نیشابور',
  'دزفول',
  'آبادان',
  'خرمشهر',
  'ملایر',
  'مراغه',
  'خوی',
  'میانه',
  'سلماس',
  'بروجرد',
  'ورامین',
  'نجف آباد',
  'کاشمر',
  'بم',
  'رفسنجان',
  'جیرفت',
  'ایرانشهر',
  'چابهار',
];

const SPECS: readonly Spec[] = [
  // Condition.
  [
    [
      'بدون رنگ',
      'بی رنگ',
      'بیرنگ',
      'بدون رنگ شدگی',
      'بدون رنگ شده',
      'بدون لکه رنگ',
      'رنگ نشده',
      'رنگ نخورده',
      'بدنه فابریک',
      'بدنه بدون رنگ',
    ],
    stated('paint_free', true),
  ],
  [
    [
      'بدون تصادف',
      'بی تصادف',
      'بیتصادف',
      'تصادف نداشته',
      'تصادف نداره',
      'تصادف نداشته باشه',
      'تصادفی نباشه',
      'تصادفی نباشد',
      'تصادف نکرده',
      'تصادف نکرده باشه',
      'بدون سابقه تصادف',
      'سابقه تصادف نداشته باشه',
      'بدون ضربه',
    ],
    stated('no_accident', true),
  ],
  [
    ['بدون تعویض', 'بی تعویض', 'فاقد تعویض', 'بدون تعویضی', 'تعویض نداشته باشه', 'تعویضی نداشته باشه'],
    stated('no_replaced_parts', true),
  ],
  ...withoutSeveral(),
  [['شاسی سالم', 'شاسی پلمپ', 'شاسی ها سالم', 'شاسی ها پلمپ'], stated('chassis', ['intact'])],
  [['موتور سالم'], stated('engine_condition', ['sound'])],
  [['گیربکس سالم'], stated('gearbox_condition', ['sound'])],
  [
    [
      'اسنپ کار نکرده',
      'کار اسنپ نکرده',
      'در اسنپ کار نکرده',
      'اسنپ نکرده',
      'اسنپ نبوده',
      'اسنپ نباشه',
      'تپسی کار نکرده',
      'تاکسی اینترنتی نبوده',
      'تاکسی نبوده',
    ],
    stated('not_ride_hailing', true),
  ],

  // Gearbox, fuel, body type.
  [
    ['اتوماتیک', 'اتومات', 'دنده اتوماتیک', 'دنده اتومات', 'گیربکس اتوماتیک', 'گیربکس اتومات'],
    stated('gearbox', ['automatic']),
  ],
  [
    ['دنده ای', 'دندهای', 'دستی', 'دنده دستی', 'گیربکس دستی', 'گیربکس دنده ای'],
    stated('gearbox', ['manual']),
  ],
  [['بنزینی'], stated('fuel', ['petrol'])],
  [
    ['دوگانه سوز', 'دوگانهسوز', 'دوگانه', 'گازسوز', 'گاز سوز', 'سی ان جی', 'cng'],
    stated('fuel', BOTH_DUAL_FUELS),
  ],
  [
    ['دوگانه سوز شرکتی', 'دوگانه شرکتی', 'گازسوز شرکتی', 'دوگانه سوز کارخانه ای', 'دوگانه کارخانه ای'],
    stated('fuel', ['dual_fuel_factory']),
  ],
  [
    ['دوگانه سوز دستی', 'دوگانه دستی', 'گازسوز دستی', 'دوگانه سوز غیر کارخانه ای'],
    stated('fuel', ['dual_fuel_aftermarket']),
  ],
  [['هیبرید', 'هایبرید'], stated('fuel', ['hybrid', 'plug_in_hybrid'])],
  [
    ['پلاگین', 'پلاگین هیبرید', 'هیبرید پلاگین', 'هیبرید شارژی', 'هایبرید شارژی'],
    stated('fuel', ['plug_in_hybrid']),
  ],
  [['برقی', 'الکتریکی'], stated('fuel', ['electric'])],
  [['دیزل', 'دیزلی'], stated('fuel', ['diesel'])],
  [['سدان'], stated('body_type', ['sedan'])],
  [['هاچ بک', 'هاچبک', 'هچ بک'], stated('body_type', ['hatchback'])],
  [['شاسی بلند', 'شاسیبلند', 'اس یو وی', 'suv'], stated('body_type', ['suv'])],
  [['کراس اوور', 'کراساور', 'کراس'], stated('body_type', ['crossover'])],
  [['وانت'], stated('body_type', ['pickup'])],
  [['ون'], stated('body_type', ['van'])],
  [['مینی ون', 'مینیون'], stated('body_type', ['minivan'])],
  [['کوپه', 'کوپ'], stated('body_type', ['coupe'])],
  [['کروک', 'کابریولت', 'روباز'], stated('body_type', ['convertible'])],
  [['استیشن', 'استیشن واگن', 'واگن'], stated('body_type', ['wagon'])],

  // Mileage and the popular models. «صفر» is a new car: at most the kilometres the data holds for them.
  [['صفر', 'صفر کیلومتر', 'صفرکیلومتر', 'کارکرد صفر'], stated('mileage', { max: ZERO_KM_MAX })],
  [
    [
      'کم کار',
      'کمکار',
      'کم کارکرد',
      'کمکارکرد',
      'کارکرد کم',
      'کارکرد کمی',
      'کارکرد خیلی کم',
      'کارکرد پایین',
      'کیلومتر کم',
      'کیلومتر پایین',
      'کم کیلومتر',
      'کمکیلومتر',
    ],
    stated('low_mileage_for_age', true),
  ],
  [
    [
      'بی دردسر',
      'بیدردسر',
      'بی دردسری',
      'بدون دردسر',
      'پرطرفدار',
      'پر طرفدار',
      'قطعه ارزان',
      'قطعات ارزان',
      'قطعه ارزون',
      'قطعات ارزون',
      'نگهداری راحت',
      'نگهداری آسان',
      'کم خرج',
      'کمخرج',
      'نقد شونده',
      'نقدشونده',
      'خوش فروش',
      'خوشفروش',
      'ماشین اول',
      'اولین ماشین',
      'ماشین اولم',
    ],
    inferred('popular_model', true),
  ],

  // Price and deal words.
  [
    ['معامله عالی', 'معامله ی عالی', 'معامله فوق العاده', 'فوق العاده ارزان', 'خیلی ارزان'],
    inferred('deal', 'great'),
  ],
  [
    [
      'معامله خوب',
      'معامله ی خوب',
      'قیمت خوب',
      'ارزان',
      'ارزون',
      'زیر قیمت',
      'زیر قیمت بازار',
      'خوش قیمت',
      'خوشقیمت',
      'به صرفه',
      'بصرفه',
      'مقرون به صرفه',
    ],
    inferred('deal', 'good'),
  ],
  [['قیمت منصفانه', 'منصفانه', 'قیمت معقول', 'قیمت مناسب', 'قیمت عادلانه'], inferred('deal', 'fair')],

  // Terms of sale.
  [
    [
      'قسطی',
      'اقساطی',
      'اقساط',
      'با چک',
      'چکی',
      'پیش پرداخت',
      'پیشپرداخت',
      'نقد و اقساط',
      'فروش اقساطی',
      'خرید اقساطی',
      'با اقساط',
    ],
    stated('installments', true),
  ],
  [['معاوضه', 'قابل معاوضه', 'معاوضه ای', 'با معاوضه', 'معاوضه میشه', 'معاوضه می شه'], stated('swap', true)],
  [['عکس دار', 'عکسدار', 'با عکس', 'دارای عکس'], stated('has_photo', true)],
  [
    ['از مالک', 'مالک', 'فروش شخصی', 'فروشنده شخصی', 'مستقیم از مالک', 'بدون واسطه'],
    stated('seller', ['private']),
  ],
  [['نمایشگاه', 'نمایشگاهی', 'از نمایشگاه'], stated('seller', ['dealer'])],
  [['بیمه دار', 'بیمه داشته باشه', 'بیمه داشته باشد', 'بیمه دارد'], stated('insurance', 1)],
  [['بیمه کامل'], stated('insurance', 12)],
  [['امروز'], stated('posted_within', 1)],
  [['این هفته', 'هفته اخیر', 'هفته گذشته', 'هفته ی اخیر', 'هفته ی گذشته'], stated('posted_within', 7)],
  [['این ماه', 'ماه اخیر', 'ماه گذشته', 'ماه ی اخیر', 'ماه ی گذشته'], stated('posted_within', 30)],

  // Orders.
  [['ارزان ترین', 'ارزانترین', 'ارزون ترین', 'ارزونترین'], sort('price_asc')],
  [['گران ترین', 'گرانترین'], sort('price_desc')],
  [
    ['کم کارکرد ترین', 'کم کارکردترین', 'کمکارکردترین', 'کمترین کارکرد', 'کمترین کیلومتر', 'کم کیلومتر ترین'],
    sort('mileage_asc'),
  ],
  [['جدید ترین آگهی', 'جدیدترین آگهی', 'تازه ترین آگهی'], sort('newest')],
  [['جدید ترین مدل', 'جدیدترین مدل', 'مدل بالا'], sort('year_desc')],
  [['بهترین معامله', 'بهترین معامله ها'], sort('best_deal')],

  // Bundles (intents.ts): firm phrases.
  [
    ['تمیز و بی دردسر', 'تمیز و بیدردسر', 'تمیز بی دردسر', 'بی عیب و نقص', 'بیعیب و نقص', 'بی عیب نقص'],
    intent('clean-and-easy'),
  ],
  [
    [
      'از نظر فنی سالم',
      'از نظر فنی خوب',
      'از لحاظ فنی سالم',
      'از لحاظ فنی خوب',
      'فنی سالم',
      'سالم از نظر فنی',
      'سالم از لحاظ فنی',
      'مشکل فنی نداشته باشه',
      'مشکل فنی نداره',
      'بدون مشکل فنی',
      'بی مشکل فنی',
      'از نظر فنی بدون مشکل',
      'از نظر فنی مشکلی نداشته باشه',
      'از نظر فنی مشکل نداشته باشه',
      // No repair bill to come, said the way buyers say it («خرج» is what a car costs after it is bought).
      'خرج نداشته باشه',
      'خرج نداشته باشد',
      'خرجی نداشته باشه',
      'خرجی نداشته باشد',
      'خرج نداره',
      'خرجی نداره',
      'خرج نداشتن',
      'بی خرج',
      'بدون خرج',
      'خرج روش نباشه',
    ],
    intent('technically-sound'),
  ],
  [
    [
      'پیشنهاد کارشناس',
      'پیشنهاد کارشناسی',
      'پیشنهاد کارشناس شما',
      'بهترین ها',
      'بهترین پیشنهاد',
      'بهترین ماشین',
      'بهترین خودرو',
      'چی بخرم',
      'چه ماشینی بخرم',
      'پیشنهاد بده',
    ],
    intent('karshenas-pick'),
  ],
  [
    [
      'خانوادگی',
      'برای خانواده',
      'مناسب خانواده',
      'خانواده',
      'جادار',
      'سفر خانوادگی',
      'برای سفر',
      'مناسب سفر',
      'سفری',
    ],
    intent('family'),
  ],
  [
    [
      'مناسب اسنپ',
      'برای اسنپ',
      'اسنپ',
      'اسنپی',
      'تپسی',
      'برای تپسی',
      'مناسب تپسی',
      'تاکسی اینترنتی',
      'برای تاکسی اینترنتی',
      'مناسب تاکسی اینترنتی',
      'مسافرکشی',
      'مناسب مسافرکشی',
      'برای مسافرکشی',
      'کار در اسنپ',
      'برای کار در اسنپ',
      'مناسب کار در اسنپ',
    ],
    intent('ride-hailing'),
  ],
  [
    [
      'تازه ترین آگهی ها',
      'آگهی امروز',
      'آگهی های امروز',
      'آگهی تازه',
      'آگهی های تازه',
      'آگهی جدید',
      'آگهی های جدید',
      'تازه ها',
    ],
    intent('newest'),
  ],
  // Soft phrases: read by code only when nothing else is left of the query.
  [['تمیز', 'ماشین تمیز', 'خودرو تمیز'], intent('clean-body'), true],

  // Places.
  [['تهران', 'tehran'], { kind: 'scope', scope: 'default_scope' }],
  [OTHER_CITIES, { kind: 'scope', scope: 'outside_market' }],

  // Wishes the data cannot serve.
  [['کم مصرف', 'کم مصرف ترین', 'مصرف کم', 'مصرف سوخت', 'مصرف سوخت کم', 'پر مصرف'], unsupported('مصرف سوخت')],
  [['سقف شیشه ای', 'سانروف', 'سان روف'], unsupported('سقف شیشه‌ای')],
  [['تودوزی', 'چرم', 'صندلی چرم', 'تودوزی چرم'], unsupported('تودوزی')],
  [['ایرباگ', 'ایمنی'], unsupported('ایمنی')],
  [['لوکس', 'شیک', 'اسپرت', 'قدرتمند', 'پرقدرت', 'سریع'], unsupported('سبک و قدرت')],
  [
    ['دوربین عقب', 'دوربین', 'سنسور', 'کروز', 'امکانات', 'فول آپشن', 'فول', 'آپشن'],
    unsupported('امکانات رفاهی'),
  ],
  [['سند', 'تک برگ', 'قولنامه'], unsupported('سند و مالکیت')],
  [['دست اول', 'اولین مالک', 'دست دوم'], unsupported('تعداد مالکان')],
  [['گارانتی', 'ضمانت'], unsupported('گارانتی')],
];

export type PhraseIndex = {
  /** By first folded word; each list longest phrase first. */
  readonly byFirst: ReadonlyMap<string, readonly Phrase[]>;
  readonly maxWords: number;
};

/** Phrases indexed for longest-first matching; when a phrase is listed twice, the first one wins. */
export function indexPhrases(phrases: readonly Phrase[]): PhraseIndex {
  const seen = new Map<string, Phrase>();
  for (const phrase of phrases) if (!seen.has(phrase.phrase)) seen.set(phrase.phrase, phrase);
  const byFirst = new Map<string, Phrase[]>();
  let maxWords = 1;
  for (const phrase of seen.values()) {
    const words = phrase.phrase.split(' ');
    maxWords = Math.max(maxWords, words.length);
    const first = words[0] ?? '';
    byFirst.set(first, [...(byFirst.get(first) ?? []), phrase]);
  }
  for (const list of byFirst.values()) {
    list.sort((a, b) => b.phrase.split(' ').length - a.phrase.split(' ').length);
  }
  return { byFirst, maxWords };
}

/** The table's phrases, each folded the way the buyer's words are. */
export const PHRASES: readonly Phrase[] = SPECS.flatMap(([phrases, effect, soft]) =>
  phrases.map((phrase) => ({ phrase: normalisePhrase(phrase), effect, soft: soft === true })),
);

/** Every phrase a test needs to find twice with different meanings. */
export function conflictingPhrases(phrases: readonly Phrase[]): string[] {
  const first = new Map<string, string>();
  const conflicts: string[] = [];
  for (const { phrase, effect } of phrases) {
    const text = JSON.stringify(effect);
    const before = first.get(phrase);
    if (before === undefined) first.set(phrase, text);
    else if (before !== text) conflicts.push(phrase);
  }
  return conflicts;
}
