'use client';

import type { Route } from 'next';
import { useActionState } from 'react';
import { signInAction } from '@/features/accounts/accounts-actions';
import { ACCOUNT_COPY, FIELD_IDS, signInThrottledMessage } from '@/features/accounts/accounts-copy';
import type { SignInState } from '@/features/accounts/accounts-types';
import { CapsLockText } from '@/features/accounts/components/caps-lock-text';
import { ErrorSummary, type SummaryProblem } from '@/features/accounts/components/error-summary';
import { PasswordField } from '@/features/accounts/components/password-field';
import { SubmitButton } from '@/features/accounts/components/submit-button';
import { useErrorTitle } from '@/features/accounts/components/use-error-title';
import { UsernameField } from '@/features/accounts/components/username-field';

// Signing in: a username and a password on one screen, posted to a Server Action, so it works before JavaScript
// loads. A wrong username or password gets one answer that names neither; three in a row add what usually causes it.

const INITIAL: SignInState = { status: 'idle' };

function problemsOf(state: Extract<SignInState, { status: 'rejected' }>): SummaryProblem[] {
  const problems: SummaryProblem[] = [];
  if (state.usernameError === 'empty') {
    problems.push({
      id: 'username',
      fieldId: FIELD_IDS['sign-in'].username,
      message: ACCOUNT_COPY.errors.signInUsernameEmpty,
    });
  }
  if (state.passwordError === 'empty') {
    problems.push({
      id: 'password',
      fieldId: FIELD_IDS['sign-in'].password,
      message: ACCOUNT_COPY.errors.signInPasswordEmpty,
    });
  }
  const { failure } = state;
  if (failure?.kind === 'wrong') {
    problems.push({
      id: 'failure',
      message: (
        <>
          {ACCOUNT_COPY.errors.signInFailed}
          {failure.failuresInARow >= 3 ? (
            <>
              {' '}
              <CapsLockText {...ACCOUNT_COPY.errors.signInFailedAgain} />
            </>
          ) : null}
        </>
      ),
    });
  } else if (failure?.kind === 'throttled') {
    problems.push({ id: 'failure', message: signInThrottledMessage(failure.retryAfterSeconds) });
  } else if (failure?.kind === 'busy') {
    problems.push({ id: 'failure', message: ACCOUNT_COPY.errors.busy });
  }
  return problems;
}

export function SignInForm({ next }: { next: Route | undefined }) {
  const [state, formAction] = useActionState(signInAction, INITIAL);
  const rejected = state.status === 'rejected' ? state : undefined;
  useErrorTitle(rejected !== undefined);
  return (
    <form id="sign-in" action={formAction} noValidate className="flex flex-col gap-6">
      {rejected === undefined ? null : (
        <ErrorSummary key={rejected.submission} problems={problemsOf(rejected)} />
      )}
      <input type="hidden" name="next" value={next ?? ''} />
      <UsernameField
        key={`username-${String(rejected?.submission)}`}
        purpose="sign-in"
        defaultValue={rejected?.username ?? ''}
        error={rejected?.usernameError}
      />
      <PasswordField
        key={`password-${String(rejected?.submission)}`}
        purpose="current"
        error={rejected?.passwordError === 'empty' ? ACCOUNT_COPY.errors.signInPasswordEmpty : undefined}
      />
      <SubmitButton>{ACCOUNT_COPY.signIn.submit}</SubmitButton>
    </form>
  );
}
