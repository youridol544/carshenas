import { sql } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import { limitBuildTransaction } from '@carshenas/search/document';
const db = createDatabase({ connectionString: process.env.WORKER_URL!, applicationName: 'review-tt', max: 2, onIdleError: () => undefined });
for (const mode of ['dance']) {
  const t = performance.now();
  try {
    await db.transaction().execute(async (trx) => {
      if (mode === 'dance') await limitBuildTransaction(trx, { statementSeconds: 90, lockSeconds: 10, transactionSeconds: 600 });
      for (let i = 0; i < 15; i++) await sql`SELECT pg_sleep(10)`.execute(trx);
    });
    console.log(mode, 'survived', Math.round((performance.now() - t) / 1000), 's');
  } catch (e: any) { console.log(mode, 'failed after', Math.round((performance.now() - t) / 1000), 's:', e.message); }
}
await db.destroy();
