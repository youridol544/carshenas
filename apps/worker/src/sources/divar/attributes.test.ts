import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { JsonObject, JsonValue } from '@carshenas/db/db-types';
import { toToman } from '@carshenas/locale/toman';
import {
  NEW_CAR_MILEAGE_BELOW_KM,
  NOT_NEW_AT_MODEL_YEARS,
  isImplausibleMileage,
  type DerivedListing,
  type ListingAttributes,
  type UnparsedValue,
} from '../attributes.ts';
import type { ShownPrice } from '../price.ts';
import { DivarShapeError, isJsonObject, jsonObjectOf } from './answers.ts';
import {
  DIVAR_PARSER_VERSION,
  MOST_MILEAGE_KM,
  deriveDivarListing,
  readChassisCondition,
  readChassisSide,
  readColour,
  readMileage,
  readPrice,
} from './attributes.ts';
import { readPost } from './post.ts';

// The parser on snapshots made from real Divar posts (src/test-support/divar-snapshots and its README), and on
// variants of them that put in the other forms real listings write: 4,720 car listings of 2026-09-17, Divar's own
// filter lists of 2026-09-19, and the price formats CS-2 recorded (ADR-0014).

const FIXTURES = [
  'private-206-both-calendars',
  'dealer-206-swap-installments',
  'dealer-pickup-placeholder-price',
] as const;
/** The four posts of CS-86 (the mileage rule), each read as of the date it was first fetched. */
const MILEAGE_FIXTURES = {
  'private-405-mileage-in-thousands': new Date('2026-09-30T13:05:50.986Z'),
  'private-dena-1402-zero-km': new Date('2026-10-01T06:13:55.150Z'),
  'private-207-1403-few-km': new Date('2026-09-30T12:24:27.599Z'),
  'private-dena-1405-few-km': new Date('2026-10-01T05:25:32.869Z'),
} as const;
const CS85_FIXTURES = [
  'private-engine-and-chassis-undetermined',
  'private-sided-chassis-gearbox-repaired',
  'private-sided-chassis-gearbox-minor-repair',
  'private-engine-and-gearbox-need-repair',
  'private-chassis-repainted-four-areas',
  'private-chassis-damaged-around-repainted',
  'private-six-areas',
  'private-insurance-discount-row',
] as const;
type Fixture = (typeof FIXTURES)[number] | keyof typeof MILEAGE_FIXTURES | (typeof CS85_FIXTURES)[number];
const PRIVATE: Fixture = 'private-206-both-calendars';

/** A day of 1405, like every real post's: the first three were read on 2026-09-29. */
const FETCHED = new Date('2026-09-29T09:00:00Z');

/** The parser, as of a day of 1405 unless the test says when its snapshot was first fetched. */
function derive(payload: JsonObject, fetchedAt: Date = FETCHED): DerivedListing {
  return deriveDivarListing(payload, fetchedAt);
}

function snapshotOf(name: Fixture): JsonObject {
  const text = readFileSync(
    new URL(`../../test-support/divar-snapshots/${name}.json`, import.meta.url),
    'utf8',
  );
  const payload = jsonObjectOf(text);
  if (payload === undefined) throw new Error(`${name} is not a JSON object`);
  return payload;
}

// Invisible characters are built from their code points, never typed.
const RLM = String.fromCodePoint(0x200f);
const ZWNJ = String.fromCodePoint(0x200c);
const HAMZA_ABOVE = String.fromCodePoint(0x0654);

/** Words joined by a zero-width non-joiner, as Divar writes «دنده‌ای». */
function joined(...parts: readonly string[]): string {
  return parts.join(ZWNJ);
}

// Labels as Divar writes them.
const INSURANCE = `مهلت بیمه${HAMZA_ABOVE} شخص ثالث`;
const CHASSIS = joined('وضعیت شاسی', 'ها');
const YEAR = 'مدل (سال تولید)';
const PRICE = 'قیمت پایه';

type Changes = {
  readonly rows?: Readonly<Record<string, string>>;
  readonly scores?: Readonly<Record<string, string>>;
  readonly businessType?: string;
};

/**
 * A real snapshot with some values changed: labelled rows by their title, the seller's scores by theirs, and the seller
 * type. Each change must name exactly one value in the snapshot.
 */
function varied(name: Fixture, changes: Changes): JsonObject {
  let text = JSON.stringify(snapshotOf(name));
  function replace(prefix: string, to: string): void {
    const at = text.indexOf(prefix);
    if (at < 0 || text.includes(prefix, at + 1)) throw new Error(`not exactly one ${prefix} in ${name}`);
    const start = at + prefix.length;
    // The old value is a JSON string holding no quote.
    const end = text.indexOf('"', start + 1) + 1;
    text = text.slice(0, start) + JSON.stringify(to) + text.slice(end);
  }
  for (const [label, to] of Object.entries(changes.rows ?? {})) {
    replace(`"title":${JSON.stringify(label)},"value":`, to);
  }
  for (const [label, to] of Object.entries(changes.scores ?? {})) {
    replace(`"title":${JSON.stringify(label)},"descriptive_score":`, to);
  }
  if (changes.businessType !== undefined) replace('"business_type":', changes.businessType);
  const payload = jsonObjectOf(text);
  if (payload === undefined) throw new Error('the varied snapshot is not an object');
  return payload;
}

