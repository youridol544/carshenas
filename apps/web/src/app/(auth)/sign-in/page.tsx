import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';
import { AuthScreen } from '@/features/accounts/components/auth-screen';
import { ForgotPassword } from '@/features/accounts/components/forgot-password';
import { SignInForm } from '@/features/accounts/components/sign-in-form';
import { landingAfterSignIn, safeReturnPath, SIGN_UP_PATH, withReturnPath } from '@/lib/return-path';
import { currentAccount } from '@/server/auth/current-account';

export const metadata: Metadata = { title: ACCOUNT_COPY.signIn.title };

// Reads the session before anything is sent, so a signed-in person gets a real redirect, never a flash of the form.
export const instant = false;

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const next = safeReturnPath((await searchParams).next);
  const account = await currentAccount();
  if (account !== null) redirect(landingAfterSignIn(next, account.role === 'superadmin'));
  return (
    <AuthScreen
      heading={ACCOUNT_COPY.signIn.heading}
      switchQuestion={ACCOUNT_COPY.signIn.switchQuestion}
      switchLink={ACCOUNT_COPY.signIn.switchLink}
      switchHref={withReturnPath(SIGN_UP_PATH, next)}
      after={<ForgotPassword />}
    >
      <SignInForm next={next} />
    </AuthScreen>
  );
}
