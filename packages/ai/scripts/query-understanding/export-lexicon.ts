// Freezes the lexicon's rows (the catalogue's names and aliases, the cities, districts, body types and colours, and
// how many searchable listings each has) into data/lexicon-rows.json: what the offline tests and the evaluation's
// code-only runs build their lexicon from, so a run is reproducible without the database (CS-62).
//
//   pnpm --filter @carshenas/ai query-understanding:export-lexicon
//
// Reads with the web app's role (DATABASE_URL), which is what the product reads with; writes one file.
import { writeFileSync } from 'node:fs';
import type { ReadonlyKysely } from 'kysely/readonly';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';
import { readLexiconRows } from '@carshenas/search/understand/lexicon-queries';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const db = createDatabase({
  connectionString,
  applicationName: 'carshenas-query-understanding-export',
  max: 1,
  onIdleError: () => undefined,
});
try {
  // Kysely's own documentation converts a handle to its read-only view with `as never`; the reads below never write.
  const rows = await readLexiconRows(db as unknown as ReadonlyKysely<DB>);
  const file = new URL('./data/lexicon-rows.json', import.meta.url);
  writeFileSync(file, `${JSON.stringify(rows)}\n`);
  console.log(
    `${String(rows.makes.length)} makes, ${String(rows.models.length)} models, ${String(rows.trims.length)} trims, ${String(rows.cities.length)} cities, ${String(rows.districts.length)} districts, ${String(rows.colours.length)} colours -> data/lexicon-rows.json`,
  );
} finally {
  await db.destroy();
}
