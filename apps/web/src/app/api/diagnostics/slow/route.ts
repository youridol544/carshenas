import { connection } from 'next/server';
import { setTimeout as wait } from 'node:timers/promises';
import { SLOW_ANSWER_MS } from '@/features/diagnostics/diagnostics';
import { env } from '@/server/env';
import { withErrorReference } from '@/server/observability/route-errors';

// A Route Handler that answers late on purpose (features/diagnostics, ADR-0016), to check that a visitor who leaves
// before the answer still gets a request completed line; 404 unless CARSHENAS_DIAGNOSTICS=1.
export const GET = withErrorReference('/api/diagnostics/slow', async () => {
  await connection();
  if (!env.diagnosticsEnabled) return new Response(null, { status: 404 });
  await wait(SLOW_ANSWER_MS);
  return Response.json({ answered: true });
});
