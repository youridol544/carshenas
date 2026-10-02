import { connection } from 'next/server';
import { ActionLink } from '@/components/ui/action-link';
import { InboxList } from '@/features/notifications/components/inbox-list';
import { InboxEmpty } from '@/features/notifications/components/inbox-states';
import { NotificationSettings } from '@/features/notifications/components/notification-settings';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';
import { readInboxCursor } from '@/features/notifications/notifications-schemas';
import { loadInbox, loadKindSettings } from '@/features/notifications/server/notification-queries';
import { NOTIFICATIONS_PATH } from '@/lib/return-path';
import { requireAccount } from '@/server/auth/current-account';
import type { Route } from 'next';

// The signed-in buyer's inbox (CS-68 #1): one page of notifications newest first, grouped by Tehran day, a link to
// older ones, and the switches that mute a kind. The session decides whose inbox it is; the page's address only says
// where to continue. It reads the clock for «امروز» and «دیروز», after connection(), inside the page's Suspense.

type NotificationInboxProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function NotificationInbox({ searchParams }: NotificationInboxProps) {
  const account = await requireAccount(NOTIFICATIONS_PATH);
  await connection();
  const before = readInboxCursor((await searchParams).before);
  const [page, settings] = await Promise.all([
    loadInbox(account.id, before, new Date()),
    loadKindSettings(account.id),
  ]);
  return (
    <>
      <div className="flex flex-col gap-6">
        {page.newestId === undefined ? (
          page.isOlderPage ? (
            <p className="text-body text-muted">{NOTIFICATIONS_COPY.olderEmpty}</p>
          ) : (
            <InboxEmpty />
          )
        ) : (
          <InboxList days={page.days} unreadCount={page.unreadCount} newestId={page.newestId} />
        )}
        {page.olderCursor !== undefined || page.isOlderPage ? (
          <nav aria-label={NOTIFICATIONS_COPY.title} className="flex flex-wrap gap-x-4">
            {page.olderCursor === undefined ? null : (
              <ActionLink
                level="tertiary"
                href={`${NOTIFICATIONS_PATH}?before=${String(page.olderCursor)}` as Route}
              >
                {NOTIFICATIONS_COPY.older}
              </ActionLink>
            )}
            {page.isOlderPage ? (
              <ActionLink level="tertiary" href={NOTIFICATIONS_PATH}>
                {NOTIFICATIONS_COPY.newest}
              </ActionLink>
            ) : null}
          </nav>
        ) : null}
      </div>
      <NotificationSettings settings={settings} />
    </>
  );
}
