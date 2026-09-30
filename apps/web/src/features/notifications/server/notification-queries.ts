import 'server-only';
import { formatDateTime, formatTime, tehranIsoDate } from '@carshenas/locale/format-date';
import { formatToman } from '@carshenas/locale/toman';
import {
  NOTIFICATION_KIND_IDS,
  NOTIFICATION_KINDS,
  renderNotification,
  isNotificationKind,
} from '@carshenas/notifications/kinds';
import { dayLabel } from '@/features/notifications/inbox-days';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';
import type {
  InboxDay,
  InboxItem,
  InboxPage,
  KindSetting,
  NotificationLink,
} from '@/features/notifications/notifications-types';
import { readDatabase } from '@/server/db/database';
import { rowsBefore } from '@/server/db/sql-helpers';
import { logger } from '@/server/observability/logger';

// Reads of a buyer's notifications (CS-68, ADR-0026), always for the account the caller took from the session: every
// query filters on it, so no id from a page can reach another buyer's rows. notification_inbox_idx
// (account_id, created_at DESC, id DESC) serves the page, its keyset cursor and the unread count; the plans are in the
// task's notes. The Farsi is built here from the stored facts, so the page receives text, not payloads.

const log = logger.child({ component: 'notifications' });

/** Notifications a page shows: enough to fill a phone's first screens twice, few enough to render at once. */
export const INBOX_PAGE_SIZE = 30;

/** How many unread notifications the account has: the badge in the header and the inbox's status line. */
export async function countUnreadNotifications(accountId: number): Promise<number> {
  const { unread } = await readDatabase()
    .selectFrom('notification')
    .select(({ fn }) => fn.countAll<number>().as('unread'))
    .where('account_id', '=', accountId)
    .where('read_at', 'is', null)
    .executeTakeFirstOrThrow();
  return unread;
}

type InboxRow = {
  id: number;
  kind: string;
  payload: unknown;
  created_at: Date;
  read_at: Date | null;
  listing_url: string | null;
  source_name: string | null;
};

function linkOf(row: InboxRow): NotificationLink | undefined {
  // A listing's own page on Carshenas arrives with CS-64; until then a listing notification opens it on its source.
  if (row.listing_url === null) return undefined;
  return { href: row.listing_url, external: true, sourceName: row.source_name ?? undefined };
}

function toItem(row: InboxRow): InboxItem {
  const text = renderNotification(row.kind, row.payload);
  const base = {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    time: formatTime(row.created_at),
    dateTime: formatDateTime(row.created_at),
    read: row.read_at !== null,
    link: linkOf(row),
  };
  if (text === undefined) {
    // A kind this build does not know, or facts its schema no longer accepts: a plain line, and a line in the log.
    log.warn('notification not renderable', { notificationId: row.id, kind: row.kind });
    return { ...base, icon: 'unknown', title: NOTIFICATIONS_COPY.unknownKind };
  }
  return {
    ...base,
    icon: isNotificationKind(row.kind) ? NOTIFICATION_KINDS[row.kind].icon : 'unknown',
    title: text.title,
    detail: text.detail,
    priceChange:
      text.priceChange === undefined
        ? undefined
        : { from: formatToman(text.priceChange.fromToman), to: formatToman(text.priceChange.toToman) },
  };
}

function groupByDay(rows: readonly InboxRow[], now: Date): InboxDay[] {
  const days: InboxDay[] = [];
  for (const row of rows) {
    const key = tehranIsoDate(row.created_at);
    let day = days.at(-1);
    if (day?.key !== key) {
      day = { key, label: dayLabel(key, now), items: [] };
      days.push(day);
    }
    day.items.push(toItem(row));
  }
  return days;
}

/**
 * One page of the account's inbox, newest first, grouped by Tehran day. `before` is the id of the last notification
 * of the previous page: the page continues below its (created_at, id), read back from the row itself, because a
 * JavaScript date would lose the microseconds PostgreSQL keeps. An id that is not the account's gives an empty page.
 */
export async function loadInbox(
  accountId: number,
  before: number | undefined,
  now: Date,
): Promise<InboxPage> {
  const db = readDatabase();
  let query = db
    .selectFrom('notification as n')
    .leftJoin('listing as l', 'l.id', 'n.listing_id')
    .leftJoin('source as s', 's.id', 'l.source_id')
    .select([
      'n.id',
      'n.kind',
      'n.payload',
      'n.created_at',
      'n.read_at',
      'l.url as listing_url',
      's.name_fa as source_name',
    ])
    .where('n.account_id', '=', accountId)
    .orderBy('n.created_at', 'desc')
    .orderBy('n.id', 'desc')
    .limit(INBOX_PAGE_SIZE + 1);
  if (before !== undefined) {
    query = query.where(
      rowsBefore(
        'n.created_at',
        'n.id',
        db
          .selectFrom('notification as c')
          .select(['c.created_at', 'c.id'])
          .where('c.id', '=', before)
          .where('c.account_id', '=', accountId),
      ),
    );
  }
  const [rows, unreadCount] = await Promise.all([query.execute(), countUnreadNotifications(accountId)]);
  const shown = rows.slice(0, INBOX_PAGE_SIZE);
  return {
    days: groupByDay(shown, now),
    unreadCount,
    newestId: shown[0]?.id,
    olderCursor: rows.length > INBOX_PAGE_SIZE ? shown.at(-1)?.id : undefined,
    isOlderPage: before !== undefined,
  };
}

/** Every kind with its mute switch's words and whether the account muted it, in the registry's order. */
export async function loadKindSettings(accountId: number): Promise<KindSetting[]> {
  const muted = await readDatabase()
    .selectFrom('notification_mute')
    .select('kind')
    .where('account_id', '=', accountId)
    .execute();
  const mutedKinds = new Set(muted.map((row) => row.kind));
  return NOTIFICATION_KIND_IDS.map((kind) => ({
    kind,
    label: NOTIFICATION_KINDS[kind].setting.label,
    description: NOTIFICATION_KINDS[kind].setting.description,
    muted: mutedKinds.has(kind),
  }));
}
