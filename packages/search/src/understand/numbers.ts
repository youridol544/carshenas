// The numbers a buyer writes, read by code (CS-62, S03): digits in any script with their separators (the tokenizer
// folds them), Persian number words («هفتصد», «یک و نیم»), the scale words «هزار», «میلیون», «میلیارد», compound
// amounts («۲ میلیارد و ۳۰۰ میلیون») and the unit that follows («تومن», «ریال», «کیلومتر», «سال», «سی‌سی»). What a number
// means (a price, a mileage, a year) is decided in quantities.ts from its unit and its neighbours; this file only
// reads. A number a model returns is never trusted: it is read again from the buyer's own words here (checks in
// packages/ai), so a number the buyer did not write cannot reach a filter.
import type { Token } from './text.ts';

export type NumberUnit = 'toman' | 'rial' | 'km' | 'cc' | 'years' | 'months' | 'days' | 'hours';

export type NumberRead = {
  /** Tokens [from, to) of the whole expression: the number, its scale words and its unit. */
  readonly from: number;
  readonly to: number;
  /** Tokens [from, numberTo) are the number and its scale words, without the unit. */
  readonly numberTo: number;
  /** The number as written before its scale word: 700 in «۷۰۰ میلیون», 1.5 in «یک و نیم میلیارد», 2.3 in «۲ میلیارد و ۳۰۰ میلیون». */
  readonly base: number;
  /** 1, 1,000, 1,000,000 or 1,000,000,000 as the scale word says; 1 when there is none. */
  readonly scale: number;
  readonly written: 'digits' | 'words';
  readonly unit: NumberUnit | null;
};

/** The full amount: the base times its scale. */
export function amountOf(read: NumberRead): number {
  return Math.round(read.base * read.scale * 1_000) / 1_000;
}

const UNITS: ReadonlyMap<string, number> = new Map([
  ['صفر', 0],
  ['یک', 1],
  ['یه', 1],
  ['دو', 2],
  ['سه', 3],
  ['چهار', 4],
  ['پنج', 5],
  ['شش', 6],
  ['شیش', 6],
  ['هفت', 7],
  ['هشت', 8],
  ['نه', 9],
]);
const TEENS: ReadonlyMap<string, number> = new Map([
  ['ده', 10],
  ['یازده', 11],
  ['دوازده', 12],
  ['سیزده', 13],
  ['چهارده', 14],
  ['پانزده', 15],
  ['پونزده', 15],
  ['شانزده', 16],
  ['شونزده', 16],
  ['هفده', 17],
  ['هجده', 18],
  ['هیجده', 18],
  ['نوزده', 19],
]);
const TENS: ReadonlyMap<string, number> = new Map([
  ['بیست', 20],
  ['سی', 30],
  ['چهل', 40],
  ['پنجاه', 50],
  ['شصت', 60],
  ['هفتاد', 70],
  ['هشتاد', 80],
  ['نود', 90],
]);
const HUNDREDS: ReadonlyMap<string, number> = new Map([
  ['صد', 100],
  ['دویست', 200],
  ['سیصد', 300],
  ['چهارصد', 400],
  ['پانصد', 500],
  ['پانسد', 500],
  ['پونصد', 500],
  ['ششصد', 600],
  ['شیشصد', 600],
  ['هفتصد', 700],
  ['هفصد', 700],
  ['هشتصد', 800],
  ['هشصد', 800],
  ['نهصد', 900],
]);
const SCALES: ReadonlyMap<string, number> = new Map([
  ['هزار', 1_000],
  ['میلیون', 1_000_000],
  ['میلیارد', 1_000_000_000],
  ['بیلیون', 1_000_000_000],
]);
const UNIT_WORDS: ReadonlyMap<string, NumberUnit> = new Map([
  ['تومان', 'toman'],
  ['تومن', 'toman'],
  ['تومانی', 'toman'],
  ['ریال', 'rial'],
  ['کیلومتر', 'km'],
  ['کیلومتری', 'km'],
  ['کیلو', 'km'],
  ['km', 'km'],
  ['cc', 'cc'],
  ['سیسی', 'cc'],
  ['لیتر', 'cc'],
  ['لیتری', 'cc'],
  ['سال', 'years'],
  ['ساله', 'years'],
  ['سالگی', 'years'],
  ['ماه', 'months'],
  ['ماهه', 'months'],
  ['روز', 'days'],
  ['روزه', 'days'],
  ['ساعت', 'hours'],
]);

const ORDER = { units: 1, tens: 2, hundreds: 3 } as const;

/** Whether the word is a number word (a unit, a teen, a ten, a hundred) or a scale word. */
export function isNumberWord(norm: string): boolean {
  return UNITS.has(norm) || TEENS.has(norm) || TENS.has(norm) || HUNDREDS.has(norm) || SCALES.has(norm);
}

/** The scale word's multiplier, or undefined. */
export function scaleOf(norm: string): number | undefined {
  return SCALES.get(norm);
}

/** The unit a word names, or undefined. */
export function unitOf(norm: string): NumberUnit | undefined {
  return UNIT_WORDS.get(norm);
}

type Term = { readonly base: number; readonly to: number; readonly written: 'digits' | 'words' };

