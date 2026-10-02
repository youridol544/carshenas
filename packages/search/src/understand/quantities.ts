// What a number means (CS-62, S04 "Numbers"): a price, a mileage, a model year, a car's age, the months of insurance,
// the days since a listing was posted, or an engine size the data does not carry. The unit and the neighbouring words
// decide, and the numbers are the buyer's own: «زیر ۷۰۰ میلیون» is at most 700,000,000 tomans, «حدود ۲ میلیارد» is
// 10% either side, «مدل ۹۸» is the Solar Hijri year 1398 and «۲۰۱۸» the Gregorian year 2018, which is 1397 by the one
// rule of ADR-0014. A number with no unit and no word around it («۲») is no quantity and is left alone. Nothing here
// uses a model; a number a model proposes is read again by these functions from the buyer's words.
import { claimOf, type Claim } from './claims.ts';
import { amountOf, readNumbers, type NumberRead } from './numbers.ts';
import { tokenize, type Token } from './text.ts';

/** No car costs less: below it a price is shown as not understood, never applied. */
export const PRICE_FLOOR_TOMAN = 20_000_000;
/** «صفر کیلومتر» is a new car: at most this many kilometres (the data holds 0 to 100 for them). */
export const ZERO_KM_MAX = 100;
/** The earliest Solar Hijri year a buyer can mean (the index holds 1372 and later). */
const FIRST_YEAR = 1340;
/** The Gregorian year is the Solar Hijri year plus this (ADR-0014). */
export const GREGORIAN_GAP = 621;
const MAX_MILEAGE = 9_999_999;

type Relation = 'at_most' | 'at_least' | 'around' | 'between' | 'from';

const BEFORE: ReadonlyMap<string, Relation> = new Map([
  ['زیر', 'at_most'],
  ['تا', 'at_most'],
  ['حداکثر', 'at_most'],
  ['حد اکثر', 'at_most'],
  ['کمتر از', 'at_most'],
  ['کمتراز', 'at_most'],
  ['پایین تر از', 'at_most'],
  ['پایینتر از', 'at_most'],
  ['نهایتا', 'at_most'],
  ['نهایت', 'at_most'],
  ['سقف', 'at_most'],
  ['تا سقف', 'at_most'],
  ['بالای', 'at_least'],
  ['بالا', 'at_least'],
  ['بیشتر از', 'at_least'],
  ['بیشتراز', 'at_least'],
  ['بالاتر از', 'at_least'],
  ['بالاتراز', 'at_least'],
  ['حداقل', 'at_least'],
  ['حد اقل', 'at_least'],
  ['حدود', 'around'],
  ['حدودا', 'around'],
  ['حدودی', 'around'],
  ['تقریبا', 'around'],
  ['در حد', 'around'],
  ['در حدود', 'around'],
  ['حول', 'around'],
  ['قریب', 'around'],
  ['نزدیک', 'around'],
  ['نزدیک به', 'around'],
  ['بین', 'between'],
  ['از', 'from'],
]);
// Under, less than, lower than: strictly below (a model year «زیر ۱۴۰۰» is 1399 at most).
const STRICT: ReadonlySet<string> = new Set(['زیر', 'کمتر از', 'کمتراز', 'پایین تر از', 'پایینتر از']);

/** Whether the words (folded) say «زیر», «کمتر از»: strictly below, as a model year «زیر ۱۴۰۰» (1399 at most) means. */
export function hasStrictWord(norms: readonly string[]): boolean {
  const text = ` ${norms.join(' ')} `;
  return [...STRICT].some((word) => text.includes(` ${word} `));
}

const AFTER: ReadonlyMap<string, 'at_most' | 'at_least'> = new Map([
  ['به بالا', 'at_least'],
  ['به بعد', 'at_least'],
  ['و بالاتر', 'at_least'],
  ['و بالا', 'at_least'],
  ['بالاتر', 'at_least'],
  ['ببالا', 'at_least'],
  ['به پایین', 'at_most'],
  ['به قبل', 'at_most'],
  ['و پایین تر', 'at_most'],
  ['و پایینتر', 'at_most'],
  ['و کمتر', 'at_most'],
  ['کمتر', 'at_most'],
  ['پایین تر', 'at_most'],
  ['پایینتر', 'at_most'],
]);

