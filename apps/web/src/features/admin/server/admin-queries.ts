import 'server-only';
import type { ChosenCrawlState, CrawlState, StopReason } from '@/features/admin/admin-types';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';

// The superadmin section's reads (CS-39 stood the section up, CS-40 added the sources screen, CS-41 and CS-53 add
// theirs), through the section's own role (ADR-0023). Each asks for the superadmin itself: a page or a layout is never
// the guard (ADR-0020 point 10), and anyone else gets the not-found page. The tables are tiny and curated; the plans
// are in CS-40's notes.

export type DashboardAccounts = { buyers: number; superadmins: number };

export type DashboardSource = {
  id: string;
  nameFa: string;
  crawlState: CrawlState;
};

export type DashboardData = { username: string; accounts: DashboardAccounts; sources: DashboardSource[] };

export async function loadDashboard(): Promise<DashboardData> {
  const superadmin = await requireSuperadmin();
  const database = readAdminDatabase();
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

/** How many of a source's latest changes its card lists. */
export const RECENT_CHANGES = 5;

export type SourceStop = {
  /** When the blocked request started (ISO 8601), for the screen. */
  stoppedAt: string;
  /**
   * The same instant as the database's own text, exact to the microsecond. The form sends it back, and
   * change_source_state() compares it with the source's stop, so a stop nobody saw is never cleared.
   */
  stoppedAtText: string;
  reason: StopReason;
};

export type SourceChange = {
  id: number;
  fromState: CrawlState;
  toState: ChosenCrawlState;
  /** The superadmin's username. */
  changedBy: string;
  changedAt: string;
  /** The crawler's stop this change cleared, when it left one. */
  clearedStop: { stoppedAt: string; reason: StopReason } | null;
};

export type AdminSource = {
  id: string;
  nameFa: string;
  baseUrl: string;
  /** Only a crawled source can be enabled (source_only_crawled_sources_run). */
  crawled: boolean;
  crawlState: CrawlState;
  stop: SourceStop | null;
  changes: SourceChange[];
};

export type SourcesData = { sources: AdminSource[] };

export async function loadSources(): Promise<SourcesData> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  const [sources, changes] = await Promise.all([
    database
      .selectFrom('source')
      .select((eb) => [
        'id',
        'name_fa',
        'base_url',
        'access_method',
        'crawl_state',
        'stopped_at',
        'stop_reason',
        eb.cast<string | null>('stopped_at', 'text').as('stopped_at_text'),
      ])
      .orderBy('id')
      .execute(),
    // Each source's latest changes, newest first: one index range per source on source_state_change_source_changed_idx.
    database
      .selectFrom('source')
      .innerJoinLateral(
        (eb) =>
          eb
            .selectFrom('source_state_change')
            .innerJoin('account', 'account.id', 'source_state_change.changed_by_account_id')
            .select([
              'source_state_change.id',
              'source_state_change.source_id',
              'source_state_change.from_state',
              'source_state_change.to_state',
              'source_state_change.changed_at',
              'source_state_change.cleared_stopped_at',
              'source_state_change.cleared_stop_reason',
              'account.username',
            ])
            .whereRef('source_state_change.source_id', '=', 'source.id')
            .orderBy('source_state_change.changed_at', 'desc')
            .orderBy('source_state_change.id', 'desc')
            .limit(RECENT_CHANGES)
            .as('change'),
        (join) => join.onTrue(),
      )
      .select([
        'change.id',
        'change.source_id',
        'change.from_state',
        'change.to_state',
        'change.changed_at',
        'change.cleared_stopped_at',
        'change.cleared_stop_reason',
        'change.username',
      ])
      .orderBy('change.source_id')
      .orderBy('change.changed_at', 'desc')
      .orderBy('change.id', 'desc')
      .execute(),
  ]);
  return {
    sources: sources.map((source) => ({
      id: source.id,
      nameFa: source.name_fa,
      baseUrl: source.base_url,
      crawled: source.access_method === 'crawl',
      crawlState: source.crawl_state,
      stop:
        source.stopped_at !== null && source.stop_reason !== null && source.stopped_at_text !== null
          ? {
              stoppedAt: source.stopped_at.toISOString(),
              stoppedAtText: source.stopped_at_text,
              reason: source.stop_reason,
            }
          : null,
      changes: changes
        .filter((change) => change.source_id === source.id)
        .map((change) => ({
          id: change.id,
          fromState: change.from_state,
          toState: change.to_state,
          changedBy: change.username,
          changedAt: change.changed_at.toISOString(),
          clearedStop:
            change.cleared_stopped_at !== null && change.cleared_stop_reason !== null
              ? { stoppedAt: change.cleared_stopped_at.toISOString(), reason: change.cleared_stop_reason }
              : null,
        })),
    })),
  };
}
