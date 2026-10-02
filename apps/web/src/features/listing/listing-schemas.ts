import * as z from 'zod';

// What the listing page's action and route accept (every argument is hostile). An id is a positive whole number within
// the range of a bigint the driver reads as a JavaScript number.

export const listingId = z.int().min(1).max(Number.MAX_SAFE_INTEGER);
export const recheckSchema = z.strictObject({ id: listingId });
