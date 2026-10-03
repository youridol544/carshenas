import type { Metadata } from 'next';
import { SEARCH_FILES_ADMIN_COPY } from '@/features/admin/admin-copy';
import { SearchFilesAdminScreen } from '@/features/admin/components/search-files-screen';
import { loadMatchingRuns } from '@/features/admin/server/matching-queries';
import { loadAdminSearchFiles } from '@/features/admin/server/search-file-queries';

export const metadata: Metadata = { title: SEARCH_FILES_ADMIN_COPY.title };

// Every buyer's search files (CS-70). Reads the session at request time. Anyone but the superadmin gets a real 404 from
// src/proxy.ts; the loader still answers not-found itself.
export const instant = false;

export default async function AdminSearchFilesPage() {
  const [data, runs] = await Promise.all([loadAdminSearchFiles(), loadMatchingRuns()]);
  return <SearchFilesAdminScreen data={data} matchingRuns={runs} />;
}
