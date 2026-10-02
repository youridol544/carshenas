import 'server-only';
import { constraintViolation } from '@carshenas/db/database-errors';
import type { JsonObject } from '@carshenas/db/db-types';
import type { SearchFileState } from '@/features/search-files/search-files-rules';
import { database } from '@/server/db/database';
import { databaseNow, previousLookAfterLook } from '@/server/db/sql-helpers';

// What a buyer changes in their search files (CS-70, ADR-0031), for the account the caller took from the session:
// every statement names it, so a file of another account is simply not found. The web role may insert a file (its
// state starts as watching), rename it, move it between the states, record a look and delete it; never change a search
// or an owner (grants in the migration). A rule the database holds comes back as a result, mapped by its constraint's
// name, never read first to check. Each write sets a target state, so a second press changes nothing.

export type InsertOutcome =
  | { readonly status: 'created'; readonly id: number }
  /** The same search is already one of the account's files (search_file_once_per_search_unique). */
  | { readonly status: 'exists' }
  /** The account has the most files it may keep (search_file_per_account_limit). */
  | { readonly status: 'limit' }
  /** A name or a search the table's checks refuse (search_file_name_format, _search_stored_form, _search_small). */
  | { readonly status: 'invalid'; readonly field: 'name' | 'search' };

/** Makes a file from an already validated name and stored search. */
export async function insertSearchFile(
  accountId: number,
  name: string,
  stored: JsonObject,
): Promise<InsertOutcome> {
  try {
    const row = await database()
      .insertInto('search_file')
      .values({ account_id: accountId, name, search: stored })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { status: 'created', id: row.id };
  } catch (error) {
    const violation = constraintViolation(error);
    if (violation === undefined || !('constraint' in violation)) throw error;
    switch (violation.constraint) {
      case 'search_file_once_per_search_unique':
        return { status: 'exists' };
      case 'search_file_per_account_limit':
        return { status: 'limit' };
      case 'search_file_name_format':
        return { status: 'invalid', field: 'name' };
      case 'search_file_search_stored_form':
      case 'search_file_search_small':
        return { status: 'invalid', field: 'search' };
      default:
        throw error;
    }
  }
}

/** Renames one of the account's files; false when there is no such file. */
export async function renameSearchFile(accountId: number, id: number, name: string): Promise<boolean> {
  const result = await database()
    .updateTable('search_file')
    .set({ name })
    .where('account_id', '=', accountId)
    .where('id', '=', id)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

/**
 * Moves one of the account's files to a state; false when there is no such file. A file already in the state is left
 * as it is, so the time of its change stays the time of the real one.
 */
export async function setSearchFileState(
  accountId: number,
  id: number,
  state: SearchFileState,
): Promise<boolean> {
  const db = database();
  const changed = await db
    .updateTable('search_file')
    .set({ status: state, status_changed_at: databaseNow() })
    .where('account_id', '=', accountId)
    .where('id', '=', id)
    .where('status', '<>', state)
    .executeTakeFirst();
  if (changed.numUpdatedRows > 0n) return true;
  const existing = await db
    .selectFrom('search_file')
    .select('id')
    .where('account_id', '=', accountId)
    .where('id', '=', id)
    .executeTakeFirst();
  return existing !== undefined;
}

/** Records that the buyer looked at the file now: what Carshenas first saw before this is no longer new. */
export async function markSearchFileViewed(accountId: number, id: number): Promise<void> {
  await database()
    .updateTable('search_file')
    .set({ viewed_at: databaseNow(), previous_viewed_at: previousLookAfterLook() })
    .where('account_id', '=', accountId)
    .where('id', '=', id)
    .execute();
}

/** Deletes one of the account's files; false when there is no such file. */
export async function deleteSearchFile(accountId: number, id: number): Promise<boolean> {
  const result = await database()
    .deleteFrom('search_file')
    .where('account_id', '=', accountId)
    .where('id', '=', id)
    .executeTakeFirst();
  return result.numDeletedRows > 0n;
}
