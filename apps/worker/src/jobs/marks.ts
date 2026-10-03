import * as z from 'zod';
import { notifyMarkEvents } from '../db/mark-store.ts';
import { defineJob, type QueueJobDefinition } from '../runtime/job.ts';

// Telling buyers about the listings they marked (CS-69, ADR-0026): every two minutes, price drops recorded since each mark
// was last handled, and listings that left the market or came back, become inbox notifications through the shared helper.
// It reads only what the crawl and the freshness work already stored and sends no request to any source, so it runs on a
// queue of its own, never in a source's lane. Running twice is harmless: an event notifies a buyer once.

export type MarkJobOptions = {
  /** Whether it runs every two minutes by itself; the tests send it. */
  readonly scheduled: boolean;
  /** Events read per transaction. */
  readonly batch?: number;
};

export function markJobs(options: MarkJobOptions): QueueJobDefinition<Record<string, never>> {
  const batch = options.batch ?? 500;
  return defineJob({
    name: 'marks.notify',
    payload: z.strictObject({}),
    schedules: options.scheduled ? [{ key: 'every-two-minutes', cron: '*/2 * * * *', payload: {} }] : [],
    // A tick that is still queued when the next one is due is stale work.
    retentionDays: 1,
    async run(_payload, context) {
      for (;;) {
        if (context.signal.aborted) return;
        const run = await notifyMarkEvents(context.db, batch);
        context.count('price_drops', run.priceDrops);
        context.count('off_market', run.offMarket);
        context.count('relisted', run.relisted);
        context.count('skipped', run.skipped);
        if (!run.more) return;
      }
    },
  });
}
