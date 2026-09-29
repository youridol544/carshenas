// path: src/features/lint-selftest/server/lint-selftest-mutations.ts
// expect: no-restricted-imports
// expect-message: Only src/server/db talks to the database driver
import 'server-only';
import { createDatabase } from '@carshenas/db/database';

export const second = createDatabase;
