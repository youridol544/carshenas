import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

// The inbox's retention (ADR-0026 point 6; table notification): notifications read long ago, and any very old one,
// are deleted in batches, so one night's backlog never holds a long transaction.

export type PruneRules = {
  /** Days a read notification is kept after it was read. */
  readonly readKeptDays: number;
  /** Days any notification is kept after it was created. */
  readonly anyKeptDays: number;
  /** Rows deleted per statement. */
  readonly batch: number;
};

/** Deletes one batch of expired notifications and returns how many went; fewer than the batch means none are left. */
export async function pruneNotificationBatch(db: Kysely<DB>, rules: PruneRules): Promise<number> {
  const result = await sql`
    DELETE FROM notification
    WHERE id IN (
      SELECT id FROM notification
      WHERE read_at < now() - make_interval(days => ${rules.readKeptDays})
         OR created_at < now() - make_interval(days => ${rules.anyKeptDays})
      LIMIT ${rules.batch})`.execute(db);
  return Number(result.numAffectedRows ?? 0);
}
