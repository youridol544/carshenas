import { DataStatusReport } from '@/features/data-status/components/data-status-report';
import { HowItWorks } from '@/features/data-status/components/how-it-works';
import { loadDataStatus } from '@/features/data-status/server/data-status-queries';

// The figures, read inside the page's Suspense boundary: the loader's short cache lifetime keeps them out of the build,
// so they are read when the page is asked for and then served from the cache for a minute (CS-66). How the index is
// kept comes last, after them, so nothing on the page moves when they arrive.

export async function DataStatusContent() {
  const data = await loadDataStatus();
  return (
    <>
      <DataStatusReport data={data} />
      <HowItWorks />
    </>
  );
}
