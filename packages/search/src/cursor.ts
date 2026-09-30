// A results page's continuation as one opaque URL-safe word (CS-59): the order it belongs to and the last row's sort
// key. A cursor from another order, a changed schema or a hand-edited URL is refused, never guessed: the caller starts
// from the first page. Runs in the browser and in Node.
import { z } from 'zod';
import type { SortKey } from './sql.ts';
import { DEFAULT_SORT, SORT_IDS, sortById, type SortId } from './sorts.ts';

const CursorSchema = z.strictObject({
  v: z.literal(1),
  s: z.enum(SORT_IDS),
  k: z.array(z.string().max(64).nullable()).max(8),
  i: z.int().positive(),
});

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(word: string): string | undefined {
  if (!/^[A-Za-z0-9_-]{1,400}$/.test(word)) return undefined;
  try {
    const binary = atob(word.replaceAll('-', '+').replaceAll('_', '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    );
  } catch {
    return undefined;
  }
}

/** The cursor of the page after the row with this key, in this order. */
export function encodeCursor(sortId: SortId | undefined, key: SortKey): string {
  return toBase64Url(JSON.stringify({ v: 1, s: sortId ?? DEFAULT_SORT, k: key.values, i: key.listingId }));
}

/** The key a cursor carries, when it was made for this order; undefined for anything else. */
export function decodeCursor(word: string, sortId: SortId | undefined): SortKey | undefined {
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
  return { values: parsed.data.k, listingId: parsed.data.i };
}
