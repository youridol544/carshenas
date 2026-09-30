import * as z from 'zod';
import { matchListings, suggestDivarNames, syncCodes, syncDivarCatalogue } from '../db/catalogue-store.ts';
import { defineJob, type QueueJobDefinition } from '../runtime/job.ts';

// The catalogue's upkeep (CS-50), every ten minutes and by `pnpm catalogue:sync`: the curated codes and Divar's makes
// and models, the keys new listings brought (trims under their model, or models of their own), Persian names from the
// posts, and every listing's match. No request to any source: it reads only what is stored.

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
): Promise<CatalogueRefresh> {
  await syncCodes(db);
  const catalogue = await syncDivarCatalogue(db, sourceId);
  const named = await suggestDivarNames(db, sourceId);
  const matched = await matchListings(db);
  return { ...catalogue, named, matched };
}

export function catalogueJobs(options: {
  readonly sourceId: string;
  readonly scheduled: boolean;
}): QueueJobDefinition<Record<string, never>> {
  return defineJob({
    name: 'catalogue.refresh',
    payload: z.strictObject({}),
    schedules: options.scheduled ? [{ key: 'every-10-minutes', cron: '*/10 * * * *', payload: {} }] : [],
    async run(_payload, context) {
      const refreshed = await refreshCatalogue(context.db, options.sourceId);
      for (const [name, value] of Object.entries(refreshed)) context.count(name, value);
    },
  });
}
