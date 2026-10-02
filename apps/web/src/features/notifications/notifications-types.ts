import type { NotificationIcon, NotificationKind } from '@carshenas/notifications/kinds';

// What the inbox's pages and actions pass around (ADR-0026). Everything is already Farsi text or plain data: built on
// the server from the stored facts, so the client never formats a price or a date.

/**
 * Where a notification leads. A listing opens on its source, named by `sourceName` («دیوار»), until Carshenas has its
 * own listing page (CS-64).
 */
export type NotificationLink = { href: string; external: boolean; sourceName?: string };

export type InboxItem = {
  id: number;
  icon: NotificationIcon | 'unknown';
  title: string;
  detail?: string;
  /** Both prices in full digits, formatted on the server: «۸۱۰٬۰۰۰٬۰۰۰ تومان». */
  priceChange?: { from: string; to: string };
  /** When it was created, ISO-8601, for the machine-readable datetime. */
  createdAt: string;
  /** «۱۵:۳۰», in Tehran. */
  time: string;
  /** «۵ مهر ۱۴۰۵ ساعت ۱۵:۳۰», for the time's title. */
  dateTime: string;
  read: boolean;
  link?: NotificationLink;
};

/** A Tehran day's notifications, newest first: «امروز», «دیروز», «یکشنبه ۵ مهر ۱۴۰۵». */
export type InboxDay = { key: string; label: string; items: InboxItem[] };

export type InboxPage = {
  days: InboxDay[];
  unreadCount: number;
  /** The newest notification shown: «mark all read» marks this and older ones, never one that arrived since. */
  newestId?: number;
  /** The cursor of the next, older page, when there is one. */
  olderCursor?: number;
  /** This page is an older one, reached through a cursor. */
  isOlderPage: boolean;
};

export type KindSetting = { kind: NotificationKind; label: string; description: string; muted: boolean };

/** What a mark-read or mute action answers; a failure's message is Farsi and says what to do. */
export type NotificationActionResult = { status: 'done' } | { status: 'failed'; message: string };