/** A real snapshot with rows added to its car's data. */
function withExtraRows(name: Fixture, widgets: readonly JsonObject[]): JsonObject {
  const payload = structuredClone(snapshotOf(name));
  const sections = Array.isArray(payload.sections) ? payload.sections.filter(isJsonObject) : [];
  const listData = sections.find((section) => section.section_name === 'LIST_DATA');
  if (!listData || !Array.isArray(listData.widgets)) throw new Error(`${name} has no LIST_DATA`);
  listData.widgets.push(...widgets);
  return payload;
}

function asking(toman: number): ShownPrice {
  return { type: 'asking', toman: toToman(toman) };
}

function placeholder(toman: number): ShownPrice {
  return { type: 'placeholder', toman: toToman(toman) };
}

test('the three real snapshots are read in full, with nothing unparsed and no row unknown', () => {
  assert.deepEqual(derive(snapshotOf('private-206-both-calendars')).attributes, {
    title: '۲۰۶ تیپ ۵ ۱۳۹۲',
    sourceModelKey: 'Peugeot 206 5',
    modelYear: { written: 'both', sh: 1392, ad: 2013 },
    mileageKm: 91_000,
    fuel: 'petrol',
    gearbox: 'manual',
    insuranceMonthsLeft: 6,
    price: asking(1_140_000_000),
    acceptsSwap: null,
    acceptsInstallments: null,
    sellerType: 'private',
    bodyCondition: 'intact',
    engineCondition: 'sound',
    gearboxCondition: 'sound',
    frontChassisCondition: 'intact',
    rearChassisCondition: 'intact',
    colour: 'grey',
    city: { slug: 'tehran', nameFa: 'تهران' },
    districtFa: 'نارمک',
  });
  assert.deepEqual(derive(snapshotOf('dealer-206-swap-installments')).attributes, {
    title: 'پژو ۲۰۶ تیپ ۳',
    sourceModelKey: 'Peugeot 206 3P',
    modelYear: { written: 'both', sh: 1401, ad: 2022 },
    mileageKm: 90_000,
    fuel: 'petrol',
    gearbox: 'manual',
    insuranceMonthsLeft: 6,
    price: asking(1_590_000_000),
    acceptsSwap: true,
    acceptsInstallments: true,
    sellerType: 'dealer',
    bodyCondition: 'intact',
    engineCondition: 'sound',
    gearboxCondition: 'sound',
    frontChassisCondition: 'intact',
    rearChassisCondition: 'intact',
    colour: 'white',
    city: { slug: 'tehran', nameFa: 'تهران' },
    districtFa: 'نارمک',
  });
  // A dealer's installment bait: a placeholder price, and a title that says zero km over a stated 50,000 (the text
  // is CS-52's to weigh). It states no insurance and no gearbox score: absent, not unparsed.
  assert.deepEqual(derive(snapshotOf('dealer-pickup-placeholder-price')).attributes, {
    title: 'پرایدوانت/صفروکارکرد/اقساط۴۸ماهه/تحویل روز',
    sourceModelKey: 'Pride Pickup 151 GX',
    modelYear: { written: 'both', sh: 1401, ad: 2022 },
    mileageKm: 50_000,
    fuel: 'dual_fuel_factory',
    gearbox: 'manual',
    insuranceMonthsLeft: null,
    price: placeholder(500_000),
    acceptsSwap: null,
    acceptsInstallments: true,
    sellerType: 'dealer',
    bodyCondition: 'intact',
    engineCondition: 'sound',
    gearboxCondition: null,
    frontChassisCondition: 'intact',
    rearChassisCondition: 'intact',
    colour: 'white',
    city: { slug: 'tehran', nameFa: 'تهران' },
    districtFa: 'نارمک',
  });
  for (const name of FIXTURES) {
    const derived = derive(snapshotOf(name));
    assert.equal(derived.parserVersion, DIVAR_PARSER_VERSION, name);
    assert.deepEqual(derived.unparsed, [], name);
    assert.deepEqual(derived.statedUnknown, [], name);
    assert.deepEqual(derived.unknownLabels, [], name);
    assert.equal(derived.skippedPhotos, 0, name);
  }
});

test('a colour Divar names is its code, spaced either way; a colour it does not is unparsed, never guessed', () => {
  assert.deepEqual(readColour('سفید'), { outcome: 'value', value: 'white' });
  assert.deepEqual(readColour(`نقره${String.fromCodePoint(0x200c)}ای`), {
    outcome: 'value',
    value: 'silver',
  });
  assert.deepEqual(readColour('نقره ای'), { outcome: 'value', value: 'silver' });
  assert.deepEqual(readColour('نوک مدادی'), { outcome: 'value', value: 'graphite' });
  assert.deepEqual(readColour('سایر'), { outcome: 'value', value: 'other' });
  assert.deepEqual(readColour('صورتی جیغ'), { outcome: 'unparsed' });
});

test('a real price row is written as CS-2 recorded it: a leading right-to-left mark and ASCII commas', () => {
  const text = JSON.stringify(snapshotOf(PRIVATE));
  assert.ok(text.includes(`"title":"${PRICE}","value":"${RLM}۱,۱۴۰,۰۰۰,۰۰۰ تومان"`));
});

