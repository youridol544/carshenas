import { withoutBidiControls } from '@carshenas/locale/text';
import { readWrittenToman, type Toman } from '@carshenas/locale/toman';

// What a listing asks, as its page shows it (ADR-0014; CS-2, finding 3.5). Reading the written amount is shared with
// the web app (@carshenas/locale/toman: any digit script and separator, a leading direction mark). What the crawler
// adds is what sources mean by it: «توافقی» is negotiable, and a token figure is a placeholder, not a price. Never a
// site's numeric field: Divar's webengage.price has come back rounded through a 32-bit float, and its schema.org price
// is in rials on one page and mislabelled on another.

/**
 * Below this a shown price is a placeholder, not a price: Divar shows 1,000 or 10,000 tomans on listings that want a
 * call, and no car sells for less than ten million tomans in 2026. A plausibility rule, so a constant here, not a
 * constraint in the database (docs/design/data-model.md, section 2): raise it as prices move.
 */
export const PLACEHOLDER_BELOW_TOMAN = 10_000_000;

/** What a listing asks. Only an asking price carries an amount into the price history. */
export type ShownPrice =
  | { readonly type: 'asking'; readonly toman: Toman }
  | { readonly type: 'negotiable' }
  | { readonly type: 'placeholder'; readonly toman: Toman };

/** The price a page shows, or undefined when the text is not one this recognises (it is kept, never guessed). */
export function parseShownPrice(text: string): ShownPrice | undefined {
  const words = withoutBidiControls(text).replace(/\s+/g, ' ').trim();
  if (words === 'توافقی' || words === 'قیمت توافقی') return { type: 'negotiable' };
  const toman = readWrittenToman(text);
  if (toman === undefined) return undefined;
  return toman < PLACEHOLDER_BELOW_TOMAN ? { type: 'placeholder', toman } : { type: 'asking', toman };
}

/** Whether two shown prices ask the same: the same type, and the same amount for an asking price. */
export function samePrice(a: ShownPrice, b: ShownPrice): boolean {
  if (a.type !== b.type) return false;
  return a.type === 'asking' && b.type === 'asking' ? a.toman === b.toman : true;
}