// Words around a number that say what it counts, before it or after it («۵۰ هزار کیلومتر کارکرده»).
const MILEAGE_WORDS: ReadonlySet<string> = new Set(['کارکرد', 'کارکرده', 'کیلومتر', 'کیلو', 'کیلومتری']);
const PRICE_WORDS: ReadonlySet<string> = new Set(['قیمت', 'بودجه', 'مبلغ', 'هزینه', 'تومان', 'تومن']);
const YEAR_WORDS: ReadonlySet<string> = new Set(['مدل', 'سال', 'ساخت']);
const NOISE: ReadonlySet<string> = new Set(['ام', 'اخیر', 'گذشته', 'پیش']);
const JOINERS: ReadonlySet<string> = new Set(['تا', 'الی']);

function wordsOf(tokens: readonly Token[], from: number, to: number): string {
  return tokens
    .slice(from, to)
    .map((token) => token.norm)
    .join(' ');
}

type Left = {
  /** The first token of the number's left neighbourhood that belongs to it. */
  readonly start: number;
  readonly relation: Relation | undefined;
  readonly strict: boolean;
  readonly mileage: boolean;
  readonly price: boolean;
  readonly year: boolean;
  readonly insurance: boolean;
};

/** The relation and context words just before a number, at most four tokens, never across a sentence. */
function leftOf(tokens: readonly Token[], from: number, available: (i: number) => boolean): Left {
  let start = from;
  let relation: Relation | undefined;
  let strict = false;
  let mileage = false;
  let price = false;
  let year = false;
  let insurance = false;
  for (let steps = 0; steps < 4; steps += 1) {
    if (start === 0 || tokens[start]?.breakBefore === 2 || !available(start - 1)) break;
    const one = wordsOf(tokens, start - 1, start);
    const twoOk = start >= 2 && available(start - 2) && tokens[start - 1]?.breakBefore !== 2;
    const two = twoOk ? wordsOf(tokens, start - 2, start) : '';
    if (relation === undefined && BEFORE.has(two)) {
      relation = BEFORE.get(two);
      strict = STRICT.has(two);
      start -= 2;
    } else if (relation === undefined && BEFORE.has(one)) {
      relation = BEFORE.get(one);
      strict = STRICT.has(one);
      start -= 1;
    } else if (MILEAGE_WORDS.has(one)) {
      mileage = true;
      start -= 1;
    } else if (PRICE_WORDS.has(one)) {
      price = true;
      start -= 1;
    } else if (YEAR_WORDS.has(one)) {
      year = true;
      start -= 1;
    } else if (one === 'بیمه') {
      insurance = true;
      start -= 1;
    } else if (NOISE.has(one)) {
      start -= 1;
    } else break;
  }
  return { start, relation, strict, mileage, price, year, insurance };
}

/** The relation and context words just after a number: «به بالا», «کارکرده». Returns where its neighbourhood ends. */
function rightOf(
  tokens: readonly Token[],
  to: number,
  available: (i: number) => boolean,
): { end: number; relation: 'at_most' | 'at_least' | undefined } {
  let end = to;
  let relation: 'at_most' | 'at_least' | undefined;
  for (let steps = 0; steps < 3; steps += 1) {
    const next = tokens[end];
    if (next === undefined || next.breakBefore === 2 || !available(end)) break;
    const twoOk = tokens[end + 1] !== undefined && available(end + 1) && tokens[end + 1]?.breakBefore !== 2;
    const two = twoOk ? wordsOf(tokens, end, end + 2) : '';
    if (relation === undefined && AFTER.has(two)) {
      relation = AFTER.get(two);
      end += 2;
    } else if (relation === undefined && AFTER.has(next.norm)) {
      relation = AFTER.get(next.norm);
      end += 1;
    } else if (MILEAGE_WORDS.has(next.norm) || NOISE.has(next.norm)) {
      end += 1;
    } else break;
  }
  return { end, relation };
}

type Role = 'price' | 'mileage' | 'year' | 'age' | 'insurance' | 'posted' | 'engine';

