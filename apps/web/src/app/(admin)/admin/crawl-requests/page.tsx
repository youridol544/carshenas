import type { Metadata } from 'next';
import { CrawlRequestsScreen } from '@/features/admin/components/crawl-requests-screen';
import { CRAWL_REQUESTS_ADMIN_COPY } from '@/features/admin/crawl-requests-admin-copy';
import { loadCrawlRequests, readRequestFilter } from '@/features/admin/server/crawl-request-queries';

export const metadata: Metadata = { title: CRAWL_REQUESTS_ADMIN_COPY.title };

// Crawl requests (CS-71). Reads the session at request time. Anyone but the superadmin gets a real 404 from
// src/proxy.ts; the loader still answers not-found itself. The state filter comes from the address; anything else
// reads as «all».
export const instant = false;

export default async function AdminCrawlRequestsPage({ searchParams }: PageProps<'/admin/crawl-requests'>) {
  const filter = readRequestFilter((await searchParams).state);
  return <CrawlRequestsScreen data={await loadCrawlRequests(filter)} />;
}
