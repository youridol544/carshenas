// path: src/features/lint-selftest/server/lint-selftest-queries.ts
// expect: no-restricted-imports
// expect-message: Only the superadmin section (src/features/admin) uses its database role
import 'server-only';
import { readAdminDatabase } from '@/server/db/admin-database';

export const reads = readAdminDatabase;
