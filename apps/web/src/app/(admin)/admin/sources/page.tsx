import type { Metadata } from 'next';
import { SOURCES_COPY } from '@/features/admin/admin-copy';
import { SourcesScreen } from '@/features/admin/components/sources-screen';
import { loadSources } from '@/features/admin/server/admin-queries';

export const metadata: Metadata = { title: SOURCES_COPY.title };

// Reads the session at request time. Anyone but the superadmin gets a real 404 from src/proxy.ts, since with Cache
// Components the page streams a static shell first; loadSources still answers not-found itself.
export const instant = false;

export default async function AdminSourcesPage() {
  const data = await loadSources();
  return <SourcesScreen data={data} />;
}
