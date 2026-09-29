import type { JobDefinition } from '../runtime/job.ts';

// Every job this worker runs (ADR-0018 point 1). A job is defined in its own file under src/jobs/ with defineJob or
// defineLaneJob and listed here; the runtime creates its queue, or runs it in its source's lane. CS-33 adds the first
// ones (Divar's discovery and details).
export const JOBS: readonly JobDefinition[] = [];
