import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Integration tests against a real PostgreSQL 18 (`*.db.test.ts`): what PGlite's single connection cannot show,
// such as the app's own pool and role, driver errors and concurrency. `pnpm db:check` runs them against a scratch
// database it has just migrated. Run alone (`pnpm --filter @carshenas/web test:db`), they use the connection strings
// in the environment or the repository's .env; tests that write refuse a database not named *_check or *_test.
const rootEnvFile = path.join(import.meta.dirname, '..', '..', '.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { 'server-only': 'next/dist/compiled/server-only/empty.js' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    // One database: files run one after another.
    fileParallelism: false,
    // The owner's connection string for tests that set up rows; typed in vitest-provided-context.d.ts.
    provide: {
      databaseMigrateUrl: process.env.DATABASE_MIGRATE_URL ?? '',
      // Where the listing page's faithfulness sample writes its report; empty: the sample is not run (CS-64).
      explanationSampleReport: process.env.EXPLANATION_SAMPLE ?? '',
    },
  },
});
