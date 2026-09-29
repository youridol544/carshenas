import { latinDigits, withoutBidiControls } from './text.ts';

// A price as a Farsi listing page shows it, read by the rules CS-2 recorded (ADR-0014; docs/research/
// 2026-09-27-money-and-jalali-calendar.md, finding 3.5): the displayed string in any digit script, grouped with an ASCII
// comma, an Arabic comma (U+060C), or the Arabic decimal (U+066B) or thousands (U+066C) separator, with or without a
// leading right-to-left mark. Never a site's numeric field: Divar's webengage.price has come back rounded through a
// 32-bit float, and its schema.org price is in rials on one page and mislabelled on another.

/** The largest amount an amount column holds (ADR-0014): every amount, and the sum of any nine, stays exact. */
export const MAX_TOMAN = 999_999_999_999_999;

/**
 * Below this a shown price is a placeholder, not a price: Divar shows 1,000 or 10,000 tomans on listings that want a
 * call (CS-2), and no car sells for less than ten million tomans in 2026. A plausibility rule, so a constant here, not
 * a constraint in the database (docs/design/data-model.md, section 2): raise it as prices move.
 */
export const PLACEHOLDER_BELOW_TOMAN = 10_000_000;

/** What a listing asks, as its page shows it. Only an asking price carries an amount into the price history. */
export type ShownPrice =
  | { readonly type: 'asking'; readonly toman: number }
  | { readonly type: 'negotiable' }
  | { readonly type: 'placeholder'; readonly toman: number };

const SEPARATOR = /[,،٫٬]/g;
// Digits grouped by threes with one kind of separator, or ungrouped, then «تومان».
const AMOUNT = /^(\d{1,3}(?:[,،٫٬]\d{3})+|\d+) ?تومان$/;

/** The price a page shows, or undefined when the text is not one this recognises (it is then kept, never guessed). */
export function parseShownPrice(text: string): ShownPrice | undefined {
  const plain = latinDigits(withoutBidiControls(text)).replace(/\s+/g, ' ').trim();
  if (plain === 'توافقی' || plain === 'قیمت توافقی') return { type: 'negotiable' };
  const amount = AMOUNT.exec(plain)?.[1];
  if (amount === undefined) return undefined;
  const toman = Number(amount.replace(SEPARATOR, ''));
  if (!Number.isSafeInteger(toman) || toman > MAX_TOMAN) return undefined;
  return toman < PLACEHOLDER_BELOW_TOMAN ? { type: 'placeholder', toman } : { type: 'asking', toman };
}

/** Whether two shown prices ask the same: the same type, and the same amount for an asking price. */
export function samePrice(a: ShownPrice, b: ShownPrice): boolean {
  if (a.type !== b.type) return false;
  return a.type === 'asking' && b.type === 'asking' ? a.toman === b.toman : true;
}
