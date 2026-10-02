import * as z from 'zod';

// What the listing page's action and route accept (every argument is hostile). An id is a positive whole number within
// the range of a bigint the driver reads as a JavaScript number.

export const listingId = z.int().min(1).max(Number.MAX_SAFE_INTEGER);
export const recheckSchema = z.strictObject({ id: listingId });

/** The id in an address segment: Latin digits only, so «۱۲» and «1e3» and «+5» are not listings. */
export function readListingId(segment: string): number | undefined {
  if (!/^[1-9]\d{0,15}$/.test(segment)) return undefined;
  const parsed = listingId.safeParse(Number(segment));
  return parsed.success ? parsed.data : undefined;
}
