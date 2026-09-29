import type { Metadata } from 'next';
import { ADMIN_COPY, AdminDashboard } from '@/features/admin/components/admin-dashboard';
import { loadDashboard } from '@/features/admin/server/admin-queries';

export const metadata: Metadata = { title: ADMIN_COPY.title };

// Reads the session at request time. Anyone but the superadmin gets a real 404 from src/proxy.ts, since with Cache
// Components the page streams a static shell first; loadDashboard still answers not-found itself.
export const instant = false;

export default async function AdminPage() {
  const data = await loadDashboard();
  return <AdminDashboard data={data} />;
}
