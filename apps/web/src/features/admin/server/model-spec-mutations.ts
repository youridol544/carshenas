import 'server-only';
import type { ModelSpecForm } from '@/features/admin/model-spec-schemas';
import type { SpecOutcome } from '@/features/admin/model-spec-types';
import { adminDatabase } from '@/server/db/admin-database';

// A person sets, changes or removes the engine volume and origin of a model or one of its trims (CS-99, ADR-0039,
// ADR-0023). The section's role cannot write model_spec; it asks set_model_spec(), which checks the superadmin, applies
// the table's own rules to the values and records who and when, with the earlier values, in the same transaction.

export async function setModelSpec(form: ModelSpecForm, superadminId: number): Promise<SpecOutcome> {
  const { outcome } = await adminDatabase()
    .selectNoFrom((eb) =>
      eb
        .fn<SpecOutcome>('set_model_spec', [
          eb.val(form.modelId),
          eb.val(form.trimId),
          eb.val(form.volumeCc),
          eb.val(form.origin),
          eb.val(superadminId),
        ])
        .as('outcome'),
    )
    .executeTakeFirstOrThrow();
  return outcome;
}
