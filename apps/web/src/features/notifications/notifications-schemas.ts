import { isNotificationKind, type NotificationKind } from '@carshenas/notifications/kinds';
import * as z from 'zod';

// What the inbox's actions and page accept (every argument is hostile: the Next.js data-security guide). Ids are
// positive whole numbers in the range of a bigint the driver reads as a JavaScript number; a kind must be one this
// build knows. Whose notification it is comes from the session, never from here.

const notificationId = z.int().min(1).max(Number.MAX_SAFE_INTEGER);

export const markReadSchema = z.strictObject({ id: notificationId });
export const markAllReadSchema = z.strictObject({ throughId: notificationId });
export const setKindMutedSchema = z.strictObject({
  kind: z.string().refine((kind): kind is NotificationKind => isNotificationKind(kind)),
  muted: z.boolean(),
});

export type SetKindMutedInput = { kind: NotificationKind; muted: boolean };

/** The inbox page's `before` cursor from the address bar: an id, or none. */
export function readInboxCursor(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,16}$/.test(value)) return undefined;
  const parsed = notificationId.safeParse(Number(value));
  return parsed.success ? parsed.data : undefined;
}
