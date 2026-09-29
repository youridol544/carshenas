import 'server-only';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readDatabase } from '@/server/db/database';

// The superadmin dashboard's reads (CS-39 stands the section up; CS-40 and CS-41 add its screens). Each asks for the
// superadmin itself: a page or a layout is never the guard (ADR-0020 point 10), and anyone else gets the not-found
// page. Both tables are tiny and curated; the plans are in the task's notes.

export type DashboardAccounts = { buyers: number; superadmins: number };

export type DashboardSource = {
  id: string;
  nameFa: string;
  crawlState: 'enabled' | 'paused' | 'stopped_on_block';
};

export type DashboardData = { username: string; accounts: DashboardAccounts; sources: DashboardSource[] };

export async function loadDashboard(): Promise<DashboardData> {
  const superadmin = await requireSuperadmin();
  const database = readDatabase();
  const [roleCounts, sources] = await Promise.all([
    database
      .selectFrom('account')
      .select((eb) => ['role', eb.fn.countAll<number>().as('accounts')])
      .groupBy('role')
      .execute(),
    database.selectFrom('source').select(['id', 'name_fa', 'crawl_state']).orderBy('id').execute(),
  ]);
  const countOf = (role: 'buyer' | 'superadmin') =>
    roleCounts.find((row) => row.role === role)?.accounts ?? 0;
  return {
    username: superadmin.username,
    accounts: { buyers: countOf('buyer'), superadmins: countOf('superadmin') },
    sources: sources.map((source) => ({
      id: source.id,
      nameFa: source.name_fa,
      crawlState: source.crawl_state,
    })),
  };
}
