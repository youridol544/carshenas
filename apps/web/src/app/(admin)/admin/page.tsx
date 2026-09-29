import type { Metadata } from 'next';
import { ADMIN_COPY, AdminDashboard } from '@/features/admin/components/admin-dashboard';
import { loadDashboard } from '@/features/admin/server/admin-queries';

export const metadata: Metadata = { title: ADMIN_COPY.title };

// Blocking on purpose: anyone but the superadmin must get a real 404, which only a page that has not started
// streaming can answer (next-app-router.md).
export const instant = false;

export default async function AdminPage() {
  const data = await loadDashboard();
  return <AdminDashboard data={data} />;
}
