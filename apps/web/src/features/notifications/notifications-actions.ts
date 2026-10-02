'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';
import {
  markAllReadSchema,
  markReadSchema,
  setKindMutedSchema,
} from '@/features/notifications/notifications-schemas';
import type { NotificationActionResult } from '@/features/notifications/notifications-types';
import {
  markAllNotificationsRead,
  markNotificationRead,
  setKindMuted,
} from '@/features/notifications/server/notification-mutations';
import { currentAccount } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// The inbox's actions (CS-68, ADR-0026), behind optimistic controls. Each is a public POST endpoint: it checks that
// the request came from a page of this site, parses its whole input, takes the account from the session (never from
// the input), sets a target state, and refreshes the page so the answer carries the new truth, the header's unread
// count included; revalidateTag(tag, 'max') would let the control snap back (react-patterns, ui-craft.md section 3).
// A database that does not answer comes back as a Farsi message beside the control, reported once.

const log = logger.child({ component: 'notifications' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes notifications came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

const INVALID: NotificationActionResult = { status: 'failed', message: NOTIFICATIONS_COPY.failures.markRead };
const SIGNED_OUT: NotificationActionResult = {
  status: 'failed',
  message: NOTIFICATIONS_COPY.failures.signedOut,
};

async function signedInAccountId(): Promise<number | undefined> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  return (await currentAccount())?.id;
}

/** Marks one notification read. */
export async function markNotificationReadAction(input: unknown): Promise<NotificationActionResult> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return SIGNED_OUT;
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  try {
    await markNotificationRead(accountId, parsed.data.id);
  } catch (error) {
    captureError(error, { message: 'marking a notification read failed', fields: { accountId } });
    return { status: 'failed', message: NOTIFICATIONS_COPY.failures.markRead };
  }
  refresh();
  return { status: 'done' };
}

/** Marks read every notification up to the newest one the page showed. */
export async function markAllNotificationsReadAction(input: unknown): Promise<NotificationActionResult> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return SIGNED_OUT;
  const parsed = markAllReadSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  try {
    await markAllNotificationsRead(accountId, parsed.data.throughId);
  } catch (error) {
    captureError(error, { message: 'marking all notifications read failed', fields: { accountId } });
    return { status: 'failed', message: NOTIFICATIONS_COPY.failures.markRead };
  }
  refresh();
  return { status: 'done' };
}

/** Mutes a kind of notification, or turns it back on: the target state, never a toggle. */
export async function setNotificationKindMutedAction(input: unknown): Promise<NotificationActionResult> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return SIGNED_OUT;
  const parsed = setKindMutedSchema.safeParse(input);
  if (!parsed.success) return { status: 'failed', message: NOTIFICATIONS_COPY.failures.mute };
  const { kind, muted } = parsed.data;
  try {
    await setKindMuted(accountId, kind, muted);
  } catch (error) {
    captureError(error, { message: 'changing a notification mute failed', fields: { accountId, kind } });
    return { status: 'failed', message: NOTIFICATIONS_COPY.failures.mute };
  }
  log.info('notification kind muted', { accountId, kind, muted });
  refresh();
  return { status: 'done' };
}