test('every price format CS-2 recorded is read from a real price row: separators, digit scripts, placeholders', () => {
  const cases: readonly (readonly [string, ShownPrice])[] = [
    [`${RLM}۱,۱۴۰,۰۰۰,۰۰۰ تومان`, asking(1_140_000_000)],
    // The Arabic comma, as Divar wrote its prices in 2025-11.
    [`${RLM}۱،۱۴۰،۰۰۰،۰۰۰ تومان`, asking(1_140_000_000)],
    ['۱٬۱۴۰٬۰۰۰٬۰۰۰ تومان', asking(1_140_000_000)],
    // Torob groups with the Arabic decimal separator.
    ['۱٫۱۴۰٫۰۰۰٫۰۰۰ تومان', asking(1_140_000_000)],
    ['١,١٤٠,٠٠٠,٠٠٠ تومان', asking(1_140_000_000)],
    ['1,140,000,000 تومان', asking(1_140_000_000)],
    ['۱۱۴۰۰۰۰۰۰۰ تومان', asking(1_140_000_000)],
    ['توافقی', { type: 'negotiable' }],
    // Placeholders, seen 45, 26 and 29 times among 4,720 car listings: no car sells for them.
    [`${RLM}۱,۰۰۰ تومان`, placeholder(1_000)],
    [`${RLM}۱۰,۰۰۰ تومان`, placeholder(10_000)],
    [`${RLM}۱,۰۰۰,۰۰۰ تومان`, placeholder(1_000_000)],
  ];
  for (const [text, expected] of cases) {
    const derived = derive(varied(PRIVATE, { rows: { [PRICE]: text } }));
    assert.deepEqual(derived.attributes.price, expected, text);
    assert.deepEqual(derived.unparsed, [], text);
  }
  // A decimal, rials and a group of the wrong size are kept as written, never guessed.
  for (const text of ['۱٫۵ میلیارد تومان', '۱۱,۴۰۰,۰۰۰,۰۰۰ ریال', '۱,۱۴,۰۰۰ تومان']) {
    const derived = derive(varied(PRIVATE, { rows: { [PRICE]: text } }));
    assert.equal(derived.attributes.price, null, text);
    assert.deepEqual(derived.unparsed, [{ field: 'price', rawText: text }], text);
  }
});

test("a model year in both calendars, a Gregorian year alone, and Divar's oldest choice (ADR-0014)", () => {
  const year = (text: string) => derive(varied(PRIVATE, { rows: { [YEAR]: text } }));
  assert.deepEqual(year('۱۳۹۲ - ۲۰۱۳').attributes.modelYear, { written: 'both', sh: 1392, ad: 2013 });
  assert.deepEqual(year('۱۴۰۱ - ۲۰۲۳').attributes.modelYear, { written: 'both', sh: 1401, ad: 2023 });
  // An import states its Gregorian year alone (432 of 4,720): its solar year is 621 less.
  assert.deepEqual(year('۲۰۲۵').attributes.modelYear, { written: 'ad', ad: 2025, sh: 1404 });
  assert.deepEqual(year('۱۳۸۵').attributes.modelYear, { written: 'sh', sh: 1385 });
  // «قبل از ۱۳۶۶»: read, but it names no year.
  const oldest = year('قبل از ۱۳۶۶ - قبل از ۱۹۸۷');
  assert.equal(oldest.attributes.modelYear, null);
  assert.deepEqual(oldest.statedUnknown, ['model_year']);
  assert.deepEqual(oldest.unparsed, []);
  for (const text of ['۱۳۹۲ - ۲۰۱۵', '۱۳۹۲ - ۱۳۹۳', '۱۲۹۹', 'مدل ۹۲']) {
    const read = year(text);
    assert.equal(read.attributes.modelYear, null, text);
    assert.deepEqual(read.unparsed, [{ field: 'model_year', rawText: text }], text);
  }
});

test("mileage is read as stated, 0 for a new car, and Divar's 1,000,000 as unknown", () => {
  const km = (text: string) => derive(varied(PRIVATE, { rows: { کارکرد: text } }));
  // 481 of 4,720 car listings are new: here a car of the fetch year (the real private post is of 1392).
  const newCar = derive(varied(PRIVATE, { rows: { کارکرد: '۰', [YEAR]: '۱۴۰۵ - ۲۰۲۶' } }));
  assert.equal(newCar.attributes.mileageKm, 0);
  assert.equal(km('٩١٠٠٠').attributes.mileageKm, 91_000);
  assert.equal(km('91000').attributes.mileageKm, 91_000);
  const unknown = km('۱۰۰۰۰۰۰');
  assert.equal(unknown.attributes.mileageKm, null);
  assert.deepEqual(unknown.statedUnknown, ['mileage_km']);
  assert.deepEqual(unknown.unparsed, []);
  assert.deepEqual(km('زیر صد هزار').unparsed, [{ field: 'mileage_km', rawText: 'زیر صد هزار' }]);
  // More than any car drives, and more than the column holds: kept as written, never handed to the database.
  assert.equal(km('۹۹۹۹۹۹۹').attributes.mileageKm, MOST_MILEAGE_KM);
  const typo = km('۳۰۰۰۰۰۰۰۰۰');
  assert.equal(typo.attributes.mileageKm, null);
  assert.deepEqual(typo.unparsed, [{ field: 'mileage_km', rawText: '۳۰۰۰۰۰۰۰۰۰' }]);
});

