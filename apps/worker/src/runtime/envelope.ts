import * as z from 'zod';

// What the runtime stores as a pg-boss job's data: the job's kind and payload, and a little about where it came from.
// A lane's queue holds several kinds, so the kind travels with the payload; every queue uses the same shape. Stored
// JSON is outside input (a deploy may have changed the code since it was written), so it is parsed on every claim.

export const jobEnvelopeSchema = z.strictObject({
  kind: z.string().min(1),
  payload: z.unknown(),
  meta: z.strictObject({
    /** The job that enqueued this one, and its trace, so a follow-up job's lines lead back to its cause. */
    parentJobId: z.string().optional(),
    parentTraceId: z.string().optional(),
    /** How many times the job went back to the queue because its lane could not send (not failures). */
    putBacks: z.int().min(0).optional(),
  }),
});

export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;
