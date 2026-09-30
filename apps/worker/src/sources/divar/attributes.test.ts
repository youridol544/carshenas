import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { JsonObject, JsonValue } from '@carshenas/db/db-types';
import { toToman } from '@carshenas/locale/toman';
import type { ListingAttributes } from '../attributes.ts';
import type { ShownPrice } from '../price.ts';
import { DivarShapeError, isJsonObject, jsonObjectOf } from './answers.ts';
import {
  DIVAR_PARSER_VERSION,
  MOST_MILEAGE_KM,
  deriveDivarListing,
  readChassisCondition,
  readColour,
  readMileage,
  readPrice,
} from './attributes.ts';
import { readPost } from './post.ts';

// The parser on snapshots made from three real Divar posts (src/test-support/divar-snapshots and its README), and on
// variants of them that put in the other forms real listings write: 4,720 car listings of 2026-09-17, Divar's own
// filter lists of 2026-09-19, and the price formats CS-2 recorded (ADR-0014).

const FIXTURES = [
  'private-206-both-calendars',
  'dealer-206-swap-installments',
  'dealer-pickup-placeholder-price',
] as const;
type Fixture = (typeof FIXTURES)[number];
const PRIVATE: Fixture = 'private-206-both-calendars';

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
  assert.deepEqual(deriveDivarListing(snapshotOf('private-206-both-calendars')).attributes, {
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
  assert.deepEqual(deriveDivarListing(snapshotOf('dealer-206-swap-installments')).attributes, {
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
  assert.deepEqual(deriveDivarListing(snapshotOf('dealer-pickup-placeholder-price')).attributes, {
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
    const derived = deriveDivarListing(snapshotOf(name));
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
    const derived = deriveDivarListing(varied(PRIVATE, { rows: { [PRICE]: text } }));
    assert.deepEqual(derived.attributes.price, expected, text);
    assert.deepEqual(derived.unparsed, [], text);
  }
  // A decimal, rials and a group of the wrong size are kept as written, never guessed.
  for (const text of ['۱٫۵ میلیارد تومان', '۱۱,۴۰۰,۰۰۰,۰۰۰ ریال', '۱,۱۴,۰۰۰ تومان']) {
    const derived = deriveDivarListing(varied(PRIVATE, { rows: { [PRICE]: text } }));
    assert.equal(derived.attributes.price, null, text);
    assert.deepEqual(derived.unparsed, [{ field: 'price', rawText: text }], text);
  }
});

test("a model year in both calendars, a Gregorian year alone, and Divar's oldest choice (ADR-0014)", () => {
  const year = (text: string) => deriveDivarListing(varied(PRIVATE, { rows: { [YEAR]: text } }));
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
  const km = (text: string) => deriveDivarListing(varied(PRIVATE, { rows: { کارکرد: text } }));
  // 481 of 4,720 car listings are new.
  assert.equal(km('۰').attributes.mileageKm, 0);
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
  const months = (text: string) => deriveDivarListing(varied(PRIVATE, { rows: { [INSURANCE]: text } }));
  assert.equal(months('۱۲ ماه').attributes.insuranceMonthsLeft, 12);
  assert.equal(months('۱ ماه').attributes.insuranceMonthsLeft, 1);
  const beyond = months('۱۸ ماه');
  assert.equal(beyond.attributes.insuranceMonthsLeft, null);
  assert.deepEqual(beyond.unparsed, [{ field: 'insurance_months_left', rawText: '۱۸ ماه' }]);
});

test("fuels, gearboxes, the swap and installment rows and the seller type come from Divar's own lists", () => {
  const fuel = (text: string) =>
    deriveDivarListing(varied(PRIVATE, { rows: { 'نوع سوخت': text } })).attributes.fuel;
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
  const gearbox = (text: string) =>
    deriveDivarListing(varied(PRIVATE, { rows: { گیربکس: text } })).attributes;
  assert.equal(gearbox('اتوماتیک').gearbox, 'automatic');
  assert.equal(gearbox('دنده ای').gearbox, 'manual');
  // The gearbox row and the gearbox score share a title; each is read as its own.
  assert.equal(gearbox('اتوماتیک').gearboxCondition, 'sound');
  const declined = deriveDivarListing(
    varied('dealer-206-swap-installments', {
      rows: { 'مایل به معاوضه': 'نیستم', 'امکان خرید قسطی': 'ندارد' },
    }),
  ).attributes;
  assert.equal(declined.acceptsSwap, false);
  assert.equal(declined.acceptsInstallments, false);
  assert.equal(
    deriveDivarListing(varied(PRIVATE, { businessType: 'premium-panel' })).attributes.sellerType,
    'dealer',
  );
  const unknownSeller = deriveDivarListing(varied(PRIVATE, { businessType: 'agency' }));
  assert.equal(unknownSeller.attributes.sellerType, null);
  assert.deepEqual(unknownSeller.unparsed, [{ field: 'seller_type', rawText: 'agency' }]);
  const unknownFuel = deriveDivarListing(varied(PRIVATE, { rows: { 'نوع سوخت': 'هیدروژن' } }));
  assert.deepEqual(unknownFuel.unparsed, [{ field: 'fuel', rawText: 'هیدروژن' }]);
});

test("the seller's scores for the body, the engine and the gearbox, in Divar's own words", () => {
  const body = (text: string) =>
    deriveDivarListing(varied(PRIVATE, { scores: { بدنه: text } })).attributes.bodyCondition;
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
    deriveDivarListing(varied(PRIVATE, { scores: { موتور: text } })).attributes.engineCondition;
  assert.equal(engine('سالم'), 'sound');
  assert.equal(engine('نیاز به تعمیر'), 'needs_repair');
  assert.equal(engine('تعویض شده'), 'replaced');
  const gearbox = (text: string) =>
    deriveDivarListing(varied(PRIVATE, { scores: { گیربکس: text } })).attributes.gearboxCondition;
  assert.equal(gearbox('سالم و پلمپ'), 'sound');
  assert.equal(gearbox('نیاز به تعمیر'), 'needs_repair');
  const unknown = deriveDivarListing(varied(PRIVATE, { scores: { بدنه: 'نیمه سالم' } }));
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
    const read: ListingAttributes = deriveDivarListing(
      varied(PRIVATE, { scores: { [CHASSIS]: text } }),
    ).attributes;
    assert.deepEqual([read.frontChassisCondition, read.rearChassisCondition], [front, rear], text);
  }
  // No side, a side twice, or an unknown state: kept as written.
  for (const text of [damaged, `جلو ${repainted}، جلو ${damaged}`, 'جلو شکسته']) {
    assert.deepEqual(readChassisCondition(text), { outcome: 'unparsed' }, text);
  }
  const unread = deriveDivarListing(varied(PRIVATE, { scores: { [CHASSIS]: damaged } }));
  assert.deepEqual(unread.unparsed, [{ field: 'chassis_condition', rawText: damaged }]);
});

test("Divar's model value comes from the post's own record, else from its make and model row's link", () => {
  const recorded = JSON.stringify(snapshotOf(PRIVATE)).replace(
    '"brand_model":"Peugeot 206 5"',
    '"brand_model":""',
  );
  const payload = jsonObjectOf(recorded);
  assert.ok(payload);
  assert.equal(deriveDivarListing(payload).attributes.sourceModelKey, 'Peugeot 206 5');
});

test("photos keep Divar's order, full size and thumbnail, and only its own https addresses are kept", () => {
  const photo = (kind: 'webp_post' | 'webp_thumbnail', index: number) =>
    `https://s100.divarcdn.com/static/photo/neda/${kind}/FIXTURE${String(index)}/gaFIX001-${String(index)}.webp`;
  const derived = deriveDivarListing(snapshotOf(PRIVATE));
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
  const kept = deriveDivarListing(payload);
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
  const read = deriveDivarListing(normalised);
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
    const derived = deriveDivarListing(payload);
    assert.deepEqual(derived.unparsed, unparsed, JSON.stringify(businessType));
    assert.equal(derived.attributes.sellerType, null);
    assert.equal(derived.attributes.mileageKm, 91_000);
  }
  // A model value that is not text gives way to the make and model row's link.
  const numbered = { ...snapshotOf(PRIVATE), webengage: { brand_model: 206, business_type: 'personal' } };
  assert.equal(deriveDivarListing(numbered).attributes.sourceModelKey, 'Peugeot 206 5');
});

test('rows the parser does not know are counted, and the rows left for later are not', () => {
  const tyres = joined('لاستیک', 'ها');
  const derived = deriveDivarListing(
    withExtraRows(PRIVATE, [
      { widget_type: 'UNEXPANDABLE_ROW', data: { title: 'نوع پلاک', value: 'ملی' } },
      { widget_type: 'SCORE_ROW', data: { title: tyres, descriptive_score: 'نو' } },
    ]),
  );
  assert.deepEqual(derived.unknownLabels, ['نوع پلاک', `ارزیابی فروشنده: ${tyres}`]);
  assert.deepEqual(derived.unparsed, []);
});

test('a snapshot that is not a Divar post is refused, never read as a listing that states nothing', () => {
  assert.throws(() => deriveDivarListing({ title: 'پژو ۲۰۶' }), DivarShapeError);
});