/** A real post of CS-86 as of the date it was first fetched. */
function readFixture(name: keyof typeof MILEAGE_FIXTURES): DerivedListing {
  return derive(snapshotOf(name), MILEAGE_FIXTURES[name]);
}

/** The unparsed values of the mileage: what the parser kept as the seller's text, with its reason when it has one. */
function keptMileage(derived: DerivedListing): UnparsedValue[] {
  return derived.unparsed.filter((value) => value.field === 'mileage_km');
}

const IMPLAUSIBLE = (rawText: string): UnparsedValue => ({
  field: 'mileage_km',
  rawText,
  reason: 'implausible',
});

test('a mileage under 1,000 km on a car three or more model years old is kept as the seller wrote it, never as a mileage (CS-86)', () => {
  // The case the rule exists for: a 1397 Peugeot 405 whose seller typed «۱۰۹» for 109,000 km. Read as 109 km it earned
  // a «عالی» rating and the first place in a search.
  const thousands = readFixture('private-405-mileage-in-thousands');
  assert.equal(thousands.attributes.mileageKm, null);
  assert.deepEqual(keptMileage(thousands), [IMPLAUSIBLE('۱۰۹')]);
  // The mileage is not Divar's form that means unknown (its chassis score «تعیین‌نشده» is, since CS-85), the rest of the
  // post is read as ever, and the parser says what it was.
  assert.deepEqual(thousands.statedUnknown, ['chassis_condition']);
  assert.deepEqual(thousands.attributes.modelYear, { written: 'both', sh: 1397, ad: 2018 });
  assert.equal(thousands.attributes.fuel, 'dual_fuel_factory');
  assert.deepEqual(thousands.attributes.price, asking(940_000_000));
  assert.equal(thousands.parserVersion, DIVAR_PARSER_VERSION);
  // Three model years before the year it was fetched is old enough, and a 0 is kept as written too: a zero-km car of
  // 1402 is as unprovable as a figure in thousands.
  const zero = readFixture('private-dena-1402-zero-km');
  assert.equal(zero.attributes.mileageKm, null);
  assert.deepEqual(keptMileage(zero), [IMPLAUSIBLE('۰')]);
  // Divar's other form for a mileage the seller did not state keeps its own treatment, and so does text it cannot read.
  const old = (text: string) => derive(varied(PRIVATE, { rows: { کارکرد: text } }));
  assert.deepEqual(old('۱۰۰۰۰۰۰').statedUnknown, ['mileage_km']);
  assert.deepEqual(old('۱۰۰۰۰۰۰').unparsed, []);
  assert.deepEqual(old('زیر صد هزار').unparsed, [{ field: 'mileage_km', rawText: 'زیر صد هزار' }]);
});

test('a car of the fetch year or of the two before it keeps its few kilometres, and so does any car at 1,000 km or more', () => {
  // 1403 and 1405 in 1405: new cars, as the market sells them.
  const recent = readFixture('private-207-1403-few-km');
  assert.equal(recent.attributes.mileageKm, 40);
  assert.deepEqual(keptMileage(recent), []);
  const current = readFixture('private-dena-1405-few-km');
  assert.equal(current.attributes.mileageKm, 88);
  assert.deepEqual(keptMileage(current), []);
  // The real post of 1392: from 1,000 km on, the figure is a mileage, in any digit script and with its grouping.
  const old = (text: string) => derive(varied(PRIVATE, { rows: { کارکرد: text } }));
  for (const [text, km] of [
    ['۱۰۰۰', 1_000],
    ['۱,۰۰۰', 1_000],
    ['١٠٠٠', 1_000],
    ['91000', 91_000],
    ['۲۰۰,۰۰۰', 200_000],
  ] as const) {
    assert.equal(old(text).attributes.mileageKm, km, text);
    assert.deepEqual(old(text).unparsed, [], text);
  }
  // One kilometre fewer is not: the text, as written in any script and with its direction marks, is what is kept.
  for (const text of ['۹۹۹', '٩٩٩', '999', `${RLM}۱۰۹`, '۰', '0', '۱']) {
    const read = old(text);
    assert.equal(read.attributes.mileageKm, null, text);
    assert.deepEqual(read.unparsed, [IMPLAUSIBLE(text)], text);
  }
});

test("the car's age is read from its model year in either calendar, and the rule waits for a model year it can read", () => {
  const car = (yearText: string) => derive(varied(PRIVATE, { rows: { کارکرد: '۱۰۹', [YEAR]: yearText } }));
  // 1402 is three model years before 1405; 1403 is two.
  assert.equal(car('۱۴۰۲ - ۲۰۲۳').attributes.mileageKm, null);
  assert.equal(car('۱۴۰۳ - ۲۰۲۴').attributes.mileageKm, 109);
  // A Gregorian year alone is its solar year less 621 (ADR-0014): 2023 is 1402, 2024 is 1403.
  assert.equal(car('۲۰۲۳').attributes.mileageKm, null);
  assert.equal(car('۲۰۲۴').attributes.mileageKm, 109);
  assert.equal(car('۱۳۸۵').attributes.mileageKm, null);
  // A year after the fetch year (a car sold before its model year) is as new as a car can be.
  assert.equal(car('۱۴۰۶ - ۲۰۲۷').attributes.mileageKm, 109);
  // Divar's oldest choice, «قبل از ۱۳۶۶», names no year but is older than any age that matters.
  const oldest = car('قبل از ۱۳۶۶ - قبل از ۱۹۸۷');
  assert.equal(oldest.attributes.mileageKm, null);
  assert.deepEqual(keptMileage(oldest), [IMPLAUSIBLE('۱۰۹')]);
  assert.deepEqual(oldest.statedUnknown, ['model_year']);
  // A model year it cannot read says nothing of the car's age: the mileage stays as stated, and the year as unparsed.
  const unreadable = car('مدل ۹۲');
  assert.equal(unreadable.attributes.mileageKm, 109);
  assert.deepEqual(unreadable.unparsed, [{ field: 'model_year', rawText: 'مدل ۹۲' }]);
});

