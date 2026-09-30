// path: src/features/admin/server/lint-selftest-admin-queries.ts
// expect: (none)
import 'server-only';
import { readAdminDatabase } from '@/server/db/admin-database';

export const reads = readAdminDatabase;
