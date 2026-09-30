import { BellRing } from 'lucide-react';
import { ActionLink } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { NotificationRowFrame } from '@/features/notifications/components/notification-row-frame';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';
import { HOME_PATH } from '@/lib/return-path';

// The inbox's first-use and loading states (ui-design craft.md, sections 3 and 6). The empty inbox says what will
// appear here and offers one way forward; the skeleton renders the rows' own frame, so its rows are as tall as real
// ones, fades in only after the pending delay so a quick answer never flashes it, and says in one hidden sentence
// what is loading.

export function InboxEmpty() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border border-divider bg-surface p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-default">
        <Icon icon={BellRing} size={24} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-heading font-bold">{NOTIFICATIONS_COPY.empty.heading}</h2>
        <p className="max-w-reading text-body text-pretty text-muted">{NOTIFICATIONS_COPY.empty.body}</p>
      </div>
      <ActionLink level="primary" href={HOME_PATH}>
        {NOTIFICATIONS_COPY.empty.action}
      </ActionLink>
    </div>
  );
}

const SKELETON_ROWS = ['row-1', 'row-2', 'row-3', 'row-4'] as const;

function Bar({ width }: { width: 'w-1/3' | 'w-1/2' | 'w-2/3' | 'w-5/6' }) {
  return (
    <span className="flex min-h-lh items-center">
      <span className={`block h-3 rounded-badge bg-skeleton ${width}`} />
    </span>
  );
}

export function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-6 opacity-100 transition-opacity delay-pending duration-popover starting:opacity-0">
      <p role="status" className="sr-only">
        {NOTIFICATIONS_COPY.loading}
      </p>
      <div aria-hidden className="flex min-h-11 items-center text-secondary">
        <Bar width="w-1/3" />
      </div>
      <div aria-hidden className="flex flex-col gap-2">
        <div className="text-label">
          <Bar width="w-1/3" />
        </div>
        <div className="overflow-hidden rounded-card border border-divider bg-surface">
          {SKELETON_ROWS.map((key) => (
            <div key={key} className="border-b border-divider last:border-b-0">
              <NotificationRowFrame
                icon={null}
                title={<Bar width="w-5/6" />}
                detail={<Bar width="w-2/3" />}
                price={<Bar width="w-1/2" />}
                meta={<Bar width="w-1/3" />}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