test("the snapshot's own fetch date sets the reference year, never the clock, so the same snapshot always gives the same listing (CS-86)", (context) => {
  // A 1402 car stating 0 km. Nowruz opens at midnight in Tehran, 20:30 UTC the evening before: in the last instant of
  // 1404 it is two model years old, and in the first of 1405 it is three.
  const payload = snapshotOf('private-dena-1402-zero-km');
  const lastOf1404 = new Date('2026-03-20T20:29:59.999Z');
  const firstOf1405 = new Date('2026-03-20T20:30:00Z');
  const before = derive(payload, lastOf1404);
  assert.equal(before.attributes.mileageKm, 0);
  assert.deepEqual(keptMileage(before), []);
  const after = derive(payload, firstOf1405);
  assert.equal(after.attributes.mileageKm, null);
  assert.deepEqual(keptMileage(after), [IMPLAUSIBLE('۰')]);
  // A later year only makes it older.
  assert.equal(derive(payload, new Date('2027-06-01T00:00:00Z')).attributes.mileageKm, null);
  // The parser never asks what day it is: its answer is the same on any day it runs.
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2031-01-01T00:00:00Z') });
  assert.deepEqual(derive(payload, firstOf1405), after);
  assert.deepEqual(derive(payload, lastOf1404), before);
  context.mock.timers.setTime(Date.parse('2020-01-01T00:00:00Z'));
  assert.deepEqual(derive(payload, firstOf1405), after);
  assert.deepEqual(derive(payload, lastOf1404), before);
});

test('the rule itself: under 1,000 km, at three model years of age or more, and only when the age is known', () => {
  assert.equal(NEW_CAR_MILEAGE_BELOW_KM, 1_000);
  assert.equal(NOT_NEW_AT_MODEL_YEARS, 3);
  assert.equal(isImplausibleMileage(999, 3), true);
  assert.equal(isImplausibleMileage(0, 3), true);
  assert.equal(isImplausibleMileage(1_000, 3), false);
  assert.equal(isImplausibleMileage(999, 2), false);
  assert.equal(isImplausibleMileage(0, 0), false);
  assert.equal(isImplausibleMileage(0, -1), false);
  assert.equal(isImplausibleMileage(999, Number.POSITIVE_INFINITY), true);
  assert.equal(isImplausibleMileage(999, undefined), false);
});

test("a list row's mileage and price are read the same way (real rows of 2026-09-29)", () => {
  for (const [text, value] of [
    ['۰ کیلومتر', 0],
    ['۴۸,۰۰۰ کیلومتر', 48_000],
    ['۴۰۰,۰۰۰ کیلومتر', 400_000],
  ] as const) {
    assert.deepEqual(readMileage(text), { outcome: 'value', value }, text);
  }
  for (const [text, toman] of [
    ['۱,۰۶۳,۰۰۰,۰۰۰ تومان', 1_063_000_000],
    ['۱۳,۶۰۰,۰۰۰,۰۰۰ تومان', 13_600_000_000],
  ] as const) {
    assert.deepEqual(readPrice(text), { outcome: 'value', value: asking(toman) }, text);
  }
});

test('insurance is read in months, at most a year of it', () => {
  const months = (text: string) => derive(varied(PRIVATE, { rows: { [INSURANCE]: text } }));
  assert.equal(months('۱۲ ماه').attributes.insuranceMonthsLeft, 12);
  assert.equal(months('۱ ماه').attributes.insuranceMonthsLeft, 1);
  const beyond = months('۱۸ ماه');
  assert.equal(beyond.attributes.insuranceMonthsLeft, null);
  assert.deepEqual(beyond.unparsed, [{ field: 'insurance_months_left', rawText: '۱۸ ماه' }]);
});

