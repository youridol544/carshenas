import { sql } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import { rebuildSearch } from './jobs/search.ts';
const url = process.env.WORKER_URL!;
const rebuildDb = createDatabase({ connectionString: url, applicationName: 'review-rebuild', max: 2, onIdleError: () => undefined });
const crawler = createDatabase({ connectionString: url, applicationName: 'review-crawler', max: 3, onIdleError: () => undefined });
const { rows: lim } = await sql<any>`SELECT current_setting('lock_timeout') lt, current_setting('statement_timeout') st, current_setting('transaction_timeout') tt, current_setting('idle_in_transaction_session_timeout') it, current_user u`.execute(crawler);
console.log('crawler session', lim[0]);
let stop = false, ops = 0, errors: string[] = [], maxMs = 0, slow = 0;
const writer = (async () => {
  while (!stop) {
    const t = performance.now();
    try {
      // a crawl sighting plus a price change, as a batch of ~200 listings (marks fire)
      await crawler.transaction().execute(async (trx) => {
        await sql`UPDATE listing SET last_seen_at = now() WHERE id IN (SELECT id FROM listing WHERE source_id='tst_search_scale' ORDER BY random() LIMIT 200)`.execute(trx);
        await sql`UPDATE listing SET asking_price_toman = asking_price_toman + 1000000 WHERE id IN (SELECT id FROM listing WHERE source_id='tst_search_scale' AND asking_price_toman IS NOT NULL ORDER BY random() LIMIT 100)`.execute(trx);
      });
      ops++;
    } catch (e: any) { errors.push(String(e.message)); }
    const ms = performance.now() - t; maxMs = Math.max(maxMs, ms); if (ms > 1000) slow++;
    await new Promise((r) => setTimeout(r, 50));
  }
})();
const sampler = createDatabase({ connectionString: process.env.MIGRATE_URL!, applicationName: 'review-sampler', max: 1, onIdleError: () => undefined });
let lockWaits = 0; const waiters = new Set<string>();
const poll = (async () => { while (!stop) { const { rows } = await sql<any>`SELECT application_name a, wait_event_type t, wait_event e, left(query,60) q FROM pg_stat_activity WHERE application_name LIKE 'review-%' AND wait_event_type='Lock'`.execute(sampler); lockWaits += rows.length; for (const r of rows) waiters.add(JSON.stringify(r)); await new Promise((r) => setTimeout(r, 100)); } })();
const t0 = performance.now();
if (process.env.BASELINE) { await new Promise((r) => setTimeout(r, 40000)); stop = true; await writer; await poll; console.log(JSON.stringify({ baselineBatches: ops, errors: errors.length, maxBatchMs: Math.round(maxMs), over1s: slow, lockWaits })); process.exit(0); }
let chunks = 0;
const run = await rebuildSearch(rebuildDb, { onChunk: (c) => { chunks = c.index; if (c.index % 10 === 0) console.log(`chunk ${c.index}/${c.chunks} at ${Math.round((performance.now()-t0)/1000)}s`); } });
const secs = (performance.now() - t0) / 1000;
stop = true; await writer; await poll;
console.log(JSON.stringify({ lockWaitSamples: lockWaits, waiters: [...waiters].slice(0,5), rebuildSeconds: Math.round(secs), run, writerBatches: ops, errors: errors.slice(0, 5), errorCount: errors.length, maxBatchMs: Math.round(maxMs), batchesOver1s: slow }));
await rebuildDb.destroy(); await crawler.destroy();
