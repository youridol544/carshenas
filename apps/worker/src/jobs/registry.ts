import type { JobDefinition } from '../runtime/job.ts';
import { DIVAR_API_URL } from '../sources/divar/api.ts';
import { TRACKED_MODELS } from '../sources/divar/tracked-models.ts';
import { divarJobs } from './divar.ts';

// Every job this worker runs (ADR-0018 point 1). A job is defined in its own file under src/jobs/ with defineJob or
// defineLaneJob and listed here; the runtime creates its queue, or runs it in its source's lane.

/** Divar's crawl (CS-33): discovery every 15 minutes, listing details, and the measurement `pnpm measure:divar` starts. */
export const DIVAR = divarJobs({
  sourceId: 'divar',
  apiUrl: DIVAR_API_URL,
  trackedModels: TRACKED_MODELS,
  scheduled: true,
});

export const JOBS: readonly JobDefinition[] = [...DIVAR.all];
