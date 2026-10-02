import { Bell, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { NOTIFICATIONS_COPY, unreadCountText } from '@/features/notifications/notifications-copy';
import { countUnreadNotifications } from '@/features/notifications/server/notification-queries';
import { NOTIFICATIONS_PATH } from '@/lib/return-path';

// The account page's way to the inbox (CS-68): one row, the whole of it a link, saying how many notifications are
// unread. The chevron points left, forwards in a right-to-left page.

export async function NotificationsCard({ accountId }: { accountId: number }) {
  const unread = await countUnreadNotifications(accountId);
  return (
    <Link
      href={NOTIFICATIONS_PATH}
      className="flex min-h-16 items-center gap-3 rounded-card border border-divider bg-surface p-4 transition-colors hover:bg-surface-hover"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-default">
        <Icon icon={Bell} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-control font-semibold text-default">
          {NOTIFICATIONS_COPY.accountCard.heading}
        </span>
        <span className="text-secondary text-muted">
          {unread === 0 ? NOTIFICATIONS_COPY.accountCard.none : unreadCountText(unread)}
        </span>
      </span>
      <Icon icon={ChevronLeft} className="text-muted" />
    </Link>
  );
}
