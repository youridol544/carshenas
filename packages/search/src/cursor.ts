// A results page's continuation as one opaque URL-safe word (CS-59): the order it belongs to, the last row's sort key
// and the total the first page counted. A cursor from another order, a changed schema, a key that is not a value of
// its column's type or a hand-edited URL is refused, never guessed: the caller starts from the first page. The key's
// texts are checked here, before they reach SQL, so junk costs no query and can never be a 500 (22P02 for text that
// is no number, 22007 and 22008 for a date that is none, 22003 for a number out of its type's range). Runs in the
// browser and in Node.
import { z } from 'zod';
import type { SortKey } from './sql.ts';
import { DEFAULT_SORT, SORT_IDS, sortById, type SortId, type SortType } from './sorts.ts';

/** The first page's total, which every later page of the same search repeats: nothing is counted for a cursor. */
export type CursorTotal = { readonly count: number; readonly exact: boolean };

export type CursorPage = { readonly key: SortKey; readonly total?: CursorTotal };

const CursorSchema = z.strictObject({
  v: z.literal(1),
  s: z.enum(SORT_IDS),
  k: z.array(z.string().max(64).nullable()).max(8),
  i: z.int().positive(),
  n: z.int().min(0).max(1_000_000_000).optional(),
  e: z.boolean().optional(),
});

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(word: string): string | undefined {
  if (!/^[A-Za-z0-9_-]{1,600}$/.test(word)) return undefined;
  try {
    const binary = atob(word.replaceAll('-', '+').replaceAll('_', '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    );
  } catch {
    return undefined;
  }
}

// What PostgreSQL prints for each type, and its range: numeric(7, 2) is five digits and two decimals; smallint and
// integer are 16 and 32 bits; amounts are whole tomans below 10^15 (ADR-0014).
const INTEGER_TEXT = /^-?\d{1,10}$/;
const INSTANT_TEXT =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?([+-])(\d{2})(?::(\d{2}))?$/;

function daysIn(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isInstant(text: string): boolean {
  const match = INSTANT_TEXT.exec(text);
  if (match === null) return false;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [1, 2, 3, 4, 5, 6, 8, 9].map(
    (group) => Number(match[group] ?? 0),
  );
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined ||
    offsetHour === undefined ||
    offsetMinute === undefined
  )
    return false;
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysIn(year, month) &&
    hour < 24 &&
    minute < 60 &&
    second < 60 &&
    offsetHour <= 15 &&
    offsetMinute < 60
  );
}

/** Whether a key's text is a value of the type, as PostgreSQL would read it. */
export function isSortValue(type: SortType, text: string): boolean {
  switch (type) {
    case 'numeric':
      return /^-?\d{1,5}(?:\.\d{1,2})?$/.test(text);
    case 'smallint':
      return INTEGER_TEXT.test(text) && Math.abs(Number(text)) <= 32_767;
    case 'integer':
      return INTEGER_TEXT.test(text) && Math.abs(Number(text)) <= 2_147_483_647;
    case 'bigint':
      return /^-?\d{1,15}$/.test(text);
    case 'timestamptz':
      return isInstant(text);
  }
}

/** The cursor of the page after the row with this key, in this order; `total` is what the first page counted. */
export function encodeCursor(sortId: SortId | undefined, key: SortKey, total?: CursorTotal): string {
  return toBase64Url(
    JSON.stringify({
      v: 1,
      s: sortId ?? DEFAULT_SORT,
      k: key.values,
      i: key.listingId,
      ...(total === undefined ? {} : { n: total.count, e: total.exact }),
    }),
  );
}

/** The key and total a cursor carries, when it was made for this order and its key is valid; else undefined. */
export function decodeCursorPage(word: string, sortId: SortId | undefined): CursorPage | undefined {
  const text = fromBase64Url(word);
  if (text === undefined) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const parsed = CursorSchema.safeParse(json);
  if (!parsed.success) return undefined;
  const sort = sortById(sortId ?? DEFAULT_SORT);
  if (parsed.data.s !== sort.id || parsed.data.k.length !== sort.orderBy.length) return undefined;
  const checked = sort.orderBy.every((term, index) => {
    const value = parsed.data.k[index];
    if (value === undefined) return false;
    // A column that is never null has no null tail to be in.
    return value === null ? !term.notNull : isSortValue(term.type, value);
  });
  if (!checked) return undefined;
  const key = { values: parsed.data.k, listingId: parsed.data.i };
  return parsed.data.n === undefined
    ? { key }
    : { key, total: { count: parsed.data.n, exact: parsed.data.e ?? true } };
}

/** The key a cursor carries, when it was made for this order and its key is valid; undefined for anything else. */
export function decodeCursor(word: string, sortId: SortId | undefined): SortKey | undefined {
  return decodeCursorPage(word, sortId)?.key;
}
