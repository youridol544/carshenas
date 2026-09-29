import { isCommonPassword } from './common-passwords.ts';
import { fromPersianLayout } from './persian-layout.ts';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordLength } from './password-rules.ts';

// Whether a normalised password may be used (ADR-0020 point 3), as a code the forms turn into Farsi that says why and
// how to do better (NIST SP 800-63B-4: "SHALL provide the reason for rejection"). No composition rules. Server only,
// through common-passwords.ts.

export type PasswordProblem = 'empty' | 'too_short' | 'too_long' | 'common' | 'built_from_name';

const SITE_NAMES = ['carshenas', 'karshenas', 'کارشناس'] as const;
const LETTER = /\p{L}/u;

/**
 * Built from a name: the username or the site's name with nothing but digits, marks and spaces around it
 * ("ali_14031403" for ali_1403, "Carshenas2026", «کارشناس۱۲۳»), also when typed with the Persian layout on. A name
 * inside real words ("my carshenas notes") is allowed.
 */
function builtFromName(password: string, username: string): boolean {
  const names: readonly string[] = username.length >= 3 ? [...SITE_NAMES, username] : SITE_NAMES;
  const readings = [password.toLowerCase(), fromPersianLayout(password).toLowerCase()];
  return readings.some((reading) =>
    names.some((name) => reading.includes(name) && !LETTER.test(reading.replaceAll(name, ''))),
  );
}

/** The first thing wrong with a normalised password, or undefined when it may be used. */
export function passwordProblem(
  password: string,
  { username, minimumLength = PASSWORD_MIN_LENGTH }: { username: string; minimumLength?: number },
): PasswordProblem | undefined {
  if (password === '') return 'empty';
  const length = passwordLength(password);
  if (length < minimumLength) return 'too_short';
  if (length > PASSWORD_MAX_LENGTH) return 'too_long';
  if (isCommonPassword(password)) return 'common';
  if (builtFromName(password, username)) return 'built_from_name';
  return undefined;
}
