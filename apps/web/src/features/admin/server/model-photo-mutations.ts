import 'server-only';
import type { ModelPhotoForm } from '@/features/admin/model-photo-schemas';
import type { PhotoOutcome } from '@/features/admin/model-photo-types';
import { adminDatabase } from '@/server/db/admin-database';

// A person sets, replaces or clears a model's photo link (CS-97, ADR-0038, ADR-0023). The section's role cannot write
// model_photo_link; it asks set_model_photo_link(), which checks the superadmin, applies the table's own rules to the
// address and records who and when in the same transaction. The address is only stored: nothing is fetched from it.

export async function setModelPhotoLink(form: ModelPhotoForm, superadminId: number): Promise<PhotoOutcome> {
  const { outcome } = await adminDatabase()
    .selectNoFrom((eb) =>
      eb
        .fn<PhotoOutcome>('set_model_photo_link', [
          eb.val(form.modelId),
          eb.val(form.url),
          eb.val(superadminId),
        ])
        .as('outcome'),
    )
    .executeTakeFirstOrThrow();
  return outcome;
}
