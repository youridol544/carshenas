import { EXTRACTION } from '../jobs/registry.ts';

// Prints how the job registry schedules extraction under the environment this process was started with
// (jobs/extraction-schedule.test.ts starts it with and without EXTRACTION_SCHEDULED).
process.stdout.write(JSON.stringify({ schedules: EXTRACTION.schedules ?? [] }));
