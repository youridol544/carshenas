import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import * as z from 'zod';
import type { DB } from '@carshenas/db/db-types';
import { createTestSource, jobsOf, openScratchDatabase } from '../db/test-database.ts';
import { startTestWorker } from '../test-support/runtime.ts';
import { until } from '../test-support/wait.ts';
import { defineLaneJob } from './job.ts';
import { laneQueue } from './queues.ts';

// The daily request budget in the lane's lease (CS-35 criteria 4 and 7; ADR-0017 point 5): what comes last in
// ADR-0017's order stops first, no request is ever sent past the budget, a job the budget holds back keeps its
// attempts, and a new Tehran day brings the budget back.

let owner: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
});

after(async () => {
  await owner.destroy();
});

const payload = z.object({ sourceId: z.string(), n: z.int() });

type Sent = { kind: string; n: number };

function requestJobs(sent: Sent[]) {
  const make = (name: string, priority: number) =>
    defineLaneJob({
      name,
      priority,
      payload,
      source: (job) => job.sourceId,
      async run(job, context) {
        await context.lane.request(() => {
          sent.push({ kind: name, n: job.n });
          return Promise.resolve();
        });
      },
    });
  // Discovery's priority, and the untracked sweep's.
  return [make('crawl.test-discover', 60), make('crawl.test-sweep', 10)] as const;
}

async function laneBudget(sourceId: string) {
  return owner
    .selectFrom('crawl_lane')
    .select(['budget_day', 'budget_spent'])
    .where('source_id', '=', sourceId)
    .executeTakeFirstOrThrow();
}

test('a spent budget stops the sweep before discovery, never overspends, and returns with the next Tehran day', async (context) => {
  const sent: Sent[] = [];
  const jobs = requestJobs(sent);
  const [discover, sweep] = jobs;
  const worker = await startTestWorker(jobs);
  context.after(() => worker.stop());
  // Four requests a day, two of them already spent today: the untracked sweep keeps 30 % (two) for the kinds above
  // it, so it may not send; discovery may spend the last two.
  const source = await createTestSource(owner, context, { dailyBudget: 4 });
  await until('the lane exists', () => worker.runtime.lanes().some((lane) => lane.sourceId === source));
  await sql`UPDATE crawl_lane SET budget_day = (now() AT TIME ZONE 'Asia/Tehran')::date, budget_spent = 2
            WHERE source_id = ${source}`.execute(owner);
  await until('the lane claims only the kinds the budget still covers', () =>
    worker.runtime.lanes().some((lane) => lane.sourceId === source && lane.minPriority === 20),
  );

  for (let n = 0; n < 2; n++) await worker.runtime.enqueue(sweep, { sourceId: source, n });
  for (let n = 0; n < 2; n++) await worker.runtime.enqueue(discover, { sourceId: source, n });
  await until('discovery has spent the rest of the day', () => sent.length === 2, 20_000);
  await until('the lane has closed until the next Tehran day', () =>
    worker.runtime.lanes().some((lane) => lane.sourceId === source && lane.closure === 'over_budget'),
  );
  assert.deepEqual(
    sent.map((request) => request.kind),
    ['crawl.test-discover', 'crawl.test-discover'],
  );
  assert.equal((await laneBudget(source)).budget_spent, 4);
  const [closed] = worker.runtime.lanes().filter((lane) => lane.sourceId === source);
  assert.ok(closed?.until && closed.until > new Date(), 'the lane reopens when the Tehran day ends');
  // The sweep's jobs were never claimed: queued, their attempts intact.
  const queued = (await jobsOf(owner, laneQueue(source))).filter((job) => job.state === 'created');
  assert.equal(queued.length, 2);
  assert.ok(
    queued.every((job) => job.retryCount === 0 && JSON.stringify(job.data).includes('crawl.test-sweep')),
  );

  // The next Tehran day: the count starts again, and the sweep runs.
  await sql`UPDATE crawl_lane SET budget_day = budget_day - 1 WHERE source_id = ${source}`.execute(owner);
  await until('the sweep ran on the new day', () => sent.length === 4, 30_000);
  assert.deepEqual(
    sent.slice(2).map((request) => request.kind),
    ['crawl.test-sweep', 'crawl.test-sweep'],
  );
  const budget = await laneBudget(source);
  assert.equal(budget.budget_spent, 2);
});
