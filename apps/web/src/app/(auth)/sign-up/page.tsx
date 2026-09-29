import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { AuthScreen } from '@/features/accounts/components/auth-screen';
import { SignUpForm } from '@/features/accounts/components/sign-up-form';
import { landingAfterSignIn, safeReturnPath, SIGN_IN_PATH, withReturnPath } from '@/lib/return-path';
import { currentAccount } from '@/server/auth/current-account';

export const metadata: Metadata = { title: ACCOUNT_COPY.signUp.title };

// Reads the session before anything is sent, so a signed-in person gets a real redirect, never a flash of the form.
export const instant = false;

export default async function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  const next = safeReturnPath((await searchParams).next);
  const account = await currentAccount();
  if (account !== null) redirect(landingAfterSignIn(next, account.role === 'superadmin'));
  return (
    <AuthScreen
      heading={ACCOUNT_COPY.signUp.heading}
      lead={ACCOUNT_COPY.signUp.lead}
      switchQuestion={ACCOUNT_COPY.signUp.switchQuestion}
      switchLink={ACCOUNT_COPY.signUp.switchLink}
      switchHref={withReturnPath(SIGN_IN_PATH, next)}
    >
      <SignUpForm next={next} />
    </AuthScreen>
  );
}
