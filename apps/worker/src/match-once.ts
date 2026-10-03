import { createDatabase } from '@carshenas/db/database';
import { env } from './env.ts';
import { matchSearchFiles } from './jobs/search-match.ts';

// One matching run by hand (CS-72, docs/runbooks/notifications.md): the same function the `search.match` job runs every
// five minutes, as the worker's own role; prints the run's counts. Sends no request to any source.
const db = createDatabase({
  connectionString: env.databaseUrl,
  applicationName: 'carshenas-match-once',
  max: 2,
  onIdleError: () => undefined,
});
try {
  console.log(JSON.stringify(await matchSearchFiles(db)));
} finally {
  await db.destroy();
}
