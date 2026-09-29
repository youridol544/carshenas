'use client';

import type { Route } from 'next';
import { useActionState } from 'react';
import { signUpAction } from '@/features/accounts/accounts-actions';
import {
  ACCOUNT_COPY,
  FIELD_IDS,
  passwordErrorMessage,
  signUpThrottledMessage,
  usernameErrorMessage,
} from '@/features/accounts/accounts-copy';
import type { SignUpState } from '@/features/accounts/accounts-types';
import { ErrorSummary, type SummaryProblem } from '@/features/accounts/components/error-summary';
import { PasswordField } from '@/features/accounts/components/password-field';
import { SubmitButton } from '@/features/accounts/components/submit-button';
import { useErrorTitle } from '@/features/accounts/components/use-error-title';
import { UsernameField } from '@/features/accounts/components/username-field';
import { SIGN_IN_PATH, withReturnPath } from '@/lib/return-path';

// Signing up: a username and a password on one screen, no second password field (the show button replaces it), the
// rules said before typing, and a plain word that a forgotten password cannot be recovered yet (ADR-0020 point 11).
// Signing up signs the person in and returns them to where they were.

const INITIAL: SignUpState = { status: 'idle' };

function problemsOf(state: Extract<SignUpState, { status: 'rejected' }>): SummaryProblem[] {
  const problems: SummaryProblem[] = [];
  if (state.usernameError !== undefined) {
    problems.push({
      id: 'username',
      fieldId: FIELD_IDS['sign-up'].username,
      message: usernameErrorMessage(state.usernameError),
    });
  }
  if (state.passwordError !== undefined) {
    problems.push({
      id: 'password',
      fieldId: FIELD_IDS['sign-up'].password,
      message: passwordErrorMessage(state.passwordError),
    });
  }
  if (state.failure?.kind === 'throttled') {
    problems.push({ id: 'failure', message: signUpThrottledMessage(state.failure.retryAfterSeconds) });
  } else if (state.failure?.kind === 'busy') {
    problems.push({ id: 'failure', message: ACCOUNT_COPY.errors.busy });
  }
  return problems;
}

export function SignUpForm({ next }: { next: Route | undefined }) {
  const [state, formAction] = useActionState(signUpAction, INITIAL);
  const rejected = state.status === 'rejected' ? state : undefined;
  useErrorTitle(rejected !== undefined);
  return (
    <form id="sign-up" action={formAction} noValidate className="flex flex-col gap-6">
      {rejected === undefined ? null : (
        <ErrorSummary key={rejected.submission} problems={problemsOf(rejected)} />
      )}
      <input type="hidden" name="next" value={next ?? ''} />
      <UsernameField
        key={`username-${String(rejected?.submission)}`}
        purpose="sign-up"
        defaultValue={rejected?.username ?? ''}
        error={rejected?.usernameError}
        signInHref={withReturnPath(SIGN_IN_PATH, next)}
      />
      <PasswordField
        key={`password-${String(rejected?.submission)}`}
        purpose="new"
        error={
          rejected?.passwordError === undefined ? undefined : passwordErrorMessage(rejected.passwordError)
        }
      />
      <p className="text-secondary text-pretty text-muted">{ACCOUNT_COPY.signUp.recoveryNote}</p>
      <SubmitButton>{ACCOUNT_COPY.signUp.submit}</SubmitButton>
    </form>
  );
}
