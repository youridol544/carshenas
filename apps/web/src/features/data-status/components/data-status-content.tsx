import { DataStatusReport } from '@/features/data-status/components/data-status-report';
import { loadDataStatus } from '@/features/data-status/server/data-status-queries';
import { connection } from 'next/server';

// The figures, read inside the page's Suspense boundary at request time (connection(): a build has no database), then
// served from the loader's cache for a minute (CS-66).

export async function DataStatusContent() {
  await connection();
  const data = await loadDataStatus();
  return <DataStatusReport data={data} />;
}
