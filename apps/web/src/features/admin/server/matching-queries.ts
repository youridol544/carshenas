import 'server-only';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';

// The matching job's runs, for the superadmin (CS-72 #4): when each ran, how long it took and how many buyers it told,
// read from what pg-boss keeps of the job's own output (its counts, written by the worker). The latest runs that did
// something and the latest runs of any kind, so a quiet hour does not push the last real one off the list.

export const MATCHING_RUNS_SHOWN = 8;

export type MatchingRun = {
  readonly at: string;
  readonly milliseconds: number;
  readonly files: number;
  readonly notified: number;
  readonly newListings: number;
  readonly drops: number;
  readonly deferred: number;
};

function counted(counts: unknown, name: string): number {
  if (typeof counts !== 'object' || counts === null) return 0;
  const value = (counts as Record<string, unknown>)[name];
  return typeof value === 'number' ? value : 0;
}

export async function loadMatchingRuns(): Promise<MatchingRun[]> {
  await requireSuperadmin();
  const rows = await readAdminDatabase()
    .selectFrom('pgboss.job')
    .select(['completed_on', 'output'])
    .where('name', '=', 'search.match')
    .where('state', '=', 'completed')
    .orderBy('completed_on', 'desc')
    .limit(MATCHING_RUNS_SHOWN)
    .execute();
  return rows.flatMap((row): MatchingRun[] => {
    if (row.completed_on === null) return [];
    const counts =
      typeof row.output === 'object' && row.output !== null
        ? (row.output as Record<string, unknown>).counts
        : undefined;
    return [
      {
        at: row.completed_on.toISOString(),
        milliseconds: counted(counts, 'milliseconds'),
        files: counted(counts, 'files'),
        notified: counted(counts, 'notified'),
        newListings: counted(counts, 'newListings'),
        drops: counted(counts, 'drops'),
        deferred: counted(counts, 'deferred'),
      },
    ];
  });
}
