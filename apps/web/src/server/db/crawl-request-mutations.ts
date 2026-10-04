import 'server-only';
import { sql } from 'kysely';
import { constraintViolation } from '@carshenas/db/database-errors';
import type { DB, JsonObject } from '@carshenas/db/db-types';
import type { Transaction } from 'kysely';
import { database } from '@/server/db/database';

// What a buyer's ask changes (CS-71, ADR-0036), for the account the caller took from the session. A scope's request is
// made when none exists and found when one does, by an INSERT … ON CONFLICT on its unique key (two buyers asking for
// one model at once get one request), never a read first; the file is then linked to it. Every statement names the
// account through the file it selects, so a file of another buyer is never linked. A limit or a declined request comes
// back as a result, mapped from the constraint's name; the whole ask is one transaction, so a refused one leaves no
// request behind.

export type AskTarget = { readonly modelId: number; readonly trimId: number | null };

export type AskOutcome =
  | { readonly status: 'asked'; readonly count: number }
  | { readonly status: 'gone' }
  | { readonly status: 'declined' }
  | { readonly status: 'file_limit' }
  | { readonly status: 'account_limit' };

/** The scopes' requests made or found, and the file linked to each: inside the caller's transaction, for an owned file. */
async function askWithin(
  trx: Transaction<DB>,
  accountId: number,
  fileId: number,
  targets: readonly AskTarget[],
): Promise<AskOutcome> {
  const owned = await trx
    .selectFrom('search_file')
    .select('id')
    .where('id', '=', fileId)
    .where('account_id', '=', accountId)
    .executeTakeFirst();
  if (owned === undefined) return { status: 'gone' };
  let asked = 0;
  for (const target of targets) {
    // The request of the scope: made now, or the one already there. The insert that loses a race waits for the
    // winner's commit and returns nothing; the second statement, with its own snapshot, then sees the winner's
    // row (a single statement would not: a CTE reads the snapshot it started with).
    const made = await sql<{ id: number }>`
      INSERT INTO crawl_request (model_id, trim_id) VALUES (${target.modelId}, ${target.trimId})
      ON CONFLICT ON CONSTRAINT crawl_request_once_per_scope_unique DO NOTHING
      RETURNING id::int`.execute(trx);
    const { rows } =
      made.rows.length > 0
        ? made
        : await sql<{ id: number }>`
            SELECT id::int FROM crawl_request
            WHERE model_id = ${target.modelId} AND trim_id IS NOT DISTINCT FROM ${target.trimId}`.execute(
            trx,
          );
    const requestId = rows[0]?.id;
    if (requestId === undefined) throw new Error('a crawl request was neither made nor found');
    const linked = await trx
      .insertInto('crawl_request_file')
      .columns(['crawl_request_id', 'search_file_id'])
      .expression((eb) =>
        eb
          .selectFrom('search_file as f')
          .select([sql<number>`${requestId}::bigint`.as('crawl_request_id'), 'f.id'])
          .where('f.id', '=', fileId)
          .where('f.account_id', '=', accountId),
      )
      .onConflict((conflict) => conflict.columns(['crawl_request_id', 'search_file_id']).doNothing())
      .executeTakeFirst();
    asked += Number(linked.numInsertedOrUpdatedRows ?? 0n) > 0 ? 1 : 0;
  }
  return { status: 'asked', count: asked };
}

/** A limit or a declined request, as the result the constraint's name stands for; undefined for any other error. */
function askViolation(error: unknown): AskOutcome | undefined {
  const violation = constraintViolation(error);
  if (violation === undefined || !('constraint' in violation)) return undefined;
  switch (violation.constraint) {
    case 'crawl_request_file_not_declined':
      return { status: 'declined' };
    case 'crawl_request_per_file_limit':
      return { status: 'file_limit' };
    case 'crawl_request_per_account_limit':
      return { status: 'account_limit' };
    default:
      return undefined;
  }
}

export async function askForCrawl(
  accountId: number,
  fileId: number,
  targets: readonly AskTarget[],
): Promise<AskOutcome> {
  try {
    return await database()
      .transaction()
      .execute((trx) => askWithin(trx, accountId, fileId, targets));
  } catch (error) {
    const outcome = askViolation(error);
    if (outcome === undefined) throw error;
    return outcome;
  }
}

export type AskFromLinkOutcome =
  | { readonly status: 'asked'; readonly count: number; readonly fileId: number; readonly madeFile: boolean }
  | { readonly status: 'declined' }
  | { readonly status: 'file_limit' }
  /** The account keeps the most files it may (search_file_per_account_limit) and has none for this model. */
  | { readonly status: 'no_room_for_file' }
  | { readonly status: 'account_limit' };

/**
 * A buyer asks for a model from a pasted link (CS-115, ADR-0046): the buyer's own search file for the model is found, or
 * made when there is none (the requests of CS-71 hang on files: demand is the files' accounts, and the answer to the
 * request reaches the buyer through the file), and the model's request is made or found and linked to it, all in one
 * transaction, so a refused ask leaves no file and no request behind. The file is the buyer's own: the account comes from
 * the session, and a file of another account is never linked. The limits are the database's (30 files an account, 10
 * requests waiting an account, 3 a file, none joining a declined request), mapped from the constraints' names.
 */
export async function askForModelFromLink(
  accountId: number,
  modelId: number,
  file: { readonly name: string; readonly search: JsonObject },
): Promise<AskFromLinkOutcome> {
  try {
    return await database()
      .transaction()
      .execute(async (trx): Promise<AskFromLinkOutcome> => {
        // The file the buyer already keeps for this search, else a new one: the unique key decides a race (the same
        // buyer pressing twice), and the existing file is read first only because the limit trigger runs before the
        // unique check and would refuse a buyer at the limit who already has the file.
        let fileId: number | undefined;
        let madeFile = false;
        const existing = await trx
          .selectFrom('search_file')
          .select('id')
          .where('account_id', '=', accountId)
          .where('search', '=', file.search)
          .executeTakeFirst();
        fileId = existing?.id;
        if (fileId === undefined) {
          const inserted = await trx
            .insertInto('search_file')
            .values({ account_id: accountId, name: file.name, search: file.search })
            .onConflict((conflict) => conflict.constraint('search_file_once_per_search_unique').doNothing())
            .returning('id')
            .executeTakeFirst();
          madeFile = inserted !== undefined;
          fileId =
            inserted?.id ??
            (
              await trx
                .selectFrom('search_file')
                .select('id')
                .where('account_id', '=', accountId)
                .where('search', '=', file.search)
                .executeTakeFirstOrThrow()
            ).id;
        }
        const outcome = await askWithin(trx, accountId, fileId, [{ modelId, trimId: null }]);
        if (outcome.status === 'asked') return { ...outcome, fileId, madeFile };
        if (outcome.status === 'gone') throw new Error('the buyer file vanished inside the ask');
        return outcome;
      });
  } catch (error) {
    const violation = constraintViolation(error);
    if (
      violation !== undefined &&
      'constraint' in violation &&
      violation.constraint === 'search_file_per_account_limit'
    ) {
      return { status: 'no_room_for_file' };
    }
    const outcome = askViolation(error);
    if (outcome === undefined || outcome.status === 'gone' || outcome.status === 'asked') throw error;
    return outcome;
  }
}
