import type { PasswordProblem } from '@carshenas/accounts/password';
import type { UsernameProblem } from '@carshenas/accounts/username';

// What the sign-in and sign-up actions answer when they do not redirect (ADR-0020). Problems travel as codes and the
// form turns them into Farsi (accounts-copy.ts); only the normalised username comes back, so the form can show it
// again after React resets the fields. The password never does.

/** A reserved name is answered as taken: the person learns nothing about which names are special. */
export type UsernameError = Exclude<UsernameProblem, 'reserved'> | 'taken';
export type PasswordError = PasswordProblem;

export type FormFailure = { kind: 'throttled'; retryAfterSeconds: number } | { kind: 'busy' };

export type SignUpState =
  | { status: 'idle' }
  | {
      status: 'rejected';
      /** Changes with every answer, so the error summary takes focus again after a second failed attempt. */
      submission: number;
      username: string;
      usernameError?: UsernameError;
      passwordError?: PasswordError;
      failure?: FormFailure;
    };

export type SignInState =
  | { status: 'idle' }
  | {
      status: 'rejected';
      submission: number;
      username: string;
      usernameError?: 'empty';
      passwordError?: 'empty';
      /** One answer for a wrong username or a wrong password, whichever it was. */
      failure?: FormFailure | { kind: 'wrong'; failuresInARow: number };
    };

/** The username availability check's answer (the Route Handler under /api/accounts). */
export type UsernameAvailability =
  | { status: 'available' }
  | { status: 'taken' }
  | { status: 'invalid'; problem: Exclude<UsernameProblem, 'reserved'> }
  | { status: 'throttled' };
