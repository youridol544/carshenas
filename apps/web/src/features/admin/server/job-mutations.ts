import 'server-only';
import type { ChangeJobStateForm } from '@/features/admin/admin-schemas';
import type { JobStateOutcome } from '@/features/admin/admin-types';
import { adminDatabase } from '@/server/db/admin-database';

// A person retries or cancels a job (CS-41, ADR-0023). The section's role cannot write pg-boss's tables; it asks
// change_job_state(), which checks the superadmin, compares the job with the state the page showed, applies pg-boss's
// own retry or cancel and records it, in one transaction.

export async function changeJobState(
  form: ChangeJobStateForm,
  superadminId: number,
): Promise<JobStateOutcome> {
  const { outcome } = await adminDatabase()
    .selectNoFrom((eb) =>
      eb
        .fn<JobStateOutcome>('change_job_state', [
          eb.val(form.queue),
          eb.val(form.jobId),
          eb.val(form.seenState),
          eb.val(form.action),
          eb.val(superadminId),
        ])
        .as('outcome'),
    )
    .executeTakeFirstOrThrow();
  return outcome;
}
