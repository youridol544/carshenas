'use client';

import { Menu } from '@base-ui/react/menu';
import { CircleUserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { Icon } from '@/components/ui/icon';
import { signOutAction } from '@/features/accounts/accounts-actions';
import { ACCOUNT_COPY, accountMenuLabelWithUnread } from '@/features/accounts/accounts-copy';
import { formatCount } from '@carshenas/locale/format-number';
import { ACCOUNT_PATH, ADMIN_PATH, NOTIFICATIONS_PATH } from '@/lib/return-path';

// A signed-in person's menu (docs/research/2026-09-29-sign-in-and-sign-up-ux.md, section 6): a 44 px button of the
// same size on every screen, whose menu names the account, links to the account page, to the superadmin section for
// the superadmin only (the owner's request of 2026-09-29; nobody else's page ever links it), and signs out. Base UI's
// menu gives the keyboard model and right-to-left placement (ADR-0005). Signing out is a form post, never a link a
// browser could prefetch; a plain form keeps working on the account page without this script. A buyer's unread
// notifications (CS-68) show as a badge on the button's corner, laid over it so it moves nothing, and beside the
// menu's link to the inbox; the button's name says the count too.

// The highlight follows the pointer and the arrow keys alike; the focus ring, from the base styles, shows only when the
// keyboard moved it there, so a keyboard user sees where they are at 3:1 and not only the faint highlight.
const ITEM_CLASSES =
  'flex min-h-11 w-full items-center rounded-control px-3 text-control text-default data-highlighted:bg-surface-hover';

/** «۳», up to «۹۹+»: a badge stays narrow. */
function badgeCount(count: number): string {
  return count > 99 ? `${formatCount(99)}+` : formatCount(count);
}

type AccountMenuProps = {
  username: string;
  isSuperadmin: boolean;
  /** Unread notifications; none shown when undefined (a count that could not be read) or zero. */
  unreadCount?: number;
};

export function AccountMenu({ username, isSuperadmin, unreadCount }: AccountMenuProps) {
  const pathname = usePathname();
  const unread = unreadCount ?? 0;
  const signOutForm = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={signOutForm} action={signOutAction} hidden>
        <input type="hidden" name="next" value={pathname} />
      </form>
      <Menu.Root>
        <Menu.Trigger
          aria-label={unread > 0 ? accountMenuLabelWithUnread(unread) : ACCOUNT_COPY.menu.button}
          className="relative inline-flex size-11 items-center justify-center rounded-full text-default transition-colors hover:bg-surface-hover data-popup-open:bg-surface-pressed"
        >
          <Icon icon={CircleUserRound} size={24} />
          {unread > 0 ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-e-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-canvas bg-action px-1 text-meta font-semibold text-on-action tabular-nums"
            >
              {badgeCount(unread)}
            </span>
          ) : null}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8} align="end">
            <Menu.Popup className="flex max-w-(--available-width) min-w-56 flex-col gap-1 rounded-card border border-divider bg-surface p-2 shadow-overlay">
              <Menu.Group>
                <Menu.GroupLabel className="px-3 py-2 text-secondary text-muted">
                  <span dir="ltr" className="wrap-anywhere">
                    {username}
                  </span>
                </Menu.GroupLabel>
              </Menu.Group>
              <Menu.LinkItem render={<Link href={ACCOUNT_PATH} />} closeOnClick className={ITEM_CLASSES}>
                {ACCOUNT_COPY.menu.account}
              </Menu.LinkItem>
              {unreadCount === undefined ? null : (
                <Menu.LinkItem
                  render={<Link href={NOTIFICATIONS_PATH} />}
                  closeOnClick
                  className={`${ITEM_CLASSES} justify-between gap-3`}
                >
                  {ACCOUNT_COPY.menu.notifications}
                  {unread > 0 ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-action px-2 text-label text-on-action tabular-nums">
                      {badgeCount(unread)}
                    </span>
                  ) : null}
                </Menu.LinkItem>
              )}
              {isSuperadmin ? (
                <Menu.LinkItem render={<Link href={ADMIN_PATH} />} closeOnClick className={ITEM_CLASSES}>
                  {ACCOUNT_COPY.menu.admin}
                </Menu.LinkItem>
              ) : null}
              <Menu.Separator className="my-1 h-px bg-surface-pressed" />
              <Menu.Item
                onClick={() => {
                  signOutForm.current?.requestSubmit();
                }}
                className={ITEM_CLASSES}
              >
                {ACCOUNT_COPY.menu.signOut}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  );
}
