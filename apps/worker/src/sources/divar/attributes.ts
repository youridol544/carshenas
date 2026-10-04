import * as z from 'zod';
import type { JsonObject } from '@carshenas/db/db-types';
import { readWholeNumber, toLatinDigits } from '@carshenas/locale/digits';
import { readEngineVolume } from '@carshenas/locale/engine-volume';
import { jalaliYearOf } from '@carshenas/locale/jalali';
import { withPersianLetters, withoutBidiControls } from '@carshenas/locale/text';
import {
  UNKNOWN,
  UNPARSED,
  isImplausibleMileage,
  isPlausibleAsThousands,
  valueOf,
  yearStatedAlone,
  yearsStatedTogether,
  type BodyCondition,
  type ChassisCondition,
  type DerivedListing,
  type Fuel,
  type Gearbox,
  type MileageReading,
  type ModelYear,
  type PartCondition,
  type PhotoAddress,
  type Read,
  type SellerType,
  type UnparsedField,
  type UnparsedValue,
} from '../attributes.ts';
import { COLOURS } from '../../catalogue/codes.ts';
import { parseShownPrice, type ShownPrice } from '../price.ts';
import { DivarShapeError } from './answers.ts';
import { photoUrlsOf } from './post.ts';
import { divarListingText } from './text.ts';
import { readMileageWording } from '../mileage-wording.ts';

// What a Divar listing says about its car, read by code from its canonical snapshot (CS-34; post.ts builds the
// snapshot): the title, Divar's own make, model and trim value, the rows of «LIST_DATA» (labelled rows, the rows of its
// «سایر ویژگی‌ها و امکانات» modal and the seller's scores under «ارزیابی فروشنده»), the seller type, and the photos'
// addresses (ADR-0025). The words each row may hold come from Divar's own lists (its filters, read on 2026-09-19) and
// from 4,720 real car listings of 2026-09-17 and three posts of 2026-09-29; a value outside them is returned as
// unparsed with its raw text, never guessed. Rows this parser does not know are counted, so a row Divar renames shows up.
//
// The mileage is read as written, with one exception (CS-86, CS-101, ADR-0040). Sellers often type it in thousands of
// kilometres («۱۰۹» for 109,000 km), and a seller of a car that is not new never means a few kilometres unless the car
// was never driven. A figure under 1,000 km on a car whose model year is three or more Jalali years before the year the
// snapshot was fetched is read by the listing's own words (mileage-wording.ts): «صفر خشک» or «۴۴۰ کیلومتر» make it
// really that low and it is kept; «۶۰ هزار» or «۷۳۰۰۰» make it thousands and mileage_km is 1,000 times the figure;
// when the words settle nothing the mileage is unknown (the stated text is kept as an unparsed value with the reason
// `implausible`, which is in the derive report and not a column) and the valuation run may still read it in thousands
// when the asking price fits the car at 1,000 times the figure. The figure the seller wrote and the reading are stored
// on the listing either way. The year comes from the snapshot's own fetch date, never the clock, so the same snapshot
// always gives the same listing. A car of the fetch year or of the two before it keeps its few kilometres (a new car),
// and so does any car at 1,000 km or more.

/** Bump it when the same snapshot would give other attributes; `pnpm derive:listings` then rewrites every listing. */
export const DIVAR_PARSER_VERSION = 7;

const ZERO_WIDTH_NON_JOINER = String.fromCodePoint(0x200c);
const HAMZA_ABOVE = String.fromCodePoint(0x0654);

/**
 * Text as this parser compares it: direction marks dropped, Arabic letters and digits as Persian and Latin ones, the
 * zero-width non-joiner as a space («دنده‌ای» and «دنده ای» are one word) and the hamza above a heh dropped («بیمهٔ»).
 */
