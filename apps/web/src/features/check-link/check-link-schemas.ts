import * as z from 'zod';
import { MAX_PASTE_LENGTH } from '@/lib/pasted-link';

// What the ask accepts (every argument is hostile: the Next.js data-security guide). The link is the address the answer
// page was asked for; the server reads the car from it again, so the model never comes from the client alone: the chooser's
// model key is only taken for a link that names a make, and is checked against that make.

const MODEL_KEY = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/;

export const askToAddModelSchema = z.strictObject({
  link: z.string().min(1).max(MAX_PASTE_LENGTH),
  modelKey: z.string().max(120).regex(MODEL_KEY).optional(),
});

export type AskToAddModelInput = z.input<typeof askToAddModelSchema>;
