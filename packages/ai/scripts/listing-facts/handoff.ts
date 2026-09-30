// Moves the listing.facts answers a lane paid for into another database (the owner's rule of 2026-09-30: a lane's
// data joins main's when its task merges, and main's database is never replaced). An answer is keyed by its cache key,
// which hashes the task, the prompt version, the model and the rendered input, so the same row means the same question
// anywhere: the import inserts with ON CONFLICT DO NOTHING and never overwrites. Both ends use WORKER_DATABASE_URL,
// the worker's role, which may read and insert ai_answer.
//
//   pnpm --filter @carshenas/ai listing-facts:handoff --export results/listing-facts-answers.json   (in the lane)
//   pnpm --filter @carshenas/ai listing-facts:handoff --import <that file>                           (in main)
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { createDatabase } from '@carshenas/db/database';

const Row = z.strictObject({
  cacheKey: z.string().regex(/^[0-9a-f]{64}$/),
  task: z.string(),
  promptVersion: z.string(),
  provider: z.enum(['openai', 'anthropic', 'google', 'deepseek']),
  model: z.string(),
  answeringModel: z.string(),
  output: z.record(z.string(), z.unknown()),
  costUsdMicros: z.number().int().nullable(),
  createdAt: z.string(),
});

const { values } = parseArgs({
  options: {
    export: { type: 'string' },
    import: { type: 'string' },
    task: { type: 'string', default: 'listing.facts' },
  },
});

const connectionString = process.env.WORKER_DATABASE_URL;
if (!connectionString) throw new Error('WORKER_DATABASE_URL is not set');
const db = createDatabase({
  connectionString,
  applicationName: 'carshenas-listing-facts-handoff',
  max: 1,
  onIdleError: () => undefined,
});

try {
  if (values.export) {
    const rows = await db
      .selectFrom('ai_answer')
      .select([
        'cache_key',
        'task',
        'prompt_version',
        'provider',
        'model',
        'answering_model',
        'output',
        'cost_usd_micros',
        'created_at',
      ])
      .where('task', '=', values.task)
      .orderBy('id')
      .execute();
    const out = rows.map((row) => ({
      cacheKey: row.cache_key.toString('hex'),
      task: row.task,
      promptVersion: row.prompt_version,
      provider: row.provider,
      model: row.model,
      answeringModel: row.answering_model,
      output: row.output,
      costUsdMicros: row.cost_usd_micros,
      createdAt: new Date(row.created_at).toISOString(),
    }));
    writeFileSync(values.export, `${JSON.stringify(out, null, 1)}\n`);
    console.log(`exported ${String(out.length)} ${values.task} answers to ${values.export}`);
  } else if (values.import) {
    const rows = z.array(Row).parse(JSON.parse(readFileSync(values.import, 'utf8')));
    let inserted = 0;
    for (const row of rows) {
      const result = await db
        .insertInto('ai_answer')
        .values({
          cache_key: Buffer.from(row.cacheKey, 'hex'),
          task: row.task,
          prompt_version: row.promptVersion,
          provider: row.provider,
          model: row.model,
          answering_model: row.answeringModel,
          output: JSON.stringify(row.output),
          cost_usd_micros: row.costUsdMicros,
          created_at: new Date(row.createdAt),
        })
        .onConflict((conflict) => conflict.constraint('ai_answer_cache_key_unique').doNothing())
        .executeTakeFirst();
      inserted += Number(result.numInsertedOrUpdatedRows ?? 0);
    }
    console.log(
      `imported ${String(inserted)} of ${String(rows.length)} answers; the rest were already there`,
    );
  } else {
    throw new Error('pass --export <file> or --import <file>');
  }
} finally {
  await db.destroy();
}
