import 'server-only';
import { constraintViolation } from '@carshenas/db/database-errors';
import type { ChangeSourceStateForm } from '@/features/admin/admin-schemas';
import type { SourceStateOutcome } from '@/features/admin/admin-types';
import { adminDatabase } from '@/server/db/admin-database';

// A person pauses or resumes a source (CS-40, ADR-0023). The section's role cannot update a source; it asks
// change_source_state(), which checks the superadmin, compares the source with what the page showed, applies the
// choice and records it, in one transaction. The stop the page showed goes back as the database's own text.

type FunctionOutcome = Exclude<SourceStateOutcome, 'not_crawled'>;

export async function changeSourceState(
  form: ChangeSourceStateForm,
  superadminId: number,
): Promise<SourceStateOutcome> {
  try {
    const { outcome } = await adminDatabase()
      .selectNoFrom((eb) =>
        eb
          .fn<FunctionOutcome>('change_source_state', [
            eb.val(form.sourceId),
            eb.val(form.seenState),
            eb.val(form.seenStoppedAt),
            eb.val(form.chosen),
            eb.val(superadminId),
          ])
          .as('outcome'),
      )
      .executeTakeFirstOrThrow();
    return outcome;
  } catch (error) {
    const violation = constraintViolation(error);
    // Only a crawled source may leave the paused state; the page offers no control for any other.
    if (
      violation !== undefined &&
      'constraint' in violation &&
      violation.constraint === 'source_only_crawled_sources_run'
    ) {
      return 'not_crawled';
    }
    throw error;
  }
}