test("fuels, gearboxes, the swap and installment rows and the seller type come from Divar's own lists", () => {
  const fuel = (text: string) => derive(varied(PRIVATE, { rows: { 'نوع سوخت': text } })).attributes.fuel;
  for (const [text, code] of [
    ['بنزین', 'petrol'],
    [joined('دوگانه', 'سوز شرکتی'), 'dual_fuel_factory'],
    [joined('دوگانه', 'سوز دستی'), 'dual_fuel_aftermarket'],
    ['هیبرید', 'hybrid'],
    ['پلاگین هیبرید', 'plug_in_hybrid'],
    ['برق', 'electric'],
    ['برقی', 'electric'],
    ['گازوئیل', 'diesel'],
  ] as const) {
    assert.equal(fuel(text), code, text);
  }
  const gearbox = (text: string) => derive(varied(PRIVATE, { rows: { گیربکس: text } })).attributes;
  assert.equal(gearbox('اتوماتیک').gearbox, 'automatic');
  assert.equal(gearbox('دنده ای').gearbox, 'manual');
  // The gearbox row and the gearbox score share a title; each is read as its own.
  assert.equal(gearbox('اتوماتیک').gearboxCondition, 'sound');
  const declined = derive(
    varied('dealer-206-swap-installments', {
      rows: { 'مایل به معاوضه': 'نیستم', 'امکان خرید قسطی': 'ندارد' },
    }),
  ).attributes;
  assert.equal(declined.acceptsSwap, false);
  assert.equal(declined.acceptsInstallments, false);
  assert.equal(derive(varied(PRIVATE, { businessType: 'premium-panel' })).attributes.sellerType, 'dealer');
  const unknownSeller = derive(varied(PRIVATE, { businessType: 'agency' }));
  assert.equal(unknownSeller.attributes.sellerType, null);
  assert.deepEqual(unknownSeller.unparsed, [{ field: 'seller_type', rawText: 'agency' }]);
  const unknownFuel = derive(varied(PRIVATE, { rows: { 'نوع سوخت': 'هیدروژن' } }));
  assert.deepEqual(unknownFuel.unparsed, [{ field: 'fuel', rawText: 'هیدروژن' }]);
});

test("the seller's scores for the body, the engine and the gearbox, in Divar's own words", () => {
  const body = (text: string) => derive(varied(PRIVATE, { scores: { بدنه: text } })).attributes.bodyCondition;
  for (const [text, code] of [
    [joined('سالم و بی', 'خط و خش'), 'intact'],
    ['خط و خش جزیی', 'minor_scratches'],
    [joined('صافکاری بی', 'رنگ'), 'paintless_dent_repair'],
    [joined('رنگ', 'شدگی'), 'partly_repainted'],
    [`${joined('رنگ', 'شدگی')}، در ۲ ناحیه`, 'partly_repainted'],
    ['دوررنگ', 'repainted_around'],
    [joined('تمام', 'رنگ'), 'fully_repainted'],
    ['تصادفی', 'accident_damaged'],
    ['اوراقی', 'salvage'],
  ] as const) {
    assert.equal(body(text), code, text);
  }
  const engine = (text: string) =>
    derive(varied(PRIVATE, { scores: { موتور: text } })).attributes.engineCondition;
  assert.equal(engine('سالم'), 'sound');
  assert.equal(engine('نیاز به تعمیر'), 'needs_repair');
  assert.equal(engine('تعویض شده'), 'replaced');
  const gearbox = (text: string) =>
    derive(varied(PRIVATE, { scores: { گیربکس: text } })).attributes.gearboxCondition;
  assert.equal(gearbox('سالم و پلمپ'), 'sound');
  assert.equal(gearbox('نیاز به تعمیر'), 'needs_repair');
  const unknown = derive(varied(PRIVATE, { scores: { بدنه: 'نیمه سالم' } }));
  assert.equal(unknown.attributes.bodyCondition, null);
  assert.deepEqual(unknown.unparsed, [{ field: 'body_condition', rawText: 'نیمه سالم' }]);
});

test("the chassis: Divar's nine choices read side by side, a side they do not name being sound", () => {
  const damaged = joined('ضربه', 'خورده');
  const repainted = joined('رنگ', 'شده');
  for (const [text, front, rear] of [
    ['سالم و پلمپ', 'intact', 'intact'],
    ['هر دو سالم و پلمب', 'intact', 'intact'],
    [`عقب ${damaged}`, 'intact', 'damaged'],
    [`عقب ${repainted}`, 'intact', 'repainted'],
    [`جلو ${damaged}`, 'damaged', 'intact'],
    [`جلو ${repainted}`, 'repainted', 'intact'],
    [`عقب ${damaged}، جلو ${repainted}`, 'repainted', 'damaged'],
    [`عقب ${repainted}، جلو ${damaged}`, 'damaged', 'repainted'],
    [`هردو ${damaged}`, 'damaged', 'damaged'],
    [`هردو ${repainted}`, 'repainted', 'repainted'],
  ] as const) {
    const read: ListingAttributes = derive(varied(PRIVATE, { scores: { [CHASSIS]: text } })).attributes;
    assert.deepEqual([read.frontChassisCondition, read.rearChassisCondition], [front, rear], text);
  }
  // No side, a side twice, or an unknown state: kept as written.
  for (const text of [damaged, repainted, `جلو ${repainted}، جلو ${damaged}`, 'جلو شکسته']) {
    assert.deepEqual(readChassisCondition(text), { outcome: 'unparsed' }, text);
  }
  const unread = derive(varied(PRIVATE, { scores: { [CHASSIS]: damaged } }));
  assert.deepEqual(unread.unparsed, [{ field: 'chassis_condition', rawText: damaged }]);
});

test("Divar's model value comes from the post's own record, else from its make and model row's link", () => {
  const recorded = JSON.stringify(snapshotOf(PRIVATE)).replace(
    '"brand_model":"Peugeot 206 5"',
    '"brand_model":""',
  );
  const payload = jsonObjectOf(recorded);
  assert.ok(payload);
  assert.equal(derive(payload).attributes.sourceModelKey, 'Peugeot 206 5');
});

