import type { JobDefinition } from '../runtime/job.ts';
import { DIVAR_API_URL } from '../sources/divar/api.ts';
import { TRACKED_MODELS } from '../sources/divar/tracked-models.ts';
import { divarFreshnessJobs } from './divar-freshness.ts';
import { divarJobs } from './divar.ts';
import { recheckJobs } from './rechecks.ts';

// Every job this worker runs (ADR-0018 point 1). A job is defined in its own file under src/jobs/ with defineJob or
// defineLaneJob and listed here; the runtime creates its queue, or runs it in its source's lane.

/** Divar's crawl (CS-33): discovery every 15 minutes, listing details, and the measurement `pnpm measure:divar` starts. */
export const DIVAR = divarJobs({
  sourceId: 'divar',
  apiUrl: DIVAR_API_URL,
  trackedModels: TRACKED_MODELS,
  scheduled: true,
});

/**
 * Keeping Divar's listings fresh (CS-35): the tracked models swept every night and the rest every Friday, checks of what
 * a sweep missed, buyers' re-checks, and hourly expiry.
 */
export const DIVAR_FRESHNESS = divarFreshnessJobs({
  sourceId: 'divar',
  apiUrl: DIVAR_API_URL,
  trackedModels: TRACKED_MODELS,
  scheduled: true,
  detail: DIVAR.listing,
});

/** Buyers' re-check requests, drained every minute into each source's re-check job (CS-35, CS-64). */
export const RECHECKS = recheckJobs({
  recheckBySource: new Map([['divar', DIVAR_FRESHNESS.recheck]]),
  scheduled: true,
});

export const JOBS: readonly JobDefinition[] = [...DIVAR.all, ...DIVAR_FRESHNESS.all, RECHECKS];
