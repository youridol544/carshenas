import 'server-only';
import type { NotificationKind } from '@carshenas/notifications/kinds';
import { database } from '@/server/db/database';
import { databaseNow } from '@/server/db/sql-helpers';

// What a buyer changes in their inbox (CS-68, ADR-0026): read state and mutes, for the account the caller took from
// the session. The web role may set read_at and nothing else on a notification, and insert or delete its own mutes.
// Each write sets a target state, so a second press, or a retry after a lost answer, changes nothing.

/** Marks one of the account's notifications read; an id that is not the account's, or already read, changes nothing. */
export async function markNotificationRead(accountId: number, id: number): Promise<void> {
  await database()
    .updateTable('notification')
    .set({ read_at: databaseNow() })
    .where('account_id', '=', accountId)
    .where('id', '=', id)
    .where('read_at', 'is', null)
    .execute();
}

/**
 * Marks read every unread notification of the account up to `throughId`, the newest one the buyer was shown, so one
 * that arrived while the page was open stays unread. Ids are handed out at insert, not at commit: a producer's
 * transaction that inserted before the page was read and committed after it holds a smaller id the page never showed,
 * and is marked read too. The window is one producer transaction (milliseconds); accepted rather than sending the
 * list of shown ids.
 */
export async function markAllNotificationsRead(accountId: number, throughId: number): Promise<void> {
  await database()
    .updateTable('notification')
    .set({ read_at: databaseNow() })
    .where('account_id', '=', accountId)
    .where('read_at', 'is', null)
    .where('id', '<=', throughId)
    .execute();
}

/** Mutes a kind or turns it back on; muting twice is muting once (notification_mute_once_unique). */
export async function setKindMuted(accountId: number, kind: NotificationKind, muted: boolean): Promise<void> {
  const db = database();
  if (muted) {
    await db
      .insertInto('notification_mute')
      .values({ account_id: accountId, kind })
      .onConflict((conflict) => conflict.constraint('notification_mute_once_unique').doNothing())
      .execute();
    return;
  }
  await db
    .deleteFrom('notification_mute')
    .where('account_id', '=', accountId)
    .where('kind', '=', kind)
    .execute();
}
