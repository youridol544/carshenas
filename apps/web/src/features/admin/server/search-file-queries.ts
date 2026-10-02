import 'server-only';
import type { ReadonlyKysely } from 'kysely/readonly';
import type { DB } from '@carshenas/db/db-types';
import { nameOnScreen } from '@carshenas/locale/names';
import type { LabelOf } from '@carshenas/search/kinds';
import { describeSearch, fromStoredSearch } from '@carshenas/search/search';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';
import { countFileMatches } from '@/server/db/search-file-matches';
import { captureError } from '@/server/observability/logger';

// Every buyer's search files, for the superadmin (CS-70 #5), through the section's own role (ADR-0023): the buyer by
// username (accounts keep no phone number), the search as the chips the search page shows, its state, and how many cars
// match it now, counted by the same function the buyer's own pages use. The latest hundred files, newest first; the
// totals say how many there are. It asks for the superadmin itself: a page is never the guard (ADR-0020 point 10).

/** How many files the screen lists. */
export const ADMIN_FILES_LIMIT = 100;
/** A match count stops at this many, as a buyer's does. */
const COUNT_CAP = 1_000;

export type AdminSearchFile = {
  id: number;
  buyer: string;
  name: string;
  state: 'watching' | 'paused' | 'closed';
  createdAt: string;
  /** The search as chips; empty when the stored search no longer fits this build. */
  chips: string[];
  readable: boolean;
  counts: { matches: { count: number; exact: boolean }; newCount: number } | null;
};

export type AdminSearchFiles = { files: AdminSearchFile[]; totalFiles: number; totalBuyers: number };

/** The names of the catalogue's makes, models, body types and places, from the counts the worker keeps. */
async function readLabelOf(): Promise<LabelOf> {
  const rows = await readAdminDatabase()
    .selectFrom('search_facet_count')
    .select(['facet', 'value', 'label_fa'])
    .where('facet', 'not in', ['total', 'seen', 'catalogue'])
    .execute();
  const names = new Map(rows.map((row) => [`${row.facet}:${row.value}`, nameOnScreen(row.label_fa)]));
  return (filterId, value) => names.get(`${filterId}:${value}`);
}

export async function loadAdminSearchFiles(): Promise<AdminSearchFiles> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  // The section's read-only view of the public schema, as the package's counting function types it.
  const publicSchema = database as unknown as ReadonlyKysely<DB>;
  const [rows, totals, labelOf] = await Promise.all([
    database
      .selectFrom('search_file as f')
      .innerJoin('account as a', 'a.id', 'f.account_id')
      .select(['f.id', 'a.username', 'f.name', 'f.status', 'f.created_at', 'f.search'])
      .orderBy('f.created_at', 'desc')
      .orderBy('f.id', 'desc')
      .limit(ADMIN_FILES_LIMIT)
      .execute(),
    database
      .selectFrom('search_file')
      .select((eb) => [
        eb.fn.countAll<number>().as('files'),
        eb.fn.count<number>('account_id').distinct().as('buyers'),
      ])
      .executeTakeFirstOrThrow(),
    readLabelOf(),
  ]);
  const files = await Promise.all(
    rows.map(async (row): Promise<AdminSearchFile> => {
      const common = {
        id: row.id,
        buyer: row.username,
        name: row.name,
        state: row.status,
        createdAt: row.created_at.toISOString(),
      };
      const parsed = fromStoredSearch(row.search);
      if (!parsed.success) return { ...common, chips: [], readable: false, counts: null };
      const chips = describeSearch(parsed.data, labelOf);
      try {
        return {
          ...common,
          chips,
          readable: true,
          counts: await countFileMatches(publicSchema, row.id, parsed.data, COUNT_CAP),
        };
      } catch (error) {
        captureError(error, { message: 'counting a search file failed', fields: { fileId: row.id } });
        return { ...common, chips, readable: true, counts: null };
      }
    }),
  );
  return { files, totalFiles: totals.files, totalBuyers: totals.buyers };
}
