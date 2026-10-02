import * as z from 'zod';

// The request of POST /api/search/understand: the sentence as typed. Longer than the 200 characters the understanding
// reads, so a pasted paragraph is cut by the understanding and told to the buyer (the `cut` notice) rather than
// refused; the cap here only keeps a request small.

export const MAX_TYPED_CHARACTERS = 1_000;

export const understandRequestSchema = z.strictObject({
  q: z.string().trim().min(1).max(MAX_TYPED_CHARACTERS),
});
export type UnderstandRequest = z.output<typeof understandRequestSchema>;
