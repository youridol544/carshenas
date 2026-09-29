// A worker with a job that calls models, started without METIS_API_KEY, for models.test.ts: set up as main.ts sets up
// the real one, it must stop at startModels with one fatal line naming the key, before "worker started".
import { z } from 'zod';
import { memoryAnswerCache } from '@carshenas/ai/answer-cache';
import { installProcessHandlers } from '@carshenas/observability/process';
import { startModels } from '../models.ts';
import { startObservability } from '../observability.ts';
import { defineJob } from '../runtime/job.ts';

const { logger } = startObservability({
  release: 'test',
  environment: 'test',
  level: 'info',
  format: 'json',
  exportTraces: false,
});
installProcessHandlers(logger);

const extraction = defineJob({
  name: 'listing.extract',
  payload: z.object({}),
  callsModels: true,
  run: () => Promise.resolve(),
});
await startModels({ jobs: [extraction], apiKey: undefined, logger, cache: memoryAnswerCache() });
logger.info('worker started');