/** A number below one thousand in words («بیست و پنج», «سیصد و پنجاه», «هفتصد») at token `at`. */
function wordsBelowThousand(tokens: readonly Token[], at: number): Term | undefined {
  let total = 0;
  let order = Infinity;
  let taken = 0;
  let i = at;
  while (i < tokens.length) {
    const word = tokens[i]?.norm ?? '';
    if (word === 'و' && taken > 0) {
      const following = tokens[i + 1]?.norm ?? '';
      const next = UNITS.get(following) ?? TEENS.get(following) ?? TENS.get(following);
      if (next === undefined) break;
      i += 1;
      continue;
    }
    const hundreds = HUNDREDS.get(word);
    const tens = TENS.get(word);
    const teens = TEENS.get(word);
    const units = UNITS.get(word);
    const kind =
      hundreds !== undefined
        ? ORDER.hundreds
        : tens !== undefined || teens !== undefined
          ? ORDER.tens
          : units !== undefined
            ? ORDER.units
            : undefined;
    if (kind === undefined || (taken > 0 && kind >= order)) break;
    // Zero is only a whole number.
    if (word === 'صفر' && taken > 0) break;
    total += hundreds ?? tens ?? teens ?? units ?? 0;
    // A teen takes no unit after it («ده» then «پنج» is two numbers).
    order = teens !== undefined ? ORDER.units : kind;
    taken += 1;
    i += 1;
  }
  return taken === 0 ? undefined : { base: total, to: i, written: 'words' };
}

function termAt(tokens: readonly Token[], at: number): Term | undefined {
  const token = tokens[at];
  if (token === undefined) return undefined;
  if (token.kind === 'number') {
    const base = Number(token.norm);
    return Number.isFinite(base) ? { base, to: at + 1, written: 'digits' } : undefined;
  }
  return wordsBelowThousand(tokens, at);
}

/** «و نیم» (and a half) at `at`. */
function andAHalf(tokens: readonly Token[], at: number): boolean {
  return tokens[at]?.norm === 'و' && tokens[at + 1]?.norm === 'نیم';
}

// Words that are numbers and also something else: the article «یک», «یه», and «نه» (nine, and "no"). Alone they are
// not a number; with a scale word or a unit they are.
const AMBIGUOUS_ALONE: ReadonlySet<string> = new Set(['یک', 'یه', 'نه']);

/**
 * The number expression that starts at token `at`: a term, an optional «و نیم», an optional scale word, optional
 * smaller parts joined by «و» («۲ میلیارد و ۳۰۰ میلیون», «۲ میلیارد و ۳۰۰»), then the unit. Undefined when no number
 * stands there, or when it is a word that is only a number with a scale or a unit beside it.
 */
function readAt(tokens: readonly Token[], at: number): NumberRead | undefined {
  const first = tokens[at];
  if (first === undefined) return undefined;
  // «نیم میلیارد»: half of a scale.
  const half = first.norm === 'نیم';
  const term: Term | undefined = half ? { base: 0.5, to: at + 1, written: 'words' } : termAt(tokens, at);
  if (term === undefined) return undefined;
  let base = term.base;
  let cursor = term.to;
  if (!half && andAHalf(tokens, cursor)) {
    base += 0.5;
    cursor += 2;
  }
  let scale = 1;
  const firstScale = SCALES.get(tokens[cursor]?.norm ?? '');
  if (firstScale !== undefined) {
    scale = firstScale;
    cursor += 1;
    if (andAHalf(tokens, cursor)) {
      base += 0.5;
      cursor += 2;
    }
    // Smaller parts: «و ۳۰۰ میلیون», or «و ۳۰۰» which is the next smaller scale.
    let amount = base * scale;
    let previous = scale;
    while (tokens[cursor]?.norm === 'و') {
      const part = termAt(tokens, cursor + 1);
      if (part === undefined) break;
      const partScale = SCALES.get(tokens[part.to]?.norm ?? '');
      const effective = partScale ?? previous / 1_000;
      if (effective >= previous || effective < 1) break;
      amount += part.base * effective;
      previous = effective;
      cursor = part.to + (partScale === undefined ? 0 : 1);
    }
    base = amount / scale;
  }
  const numberTo = cursor;
  let unit: NumberUnit | null = null;
  const following = tokens[cursor]?.norm ?? '';
  if (following === 'سی' && tokens[cursor + 1]?.norm === 'سی') {
    unit = 'cc';
    cursor += 2;
  } else {
    const named = UNIT_WORDS.get(following);
    if (named !== undefined) {
      unit = named;
      cursor += 1;
    }
  }
  // Alone, a word like «یک» or «نه» is not a number, and «نیم» is not one without a scale or a unit.
  const bare = scale === 1 && unit === null;
  if (bare && half) return undefined;
  if (bare && term.written === 'words' && base === term.base && AMBIGUOUS_ALONE.has(first.norm))
    return undefined;
  return { from: at, to: cursor, numberTo, base, scale, written: term.written, unit };
}

/** Every number expression in the tokens, left to right, none overlapping. */
export function readNumbers(tokens: readonly Token[]): NumberRead[] {
  const reads: NumberRead[] = [];
  let at = 0;
  while (at < tokens.length) {
    const read = readAt(tokens, at);
    if (read === undefined || read.to <= at) {
      at += 1;
      continue;
    }
    reads.push(read);
    at = read.to;
  }
  return reads;
}
