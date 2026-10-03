import * as z from 'zod';
import { MAX_DECLINE_REASON_LENGTH } from '@/lib/crawl-requests-rules';

// What the decision form sends (every field is hostile): the request, the state the page showed, the choice and, for a
// decline, the reason. A reason is trimmed to one line of plain text of 1 to 300 characters, as the table's own checks
// require (crawl_request_decline_reason_format and _plain); a decline without one is refused here and again there.

// The bidi marks, controls and zero-width characters crawl_request_decline_reason_plain refuses (the joiner-less
// non-joiner is allowed: Persian needs it).
const UNWANTED = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f)}-${String.fromCharCode(0x9f)}${String.fromCharCode(0xad, 0x61c, 0x200b, 0x200e, 0x200f, 0x2028, 0x2029, 0x2060, 0xfeff)}${String.fromCharCode(0x202a)}-${String.fromCharCode(0x202e)}${String.fromCharCode(0x2066)}-${String.fromCharCode(0x2069)}]`,
  'u',
);

function formText() {
  return z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string());
}

const decideSchema = z
  .object({
    requestId: formText().pipe(z.string().regex(/^[1-9]\d{0,15}$/)),
    seenState: formText().pipe(z.enum(['pending', 'approved', 'declined'])),
    decision: formText().pipe(z.enum(['approved', 'declined'])),
    reason: formText().transform((text) => text.replace(/\s+/g, ' ').trim()),
  })
  .refine((form) => form.decision !== form.seenState)
  .refine((form) =>
    form.decision === 'approved'
      ? form.reason === ''
      : form.reason.length >= 1 &&
        form.reason.length <= MAX_DECLINE_REASON_LENGTH &&
        !UNWANTED.test(form.reason),
  );

export type DecideCrawlRequestForm = {
  requestId: number;
  seenState: 'pending' | 'approved' | 'declined';
  decision: 'approved' | 'declined';
  /** The decline's reason; null for an approval. */
  reason: string | null;
};

/** Reads the decision form; anything that is not a form this screen rendered comes back as undefined. */
export function readDecideCrawlRequestForm(formData: FormData): DecideCrawlRequestForm | undefined {
  const parsed = decideSchema.safeParse({
    requestId: formData.get('requestId'),
    seenState: formData.get('seenState'),
    decision: formData.get('decision'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return undefined;
  const { requestId, seenState, decision, reason } = parsed.data;
  const id = Number(requestId);
  if (!Number.isSafeInteger(id)) return undefined;
  return { requestId: id, seenState, decision, reason: decision === 'declined' ? reason : null };
}