/** What a number counts by its own scale or unit, when it says: «۴۰ هزار» is a mileage, «۱ میلیارد» a price. */
function kindOf(read: NumberRead): Role | undefined {
  switch (read.unit) {
    case 'toman':
    case 'rial':
      return 'price';
    case 'km':
      return 'mileage';
    case 'years':
      return 'age';
    case 'months':
      return 'insurance';
    case 'days':
    case 'hours':
      return 'posted';
    case 'cc':
      return 'engine';
    case null:
      break;
  }
  if (read.scale >= 1_000_000) return 'price';
  return read.scale === 1_000 ? 'mileage' : undefined;
}

/** Two numbers can be the ends of one range unless each says it counts something else. */
function sameKind(first: NumberRead, second: NumberRead): boolean {
  const a = kindOf(first);
  const b = kindOf(second);
  return a === undefined || b === undefined || a === b;
}

/** A number's amount in the unit of its role, and what the words around it say; null when it is no quantity. */
function amountFor(
  role: Role,
  read: NumberRead,
  scale: number,
  unit: NumberRead['unit'],
  context: Left,
  solarYear: number,
  yearAfter: boolean,
): number | undefined {
  const base = read.base;
  const own = Math.round(base * scale * 1_000) / 1_000;
  switch (role) {
    case 'price': {
      if (unit === 'rial') return Math.round(own / 10);
      // «۷۰۰ تومن» is millions in speech; a number written in full is as it is.
      if (scale === 1 && read.written === 'digits' && unit === 'toman' && own < 100_000) {
        return Math.round(own * 1_000_000);
      }
      if (scale === 1 && unit === null && own >= 50 && own < 10_000) return Math.round(own * 1_000_000);
      return Math.round(own);
    }
    case 'mileage':
      // «کارکرد ۸۰» is eighty thousand; written in kilometres or with a scale, it is what it says.
      if (scale === 1 && unit === null && context.mileage && own < 1_000) return Math.round(own * 1_000);
      return Math.round(own);
    case 'year': {
      if (scale !== 1 || unit !== null || read.written !== 'digits' || !Number.isInteger(base))
        return undefined;
      if (base >= 1380 && base <= solarYear + 1) return base;
      if (base >= 1300 && base <= 1500 && context.year) return base;
      if (base >= 1990 && base <= solarYear + GREGORIAN_GAP + 1) return base - GREGORIAN_GAP;
      if (context.year || yearAfter) {
        if (base >= 80 && base <= 99) return 1300 + base;
        if (base >= 0 && base <= 10) return 1400 + base;
      }
      return undefined;
    }
    case 'age':
    case 'insurance':
      return Math.ceil(own);
    case 'posted':
      return unit === 'hours' ? Math.ceil(own / 24) : Math.ceil(own);
    case 'engine':
      return own;
  }
}

/** Which role a number has from its unit, its scale and the words around it; undefined when it is none. */
function roleOf(
  read: NumberRead,
  scale: number,
  unit: NumberRead['unit'],
  context: Left,
  relation: boolean,
  yearAfter: boolean,
  solarYear: number,
): Role | undefined {
  switch (unit) {
    case 'cc':
      return 'engine';
    case 'months':
      return context.insurance ? 'insurance' : undefined;
    case 'days':
    case 'hours':
      return 'posted';
    case 'years':
      return 'age';
    case 'km':
      return 'mileage';
    case 'toman':
    case 'rial':
      return 'price';
    case null:
      break;
  }
  if (scale >= 1_000_000) return 'price';
  if (scale === 1_000) return context.price ? 'price' : 'mileage';
  if (context.price) return 'price';
  if (context.mileage) return 'mileage';
  if (amountFor('year', read, scale, unit, context, solarYear, yearAfter) !== undefined) return 'year';
  const amount = amountOf(read);
  if (relation && amount >= 50 && amount < 10_000) return 'price';
  if (relation && amount >= 10_000_000) return 'price';
  return undefined;
}

type Bounds = { min?: number; max?: number };

