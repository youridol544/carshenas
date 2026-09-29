import type { Route } from 'next';
import Link from 'next/link';

// The frame of the sign-in and sign-up pages: one column that fills a phone and is centred on a desktop at 24rem, a
// title, an optional line under it, the form, and one line that switches to the other page (GitHub, Supabase, Linear:
// under the primary action), carrying the same return path. The gutter sits outside the column, as in the header, so
// on a phone the form's edge lines up with the name above it.

type AuthScreenProps = {
  heading: string;
  lead?: string;
  switchQuestion: string;
  switchLink: string;
  switchHref: Route;
  children: React.ReactNode;
  after?: React.ReactNode;
};

export function AuthScreen({
  heading,
  lead,
  switchQuestion,
  switchLink,
  switchHref,
  children,
  after,
}: AuthScreenProps) {
  return (
    <main className="flex w-full flex-1 flex-col px-4 pt-8 pb-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-title font-bold text-balance">{heading}</h1>
          {lead === undefined ? null : <p className="text-body text-pretty text-muted">{lead}</p>}
        </div>
        {children}
        <p className="text-body text-muted">
          {switchQuestion}{' '}
          <Link href={switchHref} className="text-link underline">
            {switchLink}
          </Link>
        </p>
        {after}
      </div>
    </main>
  );
}
