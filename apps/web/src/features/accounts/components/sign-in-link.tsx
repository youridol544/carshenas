'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { SIGN_IN_PATH, withReturnPath } from '@/lib/return-path';

// A visitor's way in, at the header's inline end (docs/research/2026-09-29-sign-in-and-sign-up-ux.md, section 6):
// words, not an icon («ورود» alone where the header is narrow: a small phone, or text enlarged), outlined so it never
// competes with a page's one solid action, and carrying the page it was pressed on, so signing in comes back to it.

export function SignInLink() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return (
    <Link
      href={withReturnPath(SIGN_IN_PATH, query === '' ? pathname : `${pathname}?${query}`)}
      className="inline-flex min-h-11 items-center rounded-control border border-control px-4 text-control font-semibold text-default transition-colors hover:bg-surface-hover"
    >
      <span className="@max-xs:hidden">{ACCOUNT_COPY.menu.signInLink}</span>
      <span className="@xs:hidden">{ACCOUNT_COPY.menu.signInShort}</span>
    </Link>
  );
}
