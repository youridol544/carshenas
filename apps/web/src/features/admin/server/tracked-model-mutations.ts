import 'server-only';
import type { ChangeTrackedForm } from '@/features/admin/tracked-model-schemas';
import type { ChangeOutcome } from '@/features/admin/tracked-model-types';
import { adminDatabase } from '@/server/db/admin-database';

// A person tracks, pauses, resumes, re-prioritises or untracks a model (CS-53, ADR-0037, ADR-0023). The section's role
// cannot write tracked_model; it asks change_tracked_model(), which checks the superadmin, changes the row and records
// who and when in the same transaction. The target is stated, never a toggle, so a second press changes nothing. The
// change reads nothing from any source: what the worker does with it is its own, at its next run.

export async function changeTrackedModel(
  form: ChangeTrackedForm,
  superadminId: number,
): Promise<ChangeOutcome> {
  const { outcome } = await adminDatabase()
    .selectNoFrom((eb) =>
      eb
        .fn<ChangeOutcome>('change_tracked_model', [
          eb.val(form.modelId),
          eb.val(form.trimId),
          eb.val(form.action),
          eb.val(form.priority),
          eb.val(superadminId),
        ])
        .as('outcome'),
    )
    .executeTakeFirstOrThrow();
  return outcome;
}
