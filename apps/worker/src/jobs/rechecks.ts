import * as z from 'zod';
import { claimPendingRechecks, handleRecheck } from '../db/recheck-store.ts';
import { defineJob, type LaneJobDefinition, type QueueJobDefinition } from '../runtime/job.ts';

// Buyers' re-checks (CS-35 criterion 5, for CS-64; ADR-0017 points 3 and 8): the listing page records a request, and
// this job turns each pending one into a re-check job in its source's lane, which goes through the same per-host queue,
// floor and budget as every other request. A listing whose own page was read within the freshness window (six hours),
// or that has left the market, gets nothing sent; the request says so.

export type RecheckOptions = {
  /** Each source's re-check job, by source id. */
  readonly recheckBySource: ReadonlyMap<string, LaneJobDefinition<{ token: string }>>;
  /** Whether it runs every minute by itself; the tests send it. */
  readonly scheduled: boolean;
  /** Requests handled per run. */
  readonly batch?: number;
};

export function recheckJobs(options: RecheckOptions): QueueJobDefinition<Record<string, never>> {
  const batch = options.batch ?? 100;
  return defineJob({
    name: 'listing.drain-rechecks',
    payload: z.strictObject({}),
    schedules: options.scheduled ? [{ key: 'every-minute', cron: '* * * * *', payload: {} }] : [],
    async run(_payload, context) {
      await context.db.transaction().execute(async (trx) => {
        const sources = [...options.recheckBySource.keys()];
        for (const request of await claimPendingRechecks(trx, sources, batch)) {
          if (request.offMarket) {
            await handleRecheck(trx, request.requestId, 'off_market');
            context.count('offMarket');
            continue;
          }
          if (request.fresh) {
            await handleRecheck(trx, request.requestId, 'fresh');
            context.count('fresh');
            continue;
          }
          const recheck = options.recheckBySource.get(request.sourceId);
          if (!recheck) continue;
          await context.enqueue(recheck, { token: request.key }, { transaction: trx });
          await handleRecheck(trx, request.requestId, 'queued');
          context.count('queued');
        }
      });
    },
  });
}
