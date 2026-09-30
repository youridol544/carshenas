import type { Metadata } from 'next';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import { WorkerScreen } from '@/features/admin/components/worker-screen';
import {
  loadCrawl,
  loadJobs,
  loadListings,
  loadProblems,
  loadWorker,
  readPipelineWindow,
} from '@/features/admin/server/pipeline-queries';

export const metadata: Metadata = { title: WORKER_COPY.title };

// Reads the session at request time. Anyone but the superadmin gets a real 404 from src/proxy.ts; each loader still
// answers not-found itself. The window comes from the address; anything else reads as 24 hours.
export const instant = false;

export default async function AdminWorkerPage({ searchParams }: PageProps<'/admin/worker'>) {
  const window = readPipelineWindow((await searchParams).window);
  const [worker, jobs, crawl, listings, problems] = await Promise.all([
    loadWorker(),
    loadJobs(),
    loadCrawl(window),
    loadListings(window),
    loadProblems(),
  ]);
  return <WorkerScreen data={{ worker, jobs, crawl, listings, problems }} />;
}
