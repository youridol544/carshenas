'use client';

import { Menu } from '@base-ui/react/menu';
import { CircleUserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { Icon } from '@/components/ui/icon';
import { signOutAction } from '@/features/accounts/accounts-actions';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { ACCOUNT_PATH, ADMIN_PATH } from '@/lib/return-path';

// A signed-in person's menu (docs/research/2026-09-29-sign-in-and-sign-up-ux.md, section 6): a 44 px button of the
// same size on every screen, whose menu names the account, links to the account page, to the superadmin section for
// the superadmin only (the owner's request of 2026-09-29; nobody else's page ever links it), and signs out. Base UI's
// menu gives the keyboard model and right-to-left placement (ADR-0005). Signing out is a form post, never a link a
// browser could prefetch; a plain form keeps working on the account page without this script.

// The highlight follows the pointer and the arrow keys alike; the focus ring, from the base styles, shows only when the
// keyboard moved it there, so a keyboard user sees where they are at 3:1 and not only the faint highlight.
const ITEM_CLASSES =
  'flex min-h-11 w-full items-center rounded-control px-3 text-control text-default data-highlighted:bg-surface-hover';

export function AccountMenu({ username, isSuperadmin }: { username: string; isSuperadmin: boolean }) {
  const pathname = usePathname();
  const signOutForm = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={signOutForm} action={signOutAction} hidden>
        <input type="hidden" name="next" value={pathname} />
      </form>
      <Menu.Root>
        <Menu.Trigger
          aria-label={ACCOUNT_COPY.menu.button}
          className="inline-flex size-11 items-center justify-center rounded-full text-default transition-colors hover:bg-surface-hover data-popup-open:bg-surface-pressed"
        >
          <Icon icon={CircleUserRound} size={24} />
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