function boundsFor(
  relation: Relation | undefined,
  strict: boolean,
  role: Role,
  first: number,
  second: number | undefined,
): Bounds {
  if (second !== undefined) return { min: Math.min(first, second), max: Math.max(first, second) };
  switch (relation) {
    case 'at_most':
      return { max: role === 'year' && strict ? first - 1 : first };
    case 'at_least':
    case 'from':
      return { min: first };
    case 'around':
      return role === 'year'
        ? { min: first - 1, max: first + 1 }
        : { min: Math.round(first * 0.9), max: Math.round(first * 1.1) };
    case 'between':
    case undefined:
      // A model year named with no relation is that year; a price or a mileage with none is a budget: at most.
      return role === 'year' ? { min: first, max: first } : { max: first };
  }
}

const FILTER_OF = {
  price: 'price',
  mileage: 'mileage',
  year: 'year',
  age: 'age',
  insurance: 'insurance',
  posted: 'posted_within',
} as const;

const TOPIC_OF = { price: 'قیمت', mileage: 'کارکرد', year: 'سال ساخت' } as const;

/**
 * Reads the quantities in a query. `free` says which tokens nothing else has claimed (a model's number, a trim's
 * «تیپ ۲»); a number whose tokens are not free is passed over.
 */
export function readQuantities(
  tokens: readonly Token[],
  free: (index: number) => boolean,
  solarYear: number,
): Claim[] {
  const claims: Claim[] = [];
  const used = new Set<number>();
  const available = (index: number) => free(index) && !used.has(index);
  const allFree = (from: number, to: number) =>
    Array.from({ length: to - from }, (_, offset) => from + offset).every(available);
  const reads = readNumbers(tokens);
  for (let at = 0; at < reads.length; at += 1) {
    const first = reads[at];
    if (first === undefined || !allFree(first.from, first.to)) continue;
    // «تیپ ۲» names a trim; the trim step reads it.
    if (tokens[first.from - 1]?.norm === 'تیپ') continue;
    const left = leftOf(tokens, first.from, available);

    // A range: «۴۰۰ تا ۵۰۰ میلیون», «بین ۴۰۰ و ۵۰۰», «۵۰۰-۷۰۰». The scale and unit written once apply to both.
    const joiner = tokens[first.to]?.norm;
    const candidate = reads[at + 1];
    const second =
      candidate?.from === first.to + 1 &&
      tokens[candidate.from]?.breakBefore !== 2 &&
      joiner !== undefined &&
      (JOINERS.has(joiner) || (joiner === 'و' && left.relation === 'between')) &&
      allFree(candidate.from, candidate.to) &&
      sameKind(first, candidate)
        ? candidate
        : undefined;
    const right = rightOf(tokens, (second ?? first).to, available);
    const bareFirst = first.scale === 1 && first.unit === null;
    const bareSecond = second?.scale === 1 && second.unit === null;
    const firstScale = bareFirst && second !== undefined ? second.scale : first.scale;
    const firstUnit = bareFirst && second !== undefined ? second.unit : first.unit;
    const secondScale = bareSecond ? firstScale : (second?.scale ?? 1);
    const secondUnit = bareSecond ? firstUnit : (second?.unit ?? null);
    const relation: Relation | undefined = right.relation ?? left.relation;
    const yearAfter = right.relation !== undefined;
    const role = roleOf(first, firstScale, firstUnit, left, relation !== undefined, yearAfter, solarYear);
    if (role === undefined) continue;
    const start = left.start;
    const end = right.end;
    const skipSecond = second === undefined ? 0 : 1;

    if (role === 'engine') {
      claims.push(claimOf(start, end, 'engine', { unsupported: 'حجم موتور' }));
      for (let index = start; index < end; index += 1) used.add(index);
      at += skipSecond;
      continue;
    }

    const a = amountFor(role, first, firstScale, firstUnit, left, solarYear, yearAfter);
    const b =
      second === undefined
        ? undefined
        : amountFor(role, second, secondScale, secondUnit, left, solarYear, yearAfter);
    if (a === undefined || (second !== undefined && b === undefined)) continue;

    if (role === 'age' || role === 'insurance' || role === 'posted') {
      const [low, high]: readonly [number, number] =
        role === 'age' ? [0, 60] : role === 'insurance' ? [1, 12] : [1, 90];
      if (a < low || a > high) continue;
      claims.push(claimOf(start, end, role, { filters: [{ filterId: FILTER_OF[role], value: a }] }));
    } else {
      const bounds =
        role === 'mileage' && a === 0 && b === undefined
          ? { max: ZERO_KM_MAX }
          : boundsFor(relation, left.strict, role, a, b);
      const values = [bounds.min, bounds.max].filter((one): one is number => one !== undefined);
      const implausible = values.some((value) =>
        role === 'price'
          ? value < PRICE_FLOOR_TOMAN
          : role === 'mileage'
            ? value < 0 || value > MAX_MILEAGE
            : value < FIRST_YEAR || value > solarYear + 1,
      );
      claims.push(
        implausible
          ? claimOf(start, end, role, { implausible: TOPIC_OF[role] })
          : claimOf(start, end, role, { filters: [{ filterId: FILTER_OF[role], value: bounds }] }),
      );
    }
    for (let index = start; index < end; index += 1) used.add(index);
    at += skipSecond;
  }
  return claims;
}

