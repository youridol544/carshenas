import 'server-only';
import { judgeProbe, type ProbeInput } from '@/features/data-status/data-status-probe';
import type { DataStatus } from '@/features/data-status/data-status-types';
import { loadDataStatus } from '@/features/data-status/server/data-status-queries';
import { checkDatabaseHealth } from '@/server/db/database-health';
import { env } from '@/server/env';
import { captureError } from '@/server/observability/logger';

// GET /api/probe (CS-119): the one address an uptime monitor asks. It answers for the site (the database answers a real
// query), the worker and the data (the figures of the public data-status page, cached for a minute), and says 200 only
// when all three are healthy. Which part is not, and by how much, is in the body (data-status-probe.ts).

export type ProbeSources = {
  /** A real query through the web role: the newest migration. Rejects when the database does not answer. */
  readonly checkSite: () => Promise<{ readonly migration: string | null }>;
  /** The data-status figures. Rejects when they cannot be read. */
  readonly loadStatus: () => Promise<DataStatus>;
  readonly now: () => Date;
  readonly release: string;
};

function defaultSources(): ProbeSources {
  return {
    checkSite: () => checkDatabaseHealth(),
    loadStatus: loadDataStatus,
    now: () => new Date(),
    release: env.release,
  };
}

export async function probeResponse(sources: ProbeSources = defaultSources()): Promise<Response> {
  const now = sources.now();
  let site: ProbeInput['site'];
  let status: DataStatus | null = null;
  try {
    site = { reachable: true, migration: (await sources.checkSite()).migration };
  } catch (error) {
    // Handled (the answer is a 503), but a person should look: logged, and handed to every error reporter.
    captureError(error, {
      message: 'the probe could not reach the database',
      fields: { component: 'probe' },
    });
    site = { reachable: false };
  }
  if (site.reachable) {
    try {
      status = await sources.loadStatus();
    } catch (error) {
      captureError(error, {
        message: 'the probe could not read the data status',
        fields: { component: 'probe' },
      });
    }
  }
  const { report, httpStatus } = judgeProbe({ site, status, release: sources.release, now });
  return Response.json(report, { status: httpStatus, headers: { 'Cache-Control': 'no-store' } });
}
