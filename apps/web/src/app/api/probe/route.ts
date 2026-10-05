import { connection } from 'next/server';
import { probeResponse } from '@/features/data-status/server/probe';
import { withErrorReference } from '@/server/observability/route-errors';

// The address an uptime monitor asks (docs/runbooks/deploy.md): 200 when the site, the worker and the data are healthy,
// 503 with the reasons in the body when they are not.
export const GET = withErrorReference('/api/probe', async () => {
  // Always at request time: a response prerendered by `next build` would describe the build machine.
  await connection();
  return probeResponse();
});
