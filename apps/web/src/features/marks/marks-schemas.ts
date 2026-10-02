import * as z from 'zod';

// What the mark action accepts (every argument is hostile: the Next.js data-security guide): a listing id in the range
// of a bigint the driver reads as a JavaScript number, and the state the buyer wants, never a toggle, so a second
// press or a retry after a lost answer changes nothing. Whose mark it is comes from the session.

export const setMarkSchema = z.strictObject({
  listingId: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  marked: z.boolean(),
});

export type SetMarkInput = z.infer<typeof setMarkSchema>;
