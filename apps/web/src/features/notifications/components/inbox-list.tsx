'use client';

import { Bell, Check, FileSearch, TrendingDown, type LucideIcon } from 'lucide-react';
import { startTransition, useId, useLayoutEffect, useOptimistic, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { NumericText } from '@/components/ui/numeric-text';
import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import { NotificationRowFrame } from '@/features/notifications/components/notification-row-frame';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/features/notifications/notifications-actions';
import { NOTIFICATIONS_COPY, unreadCountText } from '@/features/notifications/notifications-copy';
import type { InboxDay, InboxItem } from '@/features/notifications/notifications-types';

// The inbox's list (CS-68): notifications grouped by Tehran day, newest first, each linking to what it is about. Reading
// is optimistic (ui-design craft.md, section 4): the unread mark goes at once, the action sets the target state and
// refreshes the page (the header's count with it), and a failure puts the mark back and says so in an overlay with a
// retry, moving nothing. The unread mark is a dot and a hidden word, never a change of weight, so nothing reflows.

const ICONS = { price_drop: TrendingDown, search_file: FileSearch, unknown: Bell } as const satisfies Record<
  InboxItem['icon'],
  LucideIcon
>;

/** What the page shows as read before the server confirms it: single notifications, or everything up to an id. */
type ReadOverlay = { readonly ids: readonly number[]; readonly through?: number };
type ReadEvent = { type: 'oneRead'; id: number } | { type: 'allRead'; through: number };

const NOTHING_READ: ReadOverlay = { ids: [] };

function withRead(overlay: ReadOverlay, event: ReadEvent): ReadOverlay {
  return event.type === 'oneRead'
    ? { ...overlay, ids: [...overlay.ids, event.id] }
    : { ...overlay, through: event.through };
}

function isShownRead(item: InboxItem, overlay: ReadOverlay): boolean {
  return (
    item.read ||
    overlay.ids.includes(item.id) ||
    (overlay.through !== undefined && item.id <= overlay.through)
  );
}

type InboxListProps = { days: InboxDay[]; unreadCount: number; newestId: number };

export function InboxList({ days, unreadCount, newestId }: InboxListProps) {
  const [overlay, addRead] = useOptimistic(NOTHING_READ, withRead);
  const [failure, setFailure] = useState<ToastNotice | null>(null);
  const prefix = useId();

  // Next.js keeps this page alive, hidden, after the buyer leaves it; a message about an earlier attempt must not be
  // waiting when they come back (ui-design craft.md, section 4).
  useLayoutEffect(
    () => () => {
      setFailure(null);
    },
    [],
  );

  const items = days.flatMap((day) => day.items);
  const newlyRead = items.filter((item) => !item.read && isShownRead(item, overlay)).length;
  // Marking all read marks every older page too: nothing shown is left unread.
  const shownUnread = overlay.through === undefined ? Math.max(0, unreadCount - newlyRead) : 0;

  function fail(message: string, retry: () => void) {
    setFailure({ message, actionLabel: NOTIFICATIONS_COPY.retry, onAction: retry });
  }

  function markRead(id: number) {
    setFailure(null);
    startTransition(async () => {
      addRead({ type: 'oneRead', id });
      try {
        const result = await markNotificationReadAction({ id });
        if (result.status === 'failed')
          fail(result.message, () => {
            markRead(id);
          });
      } catch {
        fail(NOTIFICATIONS_COPY.failures.markRead, () => {
          markRead(id);
        });
      }
    });
  }

  function markAllRead() {
    if (shownUnread === 0) return;
    setFailure(null);
    startTransition(async () => {
      addRead({ type: 'allRead', through: newestId });
      try {
        const result = await markAllNotificationsReadAction({ throughId: newestId });
        if (result.status === 'failed') fail(result.message, markAllRead);
      } catch {
        fail(NOTIFICATIONS_COPY.failures.markRead, markAllRead);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p role="status" className="text-secondary text-muted">
          {shownUnread === 0 ? NOTIFICATIONS_COPY.allRead : unreadCountText(shownUnread)}
        </p>
        <button
          type="button"
          aria-disabled={shownUnread === 0}
          onClick={markAllRead}
          className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-control font-semibold text-link transition-colors hover:bg-surface-hover aria-disabled:text-subtle aria-disabled:hover:bg-transparent"
        >
          <Icon icon={Check} />
          {NOTIFICATIONS_COPY.markAllRead}
        </button>
      </div>
      {days.map((day) => {
        const headingId = `${prefix}-${day.key}`;
        return (
          <section key={day.key} aria-labelledby={headingId} className="flex flex-col gap-2">
            <h2 id={headingId} className="text-label font-medium text-muted">
              {day.label}
            </h2>
            <ul className="overflow-hidden rounded-card border border-divider bg-surface">
              {day.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  read={isShownRead(item, overlay)}
                  onRead={() => {
                    markRead(item.id);
                  }}
                />
              ))}
            </ul>
          </section>
        );
      })}
      <ToastMessage
        notice={failure}
        dismissLabel={NOTIFICATIONS_COPY.dismiss}
        onDismiss={() => {
          setFailure(null);
        }}
      />
    </>
  );
}

type NotificationRowProps = { item: InboxItem; read: boolean; onRead: () => void };

function NotificationRow({ item, read, onRead }: NotificationRowProps) {
  const titleRef = useRef<HTMLElement>(null);
  const { link } = item;
  const unreadWord = read ? null : <span className="sr-only">{`${NOTIFICATIONS_COPY.unread}: `}</span>;
  const title =
    link === undefined ? (
      <span ref={titleRef} tabIndex={-1} className="outline-none">
        {unreadWord}
        {item.title}
      </span>
    ) : (
      <a
        ref={(node) => {
          titleRef.current = node;
        }}
        href={link.href}
        {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        // Opening it is reading it; the link opens in a new tab, so this page shows the change when the buyer returns.
        onClick={read ? undefined : onRead}
        onAuxClick={read ? undefined : onRead}
        // The whole row is the link's target; its focus ring is drawn around the row, inside the card's edge.
        className="outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
      >
        {unreadWord}
        {item.title}
        {link.external && link.sourceName !== undefined ? (
          <span className="sr-only">{` (${link.sourceName}: ${NOTIFICATIONS_COPY.opensOnSource})`}</span>
        ) : null}
      </a>
    );

  return (
    <li className="border-b border-divider last:border-b-0">
      <NotificationRowFrame
        icon={
          <span className="relative flex">
            <Icon icon={ICONS[item.icon]} />
            {/* The unread dot sits on the glyph's top inline-end corner, ringed in the page colour; it fades out. */}
            <span
              aria-hidden
              className={`absolute -inset-e-2 -top-1.5 size-3 rounded-full border-2 border-canvas bg-action motion-safe:transition-opacity motion-safe:duration-press ${read ? 'opacity-0' : ''}`}
            />
          </span>
        }
        title={title}
        detail={item.detail}
        price={
          item.priceChange === undefined ? null : (
            <span className="font-semibold text-default">
              <NumericText>{item.priceChange.to}</NumericText>
            </span>
          )
        }
        previous={
          item.priceChange === undefined ? null : (
            <>
              {`${NOTIFICATIONS_COPY.previousPrice} `}
              <del>
                <NumericText>{item.priceChange.from}</NumericText>
              </del>
            </>
          )
        }
        meta={
          <span className="flex items-center gap-2">
            <time dateTime={item.createdAt} title={item.dateTime}>
              {item.time}
            </time>
            {link?.external && link.sourceName !== undefined ? (
              <span aria-hidden className="inline-flex items-center gap-1">
                <span>·</span>
                {/* The source's name alone: a 16 px icon would draw heavier than this 12 px line's stem. */}
                {link.sourceName}
              </span>
            ) : null}
          </span>
        }
        action={
          <button
            type="button"
            aria-label={NOTIFICATIONS_COPY.markRead}
            // 28 px drawn, 44 px to the touch. Read notifications keep the slot, so the row never changes shape; the
            // button leaves the tab order.
            className={`relative inline-flex size-7 items-center justify-center rounded-control text-muted after:absolute after:-inset-2 hover:bg-surface-hover motion-safe:transition-colors ${read ? 'invisible' : ''}`}
            onClick={() => {
              // The button disappears once pressed: focus moves to the row's title rather than falling to the page.
              titleRef.current?.focus();
              onRead();
            }}
          >
            <Icon icon={Check} />
          </button>
        }
      />
    </li>
  );
}
