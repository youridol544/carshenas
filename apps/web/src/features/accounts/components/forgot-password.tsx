import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';

// What a person who forgot their password is looking for, on the sign-in page: not a reset link that cannot work
// (nothing can be recovered until phone sign-in arrives, ADR-0020 point 11), but the honest answer, in a native
// disclosure that works without JavaScript.
export function ForgotPassword() {
  return (
    <details className="text-secondary text-muted">
      <summary className="inline-flex min-h-11 items-center text-link">
        {ACCOUNT_COPY.signIn.forgotSummary}
      </summary>
      <p className="text-pretty">{ACCOUNT_COPY.signIn.forgotBody}</p>
    </details>
  );
}
