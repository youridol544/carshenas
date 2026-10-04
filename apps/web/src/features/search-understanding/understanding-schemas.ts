import * as z from 'zod';
import { MAX_SENTENCE_CHARACTERS } from '@/lib/search-sentence';

// The request of POST /api/search/understand: the sentence as typed. Longer than the 200 characters the understanding
// reads, so a pasted paragraph is cut by the understanding and told to the buyer (the `cut` notice) rather than
// refused; the cap here only keeps a request small.

export const MAX_TYPED_CHARACTERS = MAX_SENTENCE_CHARACTERS;

export const understandRequestSchema = z.strictObject({
  q: z.string().trim().min(1).max(MAX_TYPED_CHARACTERS),
});
export type UnderstandRequest = z.output<typeof understandRequestSchema>;

// What the box sends the action (CS-111): the sentence in the field, the example sentence of the chip that was pressed
// when one was, and `by` = 'script' when the page's own script sent it and will navigate itself (a form sent before
// the script loaded has no `by` and is redirected). Any may be missing; none is trusted for its length, which the
// action cuts.
export const askFormSchema = z.object({
  ask: z.string().optional(),
  example: z.string().optional(),
  by: z.string().optional(),
});
export type AskForm = z.output<typeof askFormSchema>;
