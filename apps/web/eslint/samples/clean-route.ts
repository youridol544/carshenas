// path: src/app/lint-selftest-route-clean/route.ts
// expect: (none)
import { withErrorReference } from '@/server/observability/route-errors';

export const GET = withErrorReference('/lint-selftest-route-clean', () => Response.json({ ok: true }));