function wordsOf(text: string): string {
  return withPersianLetters(toLatinDigits(withoutBidiControls(text)))
    .replaceAll(ZERO_WIDTH_NON_JOINER, ' ')
    .replaceAll(HAMZA_ABOVE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookup<T>(words: ReadonlyMap<string, T>, text: string): Read<T> {
  const found = words.get(wordsOf(text));
  return found === undefined ? UNPARSED : valueOf(found);
}

/** Divar's colour words, as wordsOf writes them, to the catalogue's colour codes (CS-50). */
const COLOUR_WORDS: ReadonlyMap<string, string> = new Map(
  COLOURS.map((colour) => [wordsOf(colour.labelFa), colour.code]),
);

/** «نقره‌ای», «نقره ای»: a colour Divar names, as the catalogue's code; any other word is unparsed, never guessed. */
export function readColour(text: string): Read<string> {
  return lookup(COLOUR_WORDS, text);
}

// The rows, by the label Divar gives them, as wordsOf writes it.
const LABEL = {
  mileage: 'کارکرد',
  modelYear: 'مدل (سال تولید)',
  insurance: 'مهلت بیمه شخص ثالث',
  gearbox: 'گیربکس',
  fuel: 'نوع سوخت',
  price: 'قیمت پایه',
  installments: 'امکان خرید قسطی',
  swap: 'مایل به معاوضه',
  brandModel: 'برند و مدل',
  colour: 'رنگ',
} as const;
/**
 * Rows known and not read yet: ownership, the technical inspection and a delivery voucher are no attributes of ours
 * so far.
 */
const LEFT_FOR_LATER: ReadonlySet<string> = new Set([
  'مالکیت خودرو',
  'معاینه فنی',
  'حواله',
  // «تخفیف بیمهٔ ثالث»: the no-claims discount in years, which is the insurer's record and no attribute of ours (CS-85).
  'تخفیف بیمه ثالث',
]);
const KNOWN_LABELS: ReadonlySet<string> = new Set([...Object.values(LABEL), ...LEFT_FOR_LATER]);

/** The seller's own scores, under «ارزیابی فروشنده»: claims, not inspections. */
const SCORE = {
  engine: 'موتور',
  chassis: 'وضعیت شاسی ها',
  // The post's other form: one score for each side instead of «وضعیت شاسی‌ها» (385 of 6,169 snapshots, CS-85).
  frontChassis: 'شاسی جلو',
  rearChassis: 'شاسی عقب',
  body: 'بدنه',
  gearbox: 'گیربکس',
} as const;
const KNOWN_SCORES: ReadonlySet<string> = new Set(Object.values(SCORE));
const SCORES_HEADING = 'ارزیابی فروشنده';

/** Divar's form tops out at 1,000,000 km, which sellers pick when they do not say (the field survey, 2026-09-28). */
const MILEAGE_UNKNOWN = 1_000_000;
/**
 * No car is known to have driven more than about 5 million km: a larger figure is a typo or a code, never a mileage
 * (listing_mileage_km_range states the same bound).
 */
export const MOST_MILEAGE_KM = 9_999_999;

/**
 * «۹۱۰۰۰» in a post, «۱۲۰,۰۰۰ کیلومتر» in a list row; 0 is a new car. The figure as written: whether it is believable
 * for the car is deriveDivarListing's, which knows the car's age.
 */
export function readMileage(text: string): Read<number> {
  const km = readWholeNumber(wordsOf(text).replace(/ ?کیلومتر$/, ''));
  if (km === undefined || km > MOST_MILEAGE_KM) return UNPARSED;
  return km === MILEAGE_UNKNOWN ? UNKNOWN : valueOf(km);
}

// «قبل از ۱۳۶۶ - قبل از ۱۹۸۷»: the oldest choice in Divar's list, which names no year.
const BEFORE_OLDEST = /^قبل از \d{4}(?: - قبل از \d{4})?$/;
const ONE_YEAR = /^(\d{4})$/;
const TWO_YEARS = /^(\d{4}) ?[-–] ?(\d{4})$/;

function yearRead(year: ModelYear | undefined): Read<ModelYear> {
  return year === undefined ? UNPARSED : valueOf(year);
}

/** «۱۳۹۲ - ۲۰۱۳» (both calendars, Divar's usual form) or «۲۰۲۵» (an import's Gregorian year alone), per ADR-0014. */
export function readModelYear(text: string): Read<ModelYear> {
  const words = wordsOf(text);
  if (BEFORE_OLDEST.test(words)) return UNKNOWN;
  const alone = ONE_YEAR.exec(words);
  if (alone?.[1] !== undefined) return yearRead(yearStatedAlone(Number(alone[1])));
  const pair = TWO_YEARS.exec(words);
  if (pair?.[1] !== undefined && pair[2] !== undefined) {
    return yearRead(yearsStatedTogether(Number(pair[1]), Number(pair[2])));
  }
  return UNPARSED;
}

/**
 * How many model years old the car was in the Jalali year its snapshot was fetched in: that year less its model year.
 * Divar's oldest choice, «قبل از ۱۳۶۶», names no year but is older than any age that matters here. Undefined when the
 * listing says nothing readable about its model year.
 */
function ageInModelYears(
  modelYear: ModelYear | null,
  modelYearText: string | undefined,
  fetchedYearSh: number,
): number | undefined {
  if (modelYear !== null) return fetchedYearSh - modelYear.sh;
  return modelYearText !== undefined && BEFORE_OLDEST.test(wordsOf(modelYearText))
    ? Number.POSITIVE_INFINITY
    : undefined;
}

/** Third-party insurance runs for a year, so at most 12 months are left. */
const MOST_INSURANCE_MONTHS = 12;

/** «۶ ماه». */
export function readInsuranceMonths(text: string): Read<number> {
  const months = /^(\d{1,2}) ماه$/.exec(wordsOf(text))?.[1];
  const count = months === undefined ? undefined : Number(months);
  return count !== undefined && count <= MOST_INSURANCE_MONTHS ? valueOf(count) : UNPARSED;
}

const GEARBOXES: ReadonlyMap<string, Gearbox> = new Map([
  ['دنده ای', 'manual'],
  ['اتوماتیک', 'automatic'],
]);

export function readGearbox(text: string): Read<Gearbox> {
  return lookup(GEARBOXES, text);
}

// Divar's filter writes «برقی», its posts «برق».
const FUELS: ReadonlyMap<string, Fuel> = new Map([
  ['بنزین', 'petrol'],
  ['دوگانه سوز شرکتی', 'dual_fuel_factory'],
  ['دوگانه سوز دستی', 'dual_fuel_aftermarket'],
  ['هیبرید', 'hybrid'],
  ['پلاگین هیبرید', 'plug_in_hybrid'],
  ['برق', 'electric'],
  ['برقی', 'electric'],
  ['گازوئیل', 'diesel'],
]);

export function readFuel(text: string): Read<Fuel> {
  return lookup(FUELS, text);
}

/** «قیمت پایه» as shown (price.ts: any digit script and separator, a leading direction mark, placeholders). */
export function readPrice(text: string): Read<ShownPrice> {
  const price = parseShownPrice(text);
  return price === undefined ? UNPARSED : valueOf(price);
}

// Two of Divar's toggles: a row shows only when the seller switched it on.
const SWAP: ReadonlyMap<string, boolean> = new Map([
  ['هستم', true],
  ['نیستم', false],
]);
const INSTALLMENTS: ReadonlyMap<string, boolean> = new Map([
  ['دارد', true],
  ['ندارد', false],
]);

/** «مایل به معاوضه: هستم». */
export function readSwap(text: string): Read<boolean> {
  return lookup(SWAP, text);
}

/** «امکان خرید قسطی: دارد»: the car can be bought in installments; the price may still be the full price. */
export function readInstallments(text: string): Read<boolean> {
  return lookup(INSTALLMENTS, text);
}

/** webengage.business_type of a post, as seen in 4,720 listings of 2026-09-17. */
const SELLERS: ReadonlyMap<string, SellerType> = new Map([
  ['personal', 'private'],
  ['premium-panel', 'dealer'],
]);

export function readSellerType(text: string): Read<SellerType> {
  return lookup(SELLERS, text);
}

// Divar's eight values («وضعیت بدنه» in its filters). «رنگ‌شدگی در N ناحیه» is Divar's «رنگ‌شدگی» value with the number of
// painted areas the seller counted: it is read as partly_repainted for every N and the count stays in the snapshot. The
// seller picked this value and not «دوررنگ» or «تمام رنگ», which are values of their own on the same list, and no source
// gives the number of areas at which a car becomes one of those (docs/research/2026-09-30-iranian-used-car-price-factors.md,
// 4a), so a count is never turned into another value (CS-85).
const BODY: ReadonlyMap<string, BodyCondition> = new Map([
  ['سالم و بی خط و خش', 'intact'],
  ['خط و خش جزیی', 'minor_scratches'],
  ['خط و خش جزئی', 'minor_scratches'],
  ['صافکاری بی رنگ', 'paintless_dent_repair'],
  ['رنگ شدگی', 'partly_repainted'],
  ['دوررنگ', 'repainted_around'],
  ['دور رنگ', 'repainted_around'],
  ['تمام رنگ', 'fully_repainted'],
  ['تصادفی', 'accident_damaged'],
  ['اوراقی', 'salvage'],
]);
const REPAINTED_AREAS = /^رنگ شدگی(?: ?[،,])? در (?:\d+|چند) ناحیه$/;

export function readBodyCondition(text: string): Read<BodyCondition> {
  return REPAINTED_AREAS.test(wordsOf(text)) ? valueOf('partly_repainted') : lookup(BODY, text);
}

// The engine («وضعیت موتور» in Divar's filters) and the gearbox, whose sound score reads «سالم و پلمپ». «نیاز به تعمیر
// جزئی» and «نیاز به تعمیر اساسی» are «نیاز به تعمیر» with the seller's size of the repair, which stays in the snapshot.
// «تعمیر شده» (repaired) is not any of the three older values, so it has one of its own (migration
// allow_repaired_part_condition). «تعیین‌نشده» is the seller leaving it unstated: unknown, not a value.
const PARTS: ReadonlyMap<string, PartCondition> = new Map([
  ['سالم', 'sound'],
  ['سالم و پلمپ', 'sound'],
  ['سالم و پلمب', 'sound'],
  ['نیاز به تعمیر', 'needs_repair'],
  ['نیاز به تعمیر جزیی', 'needs_repair'],
  ['نیاز به تعمیر جزئی', 'needs_repair'],
  ['نیاز به تعمیر اساسی', 'needs_repair'],
  ['تعویض شده', 'replaced'],
  ['تعمیر شده', 'repaired'],
]);
const NOT_DETERMINED = 'تعیین نشده';

export function readPartCondition(text: string): Read<PartCondition> {
  return wordsOf(text) === NOT_DETERMINED ? UNKNOWN : lookup(PARTS, text);
}

// «وضعیت شاسی‌ها»: Divar's nine choices name the sides that are not sound («عقب ضربه‌خورده، جلو رنگ‌شده»), both
// sides at once («هردو رنگ‌شده»), or neither («سالم و پلمپ» in posts, «هر دو سالم و پلمب» in its filters).
const CHASSIS: ReadonlyMap<string, ChassisCondition> = new Map([
  ['سالم و پلمپ', 'intact'],
  ['سالم و پلمب', 'intact'],
  ['رنگ شده', 'repainted'],
  ['ضربه خورده', 'damaged'],
]);
const SIDES: ReadonlyMap<string, 'front' | 'rear'> = new Map([
  ['جلو', 'front'],
  ['عقب', 'rear'],
]);
const BOTH_SIDES = /^هر ?دو (.+)$/;
const ONE_SIDE = /^(\S+) (.+)$/;

export type Chassis = { readonly front: ChassisCondition; readonly rear: ChassisCondition };

export function readChassisCondition(text: string): Read<Chassis> {
  const words = wordsOf(text);
  if (words === NOT_DETERMINED) return UNKNOWN;
  const whole = CHASSIS.get(words);
  if (whole === 'intact') return valueOf({ front: 'intact', rear: 'intact' });
  // «ضربه‌خورده» or «رنگ‌شده» alone names no side (CS-85): read as both sides, a conservative superset (the chassis was hit
  // or painted somewhere). Valuation excludes any damaged side and the chassis-intact filter needs both sides intact,
  // which is the safe behaviour; no consumer uses the side. CS-92 stores the unsided fact, and this can then be narrowed.
  if (whole !== undefined) return valueOf({ front: whole, rear: whole });
  const both = BOTH_SIDES.exec(words)?.[1];
  if (both !== undefined) {
    const condition = CHASSIS.get(both);
    return condition === undefined ? UNPARSED : valueOf({ front: condition, rear: condition });
  }
  const sides = new Map<'front' | 'rear', ChassisCondition>();
  for (const part of words.split(/ ?[،,] ?/)) {
    const [, sideWord, conditionWords] = ONE_SIDE.exec(part) ?? [];
    const side = sideWord === undefined ? undefined : SIDES.get(sideWord);
    const condition = conditionWords === undefined ? undefined : CHASSIS.get(conditionWords);
    if (side === undefined || condition === undefined || sides.has(side)) return UNPARSED;
    sides.set(side, condition);
  }
  // A side Divar's choice does not name is sound.
  return valueOf({ front: sides.get('front') ?? 'intact', rear: sides.get('rear') ?? 'intact' });
}

/**
 * One side's score, from «شاسی جلو» or «شاسی عقب»: «سالم و پلمپ», «رنگ‌شده», «ضربه‌خورده» or «تعیین‌نشده». The whole-chassis
 * score «وضعیت شاسی‌ها» has the same words but names no side: readChassisCondition reads «ضربه‌خورده» or «رنگ‌شده» there
 * as both sides, a conservative superset (of the 385 posts with one score for each side, 299 have a single side hit).
 */
export function readChassisSide(text: string): Read<ChassisCondition> {
  const words = wordsOf(text);
  if (words === NOT_DETERMINED) return UNKNOWN;
  const condition = CHASSIS.get(words);
  return condition === undefined ? UNPARSED : valueOf(condition);
}

// Reading the snapshot.

const widget = z.looseObject({ widget_type: z.string(), data: z.unknown() });
type Widget = z.infer<typeof widget>;
const snapshot = z.looseObject({
  sections: z.array(z.looseObject({ section_name: z.string(), widgets: z.array(widget) })),
});
// Where the car is: the post's city by Divar's slug and name, and its district as seo.web_info names it (CS-50).
const place = z.looseObject({
  city: z.looseObject({ second_slug: z.string(), name: z.string() }).optional(),
  seo: z
    .looseObject({ web_info: z.looseObject({ district_persian: z.string().optional() }).optional() })
    .optional(),
});
const CITY_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function placeOf(payload: JsonObject): {
  city: { slug: string; nameFa: string } | null;
  districtFa: string | null;
} {
  const read = place.safeParse(payload).data;
  const slug = read?.city?.second_slug.trim() ?? '';
  const nameFa = read?.city ? wordsOf(read.city.name) : '';
  const district = read?.seo?.web_info?.district_persian ? wordsOf(read.seo.web_info.district_persian) : '';
  return {
    city: CITY_SLUG.test(slug) && slug.length <= 60 && nameFa !== '' ? { slug, nameFa } : null,
    districtFa: district === '' ? null : district,
  };
}

// What the post records outside its rows, whatever the type of each value: an unexpected one is kept as unparsed.
const recorded = z.looseObject({ brand_model: z.unknown(), business_type: z.unknown() });
const labelled = z.looseObject({ title: z.string(), value: z.string() });
const scored = z.looseObject({ title: z.string(), descriptive_score: z.string() });
const group = z.looseObject({ items: z.array(z.unknown()) });
const modal = z.looseObject({
  action: z.looseObject({
    type: z.literal('LOAD_MODAL_PAGE'),
    payload: z.looseObject({ modal_page: z.looseObject({ widget_list: z.array(widget) }) }),
  }),
});
const legendTitle = z.looseObject({ title: z.string() });
// The «برند و مدل» row links to the search of its own brand_model value.
const brandModelLink = z.looseObject({
  action: z.looseObject({
    payload: z.looseObject({
      search_data: z.looseObject({
        form_data: z.looseObject({
          data: z.looseObject({
            brand_model: z.looseObject({
              repeated_string: z.looseObject({ value: z.array(z.string()) }),
            }),
          }),
        }),
      }),
    }),
  }),
});

type Row = { readonly label: string; readonly text: string; readonly data: unknown };
type Rows = { readonly labelled: Row[]; readonly scored: Row[] };

function collectRows(widgets: readonly Widget[], rows: Rows): void {
  for (const item of widgets) {
    if (item.widget_type === 'GROUP_INFO_ROW') {
      for (const entry of group.safeParse(item.data).data?.items ?? []) {
        const row = labelled.safeParse(entry);
        if (row.success) rows.labelled.push({ label: row.data.title, text: row.data.value, data: entry });
      }
    } else if (item.widget_type === 'UNEXPANDABLE_ROW') {
      const row = labelled.safeParse(item.data);
      if (row.success) rows.labelled.push({ label: row.data.title, text: row.data.value, data: item.data });
    } else if (item.widget_type === 'SCORE_ROW') {
      const row = scored.safeParse(item.data);
      if (row.success)
        rows.scored.push({ label: row.data.title, text: row.data.descriptive_score, data: item.data });
    } else if (item.widget_type === 'SELECTOR_ROW') {
      const page = modal.safeParse(item.data);
      if (page.success) collectRows(page.data.action.payload.modal_page.widget_list, rows);
    }
  }
}

/** The first row under each known label, and the labels this parser does not know. */
function byLabel(
  rows: readonly Row[],
  known: ReadonlySet<string>,
  unknown: string[],
  prefix = '',
): Map<string, Row> {
  const found = new Map<string, Row>();
  for (const row of rows) {
    const label = wordsOf(row.label);
    if (!known.has(label)) unknown.push(prefix + row.label);
    else if (!found.has(label)) found.set(label, row);
  }
  return found;
}

function titleOf(sections: z.infer<typeof snapshot>['sections']): string | null {
  for (const section of sections) {
    if (section.section_name !== 'TITLE') continue;
    for (const item of section.widgets) {
      const title =
        item.widget_type === 'LEGEND_TITLE_ROW' ? legendTitle.safeParse(item.data).data?.title : undefined;
      if (title !== undefined && title.trim() !== '') return title.trim();
    }
  }
  return null;
}

/** A value the post records, as text: a string as it is, any other value but null as its JSON; null is not a value. */
function recordedText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Divar's own make, model and trim value («Peugeot 206 5»): the post's own record of it, else its row's link. */
function sourceModelKeyOf(recordedValue: unknown, row: Row | undefined): string | null {
  const recorded = typeof recordedValue === 'string' ? recordedValue.trim() : '';
  if (recorded !== '') return recorded;
  const link = brandModelLink.safeParse(row?.data).data;
  const linked =
    link?.action.payload.search_data.form_data.data.brand_model.repeated_string.value[0]?.trim() ?? '';
  return linked === '' ? null : linked;
}

const PHOTO_HOST = 'divarcdn.com';
const PHOTO_PATH = '/static/photo/';

/** The address when it is one of Divar's own photos over https (ADR-0025); pages never load anything else. */
function divarPhoto(address: string | undefined): string | null {
  if (address === undefined || !URL.canParse(address)) return null;
  const url = new URL(address);
  const ownHost = url.hostname === PHOTO_HOST || url.hostname.endsWith(`.${PHOTO_HOST}`);
  const plain = url.username === '' && url.password === '';
  // The address as the URL standard writes it (a lowercase scheme, no surrounding space), which is what the
  // database's https check and the browser read.
  return url.protocol === 'https:' && ownHost && plain && url.pathname.startsWith(PHOTO_PATH)
    ? url.href
    : null;
}

/**
 * The attributes of the listing a Divar snapshot shows, given when the snapshot was first fetched (the reference year
 * of the mileage rule). Throws DivarShapeError only when the snapshot is not a post at all, which readPost never
 * stores: a value of an unexpected type is kept as unparsed, so no snapshot the crawler has read is ever lost to the
 * parser.
 */
export function deriveDivarListing(payload: JsonObject, fetchedAt: Date): DerivedListing {
  const read = snapshot.safeParse(payload);
  if (!read.success) throw new DivarShapeError('the snapshot is not a Divar post', { cause: read.error });
  const { sections } = read.data;
  const webengage = recorded.safeParse(payload.webengage).data;
  const rows: Rows = { labelled: [], scored: [] };
  for (const section of sections)
    if (section.section_name === 'LIST_DATA') collectRows(section.widgets, rows);

  const unknownLabels: string[] = [];
  const row = byLabel(rows.labelled, KNOWN_LABELS, unknownLabels);
  const score = byLabel(rows.scored, KNOWN_SCORES, unknownLabels, `${SCORES_HEADING}: `);
  const unparsed: UnparsedValue[] = [];
  const statedUnknown: UnparsedField[] = [];

  /** A stated value read; null when it is absent, stated as unknown, or unparsed (then kept with its raw text). */
  function stated<T>(
    field: UnparsedField,
    text: string | undefined,
    reader: (text: string) => Read<T>,
  ): T | null {
    if (text === undefined || wordsOf(text) === '') return null;
    const result = reader(text);
    if (result.outcome === 'value') return result.value;
    if (result.outcome === 'unknown') statedUnknown.push(field);
    else unparsed.push({ field, rawText: text });
    return null;
  }

  const chassis = stated('chassis_condition', score.get(SCORE.chassis)?.text, readChassisCondition);
  const frontChassis = stated('chassis_condition', score.get(SCORE.frontChassis)?.text, readChassisSide);
  const rearChassis = stated('chassis_condition', score.get(SCORE.rearChassis)?.text, readChassisSide);
  const modelYearText = row.get(LABEL.modelYear)?.text;
  const modelYear = stated('model_year', modelYearText, readModelYear);
  const mileageText = row.get(LABEL.mileage)?.text;
  const writtenKm = stated('mileage_km', mileageText, readMileage);
  let mileageKm = writtenKm;
  let mileageReading: MileageReading | null = null;
  // CS-86 and CS-101: a mileage typed in thousands is not the figure it says. When the figure is too low for the car's
  // age, the listing's own words say which it is (mileage-wording.ts); with none that settle it the mileage is
  // unknown, the stated text kept with its reason, and the valuation run may still read it in thousands by the price.
  const age = ageInModelYears(modelYear, modelYearText, jalaliYearOf(fetchedAt));
  if (writtenKm !== null && mileageText !== undefined && isImplausibleMileage(writtenKm, age)) {
    const text = divarListingText(payload);
    const wording =
      text === null ? null : readMileageWording(`${text.title}\n${text.description}`, writtenKm);
    if (wording?.reading === 'really_low') {
      mileageReading = { reading: 'really_low', writtenKm, wording: wording.wording };
    } else if (wording?.reading === 'thousands_text' && isPlausibleAsThousands(writtenKm, age)) {
      mileageReading = { reading: 'thousands_text', writtenKm, wording: wording.wording };
      mileageKm = writtenKm * 1000;
    } else {
      mileageReading = { reading: 'unread', writtenKm, wording: null };
      mileageKm = null;
      unparsed.push({ field: 'mileage_km', rawText: mileageText, reason: 'implausible' });
    }
  }
  const photos: PhotoAddress[] = [];
  let skippedPhotos = 0;
  for (const photo of photoUrlsOf(payload)) {
    const url = divarPhoto(photo.url);
    if (url === null) {
      skippedPhotos += 1;
      continue;
    }
    const thumbnailUrl = divarPhoto(photo.thumbnailUrl);
    // A thumbnail elsewhere is left out too, and the photo kept without it.
    if (thumbnailUrl === null && photo.thumbnailUrl !== undefined) skippedPhotos += 1;
    photos.push({ url, thumbnailUrl });
  }

  const title = titleOf(sections);
  return {
    parserVersion: DIVAR_PARSER_VERSION,
    attributes: {
      title,
      sourceModelKey: sourceModelKeyOf(webengage?.brand_model, row.get(LABEL.brandModel)),
      modelYear,
      mileageKm,
      mileageReading,
      fuel: stated('fuel', row.get(LABEL.fuel)?.text, readFuel),
      gearbox: stated('gearbox', row.get(LABEL.gearbox)?.text, readGearbox),
      insuranceMonthsLeft: stated(
        'insurance_months_left',
        row.get(LABEL.insurance)?.text,
        readInsuranceMonths,
      ),
      price: stated('price', row.get(LABEL.price)?.text, readPrice),
      acceptsSwap: stated('accepts_swap', row.get(LABEL.swap)?.text, readSwap),
      acceptsInstallments: stated(
        'accepts_installments',
        row.get(LABEL.installments)?.text,
        readInstallments,
      ),
      sellerType: stated('seller_type', recordedText(webengage?.business_type), readSellerType),
      bodyCondition: stated('body_condition', score.get(SCORE.body)?.text, readBodyCondition),
      engineCondition: stated('engine_condition', score.get(SCORE.engine)?.text, readPartCondition),
      gearboxCondition: stated('gearbox_condition', score.get(SCORE.gearbox)?.text, readPartCondition),
      frontChassisCondition: frontChassis ?? chassis?.front ?? null,
      rearChassisCondition: rearChassis ?? chassis?.rear ?? null,
      colour: stated('colour', row.get(LABEL.colour)?.text, readColour),
      ...placeOf(payload),
      engineVolumeCc: title === null ? null : readEngineVolume(title),
    },
    photos,
    unparsed,
    statedUnknown,
    unknownLabels,
    skippedPhotos,
  };
}
