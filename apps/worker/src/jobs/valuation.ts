import * as z from 'zod';
import { tehranIsoDate } from '@carshenas/locale/format-date';
import { defineJob, type QueueJobDefinition } from '../runtime/job.ts';
import { runValuation } from '../valuation/run.ts';

// The daily market values and deal ratings (CS-51, docs/specs/S01-deal-ratings.md): at 04:00 Tehran time, after the
// night's sweep of the tracked models, for that Tehran day. No request to any source: it reads only what is stored.
// A rerun of the same day replaces its run.

export type ValuationPayload = { readonly asOfDate?: string | undefined };

export function valuationJobs(options: {
  readonly scheduled: boolean;
}): QueueJobDefinition<ValuationPayload> {
  return defineJob({
    name: 'valuation.run',
    payload: z.strictObject({
      asOfDate: z.iso.date().optional(),
    }),
    schedules: options.scheduled ? [{ key: 'daily', cron: '0 4 * * *', payload: {} }] : [],
    async run(payload, context) {
      const summary = await runValuation(context.db, payload.asOfDate ?? tehranIsoDate(new Date()));
      for (const [name, value] of Object.entries(summary)) if (name !== 'runId') context.count(name, value);
    },
  });
}