test("photos keep Divar's order, full size and thumbnail, and only its own https addresses are kept", () => {
  const photo = (kind: 'webp_post' | 'webp_thumbnail', index: number) =>
    `https://s100.divarcdn.com/static/photo/neda/${kind}/FIXTURE${String(index)}/gaFIX001-${String(index)}.webp`;
  const derived = derive(snapshotOf(PRIVATE));
  assert.deepEqual(
    derived.photos,
    [0, 1, 2, 3, 4, 5, 6].map((index) => ({
      url: photo('webp_post', index),
      thumbnailUrl: photo('webp_thumbnail', index),
    })),
  );
  // A tracking pixel, a photo over http and a thumbnail on a look-alike host are never loaded by our pages.
  const text = JSON.stringify(snapshotOf(PRIVATE))
    .replace(photo('webp_post', 0), 'https://tracker.example/pixel.webp')
    .replace(photo('webp_post', 1), photo('webp_post', 1).replace('https://', 'http://'))
    .replace(photo('webp_thumbnail', 2), 'https://s100.divarcdn.com.example/x.webp');
  const payload = jsonObjectOf(text);
  assert.ok(payload);
  const kept = derive(payload);
  // Two photos left out, and one kept without its thumbnail: three addresses skipped, and counted.
  assert.equal(kept.skippedPhotos, 3);
  assert.deepEqual(kept.photos[0], { url: photo('webp_post', 2), thumbnailUrl: null });
  assert.equal(kept.photos.length, 5);
  // An address the URL standard reads as https is kept as it writes it, which the database's https check accepts; one
  // that carries a user name is not kept.
  const written = JSON.stringify(snapshotOf(PRIVATE))
    .replace(photo('webp_post', 0), photo('webp_post', 0).replace('https://', 'HTTPS://'))
    .replace(photo('webp_post', 1), ` ${photo('webp_post', 1)}`)
    .replace(photo('webp_post', 2), photo('webp_post', 2).replace('https://', 'https://user@'));
  const normalised = jsonObjectOf(written);
  assert.ok(normalised);
  const read = derive(normalised);
  assert.deepEqual(
    read.photos.slice(0, 2).map((kept) => kept.url),
    [photo('webp_post', 0), photo('webp_post', 1)],
  );
  assert.equal(read.skippedPhotos, 1);
});

test('a value the post records with an unexpected type is kept as unparsed, and never loses the snapshot', () => {
  const recorded = (businessType: JsonValue): JsonObject => ({
    ...snapshotOf(PRIVATE),
    webengage: { brand_model: 'Peugeot 206 5', business_type: businessType, category: 'light' },
  });
  for (const [businessType, unparsed] of [
    [null, []],
    [5, [{ field: 'seller_type', rawText: '5' }]],
    [{ kind: 'dealer' }, [{ field: 'seller_type', rawText: '{"kind":"dealer"}' }]],
  ] as const) {
    // The crawler stores such a post (readPost accepts it), and the parser reads everything else in it.
    const { payload } = readPost(JSON.stringify(recorded(businessType)));
    const derived = derive(payload);
    assert.deepEqual(derived.unparsed, unparsed, JSON.stringify(businessType));
    assert.equal(derived.attributes.sellerType, null);
    assert.equal(derived.attributes.mileageKm, 91_000);
  }
  // A model value that is not text gives way to the make and model row's link.
  const numbered = { ...snapshotOf(PRIVATE), webengage: { brand_model: 206, business_type: 'personal' } };
  assert.equal(derive(numbered).attributes.sourceModelKey, 'Peugeot 206 5');
});

test('rows the parser does not know are counted, and the rows left for later are not', () => {
  const tyres = joined('لاستیک', 'ها');
  const derived = derive(
    withExtraRows(PRIVATE, [
      { widget_type: 'UNEXPANDABLE_ROW', data: { title: 'نوع پلاک', value: 'ملی' } },
      { widget_type: 'SCORE_ROW', data: { title: tyres, descriptive_score: 'نو' } },
    ]),
  );
  assert.deepEqual(derived.unknownLabels, ['نوع پلاک', `ارزیابی فروشنده: ${tyres}`]);
  assert.deepEqual(derived.unparsed, []);
});

test('a snapshot that is not a Divar post is refused, never read as a listing that states nothing', () => {
  assert.throws(() => derive({ title: 'پژو ۲۰۶' }), DivarShapeError);
});

// CS-85: the wordings and rows real posts use that the parser left unread on 2026-09-30 and 2026-10-02, each on a
// snapshot the crawler stored (src/test-support/divar-snapshots/README.md).

function conditionsOf(name: (typeof CS85_FIXTURES)[number]) {
  const derived = derive(snapshotOf(name), new Date('2026-10-02T09:00:00Z'));
  const { bodyCondition, engineCondition, gearboxCondition, frontChassisCondition, rearChassisCondition } =
    derived.attributes;
  return {
    derived,
    read: [bodyCondition, engineCondition, gearboxCondition, frontChassisCondition, rearChassisCondition],
    conditionUnparsed: derived.unparsed.filter((value) => value.field !== 'mileage_km'),
  };
}

