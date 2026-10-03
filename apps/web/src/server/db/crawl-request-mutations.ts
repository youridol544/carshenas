import 'server-only';
import { sql } from 'kysely';
import { constraintViolation } from '@carshenas/db/database-errors';
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

export async function askForCrawl(
  accountId: number,
  fileId: number,
  targets: readonly AskTarget[],
): Promise<AskOutcome> {
  try {
    return await database()
      .transaction()
      .execute(async (trx): Promise<AskOutcome> => {
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
      });
  } catch (error) {
    const violation = constraintViolation(error);
    if (violation === undefined || !('constraint' in violation)) throw error;
    switch (violation.constraint) {
      case 'crawl_request_file_not_declined':
        return { status: 'declined' };
      case 'crawl_request_per_file_limit':
        return { status: 'file_limit' };
      case 'crawl_request_per_account_limit':
        return { status: 'account_limit' };
      default:
        throw error;
    }
  }
}