export type QuantityRole = 'price' | 'mileage' | 'year' | 'age' | 'insurance' | 'posted';
export type ModelRelation = 'at_most' | 'at_least' | 'between' | 'around' | 'exact';

/**
 * A number a model proposes, read again from the buyer's own words (S04: "a number the model invents is rejected").
 * `texts` are the number's words as the buyer typed them («۷۰۰ میلیون»; two for `between`), `strict` that the phrase
 * said «زیر» (a model year «زیر ۱۴۰۰» is 1399 at most). The same unit, scale, plausibility and spoken-form rules as
 * the code pass, so a model gets no number code would not read. Returns the filter's value or what is wrong.
 */
export function quantityFromWords(
  role: QuantityRole,
  relation: ModelRelation,
  texts: readonly string[],
  strict: boolean,
  solarYear: number,
): { readonly value: unknown } | { readonly problem: string } {
  const reads = texts.map((text) => {
    const tokens = tokenize(text);
    const found = readNumbers(tokens);
    const [only] = found;
    return found.length === 1 && only?.from === 0 && only.to === tokens.length ? only : undefined;
  });
  const [first, second] = reads;
  if (first === undefined || (texts.length === 2 && second === undefined)) {
    return {
      problem: 'is not a number written in the search: copy the number exactly as the buyer wrote it',
    };
  }
  if ((relation === 'between') !== (texts.length === 2)) {
    return { problem: 'needs two numbers for between, and one for every other relation' };
  }
  const context: Left = {
    start: 0,
    relation: undefined,
    strict,
    mileage: role === 'mileage',
    price: role === 'price',
    year: role === 'year',
    insurance: role === 'insurance',
  };
  const bare = (read: NumberRead) => read.scale === 1 && read.unit === null;
  const firstScale = second !== undefined && bare(first) ? second.scale : first.scale;
  const firstUnit = second !== undefined && bare(first) ? second.unit : first.unit;
  const a = amountFor(
    role === 'posted' ? 'posted' : role,
    first,
    firstScale,
    firstUnit,
    context,
    solarYear,
    false,
  );
  const b =
    second === undefined
      ? undefined
      : amountFor(
          role,
          second,
          bare(second) ? firstScale : second.scale,
          bare(second) ? firstUnit : second.unit,
          context,
          solarYear,
          false,
        );
  if (a === undefined || (second !== undefined && b === undefined)) {
    return { problem: `is not a ${role} the buyer wrote` };
  }
  if (role === 'age' || role === 'insurance' || role === 'posted') {
    const [low, high]: readonly [number, number] =
      role === 'age' ? [0, 60] : role === 'insurance' ? [1, 12] : [1, 90];
    return a >= low && a <= high ? { value: a } : { problem: `is outside what a ${role} can be` };
  }
  const mapped: Relation | undefined = relation === 'exact' ? undefined : relation;
  const bounds = boundsFor(mapped, strict, role, a, b);
  const values = [bounds.min, bounds.max].filter((one): one is number => one !== undefined);
  const implausible = values.some((value) =>
    role === 'price'
      ? value < PRICE_FLOOR_TOMAN
      : role === 'mileage'
        ? value < 0 || value > MAX_MILEAGE
        : value < FIRST_YEAR || value > solarYear + 1,
  );
  return implausible ? { problem: `is not a plausible ${role} for a car` } : { value: bounds };
}