test('«رنگ‌شدگی در N ناحیه» without a comma is the body value «رنگ‌شدگی» whatever N is, and never another value (CS-85)', () => {
  const areas = (text: string) =>
    derive(varied(PRIVATE, { scores: { بدنه: text } })).attributes.bodyCondition;
  for (const n of ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '10']) {
    assert.equal(areas(`${joined('رنگ', 'شدگی')} در ${n} ناحیه`), 'partly_repainted', n);
  }
  assert.equal(areas(`${joined('رنگ', 'شدگی')}، در ۲ ناحیه`), 'partly_repainted');
  // A wording that is not this one stays unread.
  assert.equal(areas(`${joined('رنگ', 'شدگی')} در ناحیه`), null);
  assert.equal(conditionsOf('private-six-areas').read[0], 'partly_repainted');
  assert.equal(conditionsOf('private-chassis-repainted-four-areas').read[0], 'partly_repainted');
  assert.deepEqual(conditionsOf('private-six-areas').derived.unparsed, []);
});

test('the engine and the gearbox: «تعیین‌نشده» is unknown, «تعمیر شده» is repaired, the size of a repair needed is kept in the snapshot (CS-85)', () => {
  const engine = (text: string) => derive(varied(PRIVATE, { scores: { موتور: text } }));
  const gearbox = (text: string) => derive(varied(PRIVATE, { scores: { گیربکس: text } }));
  assert.equal(engine('تعیین‌نشده').attributes.engineCondition, null);
  assert.deepEqual(engine('تعیین‌نشده').statedUnknown, ['engine_condition']);
  assert.deepEqual(engine('تعیین‌نشده').unparsed, []);
  assert.deepEqual(gearbox('تعیین‌نشده').statedUnknown, ['gearbox_condition']);
  assert.equal(gearbox('تعمیر شده').attributes.gearboxCondition, 'repaired');
  assert.equal(gearbox('نیاز به تعمیر جزئی').attributes.gearboxCondition, 'needs_repair');
  assert.equal(gearbox('نیاز به تعمیر اساسی').attributes.gearboxCondition, 'needs_repair');
  const undetermined = conditionsOf('private-engine-and-chassis-undetermined');
  assert.deepEqual(undetermined.read, ['intact', null, null, null, null]);
  assert.deepEqual([...undetermined.derived.statedUnknown].sort(), ['chassis_condition', 'engine_condition']);
  assert.deepEqual(undetermined.conditionUnparsed, []);
  assert.deepEqual(conditionsOf('private-chassis-repainted-four-areas').read[2], 'repaired');
  assert.deepEqual(conditionsOf('private-sided-chassis-gearbox-repaired').read[2], 'repaired');
  assert.deepEqual(conditionsOf('private-sided-chassis-gearbox-minor-repair').read[2], 'needs_repair');
  const needRepair = conditionsOf('private-engine-and-gearbox-need-repair');
  assert.deepEqual([needRepair.read[1], needRepair.read[2]], ['needs_repair', 'needs_repair']);
});

test('the chassis: «شاسی جلو» and «شاسی عقب» are read as the sides they name; the whole-chassis wordings that name none stay unread (CS-85)', () => {
  assert.deepEqual(readChassisSide('سالم و پلمپ'), { outcome: 'value', value: 'intact' });
  assert.deepEqual(readChassisSide(joined('ضربه', 'خورده')), { outcome: 'value', value: 'damaged' });
  assert.deepEqual(readChassisSide(joined('رنگ', 'شده')), { outcome: 'value', value: 'repainted' });
  assert.deepEqual(readChassisSide(joined('تعیین', 'نشده')), { outcome: 'unknown' });
  assert.deepEqual(readChassisSide('شکسته'), { outcome: 'unparsed' });
  assert.deepEqual(readChassisCondition(joined('تعیین', 'نشده')), { outcome: 'unknown' });
  const repaired = conditionsOf('private-sided-chassis-gearbox-repaired');
  assert.deepEqual(repaired.read.slice(3), ['intact', 'damaged']);
  assert.deepEqual(repaired.conditionUnparsed, []);
  assert.deepEqual(repaired.derived.unknownLabels, []);
  assert.deepEqual(conditionsOf('private-sided-chassis-gearbox-minor-repair').read.slice(3), [
    'repainted',
    'damaged',
  ]);
  assert.deepEqual(conditionsOf('private-engine-and-gearbox-need-repair').read.slice(3), [
    'damaged',
    'intact',
  ]);
  // Of the 385 posts with a score for each side, 299 have one side damaged or repainted: «ضربه‌خورده» for the whole
  // chassis names no side, so it is kept as written, and the listing has no chassis condition (CS-85 follow-up).
  for (const name of [
    'private-chassis-damaged-around-repainted',
    'private-chassis-repainted-four-areas',
  ] as const) {
    const whole = conditionsOf(name);
    assert.deepEqual(whole.read.slice(3), [null, null], name);
    assert.equal(whole.conditionUnparsed.length, 1, name);
    assert.equal(whole.conditionUnparsed[0]?.field, 'chassis_condition', name);
  }
});

test('«تخفیف بیمهٔ ثالث» is a row the parser leaves out on purpose, and no snapshot of CS-85 has a row it does not know (CS-85)', () => {
  const discount = conditionsOf('private-insurance-discount-row').derived;
  assert.deepEqual(discount.unknownLabels, []);
  assert.deepEqual(discount.unparsed, []);
  for (const name of CS85_FIXTURES) assert.deepEqual(conditionsOf(name).derived.unknownLabels, [], name);
  assert.equal(conditionsOf('private-insurance-discount-row').derived.parserVersion, DIVAR_PARSER_VERSION);
  assert.equal(DIVAR_PARSER_VERSION, 4);
});
