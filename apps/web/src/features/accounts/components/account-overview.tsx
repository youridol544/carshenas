import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { signOutAction } from '@/features/accounts/accounts-actions';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { formatDate } from '@/lib/format-date';
import { ADMIN_PATH } from '@/lib/return-path';

// The account page (CS-39's criterion 6): who is signed in, since when, and a way out that works without JavaScript.
// Marked listings, search files and notifications add their own sections here (CS-68, CS-69, CS-70).

type AccountOverviewProps = { username: string; createdAt: Date; isSuperadmin: boolean };

export function AccountOverview({ username, createdAt, isSuperadmin }: AccountOverviewProps) {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <h1 className="text-title font-bold">{ACCOUNT_COPY.accountPage.title}</h1>
      <dl className="flex flex-col gap-4 rounded-card border border-divider p-4">
        <div className="flex flex-col gap-1">
          <dt className="text-label font-medium text-muted">{ACCOUNT_COPY.accountPage.username}</dt>
          <dd className="text-body text-default">
            {/* A 30-letter name has no break point of its own; it wraps rather than widen a 320 px page. */}
            <span dir="ltr" className="wrap-anywhere">
              {username}
            </span>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-label font-medium text-muted">{ACCOUNT_COPY.accountPage.memberSince}</dt>
          <dd className="text-body text-default">{formatDate(createdAt)}</dd>
        </div>
      </dl>
      {isSuperadmin ? (
        <p className="flex flex-wrap items-center gap-x-3 text-body">
          {ACCOUNT_COPY.accountPage.superadmin}
          <Link href={ADMIN_PATH} className="inline-flex min-h-11 items-center text-link underline">
            {ACCOUNT_COPY.menu.admin}
          </Link>
        </p>
      ) : null}
      <form action={signOutAction}>
        <button type="submit" className={actionClasses('secondary')}>
          {ACCOUNT_COPY.menu.signOut}
        </button>
      </form>
    </main>
  );
}
