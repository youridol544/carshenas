import { connection } from 'next/server';
import { DIAGNOSTIC_MESSAGE } from '@/features/diagnostics/diagnostics';
import { env } from '@/server/env';
import { withErrorReference } from '@/server/observability/route-errors';

// A Route Handler that fails on purpose (features/diagnostics, ADR-0016); 404 unless CARSHENAS_DIAGNOSTICS=1.
export const GET = withErrorReference('/api/diagnostics', async () => {
  // The switch is read at request time, never baked into a prerendered response.
  await connection();
  if (!env.diagnosticsEnabled) return new Response(null, { status: 404 });
  throw new Error(DIAGNOSTIC_MESSAGE);
});
