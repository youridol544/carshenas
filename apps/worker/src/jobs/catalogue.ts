import * as z from 'zod';
import { matchListings, refreshDivarCatalogue, syncCodes } from '../db/catalogue-store.ts';
import { defineJob, type QueueJobDefinition } from '../runtime/job.ts';

// The catalogue's upkeep (CS-50), every ten minutes and by `pnpm catalogue:sync`: the curated codes, makes and models
// (once per process: they change only with the code, which restarts the worker), the keys new listings brought (trims
// under their model, or models of their own), Persian names from the posts, and every listing's match. No request to
// any source: it reads only what is stored.

export type CatalogueRefresh = {
  readonly makes: number;
  readonly models: number;
  readonly trimsLearned: number;
  readonly modelsLearned: number;
  readonly named: number;
  readonly matched: number;
};

export async function refreshCatalogue(
  db: Parameters<typeof syncCodes>[0],
  sourceId: string,
  options: { readonly curated: boolean } = { curated: true },
): Promise<CatalogueRefresh> {
  if (options.curated) await syncCodes(db);
  const catalogue = await refreshDivarCatalogue(db, sourceId, options);
  const matched = await matchListings(db);
  return { ...catalogue, matched };
}

export function catalogueJobs(options: {
  readonly sourceId: string;
  readonly scheduled: boolean;
}): QueueJobDefinition<Record<string, never>> {
  let curatedSynced = false;
  return defineJob({
    name: 'catalogue.refresh',
    payload: z.strictObject({}),
    schedules: options.scheduled ? [{ key: 'every-10-minutes', cron: '*/10 * * * *', payload: {} }] : [],
    async run(_payload, context) {
      const refreshed = await refreshCatalogue(context.db, options.sourceId, { curated: !curatedSynced });
      curatedSynced = true;
      for (const [name, value] of Object.entries(refreshed)) context.count(name, value);
    },
  });
}
