import { foldDigits } from './digits.ts';

// Usernames (ADR-0020 point 2): Telegram's alphabet, lowercase Latin letters, digits and underscore, 3 to 30 of them,
// starting with a letter. What a person types becomes the stored form here, and a problem comes back as a code the
// forms turn into Farsi. The database repeats the format (account_username_format) and alone decides whether a name
// is taken (account_username_unique): nothing here reads the table first.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export type UsernameProblem =
  'empty' | 'persian_letters' | 'not_latin' | 'too_short' | 'too_long' | 'starts_without_letter' | 'reserved';

const ARABIC_SCRIPT_LETTER = /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/;
const ALLOWED = /^[a-z0-9_]+$/;

// Names that would pass for the site or its staff (ASVS 6.3.2: no default accounts such as admin or root). A name that
// starts with the brand is refused whatever follows it: carshenas_support, karshenas2.
const RESERVED: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'superadmin',
  'root',
  'system',
  'support',
  'help',
  'info',
  'security',
  'staff',
  'moderator',
  'owner',
  'official',
  'null',
  'undefined',
]);
const RESERVED_PREFIXES = ['carshenas', 'karshenas', 'kaarshenas'] as const;

/** «  Ali_۱۴۰۳ » becomes "ali_1403": spaces at the ends dropped, digits made Latin, capitals lowered. */
export function normalizeUsername(typed: string): string {
  return foldDigits(typed.trim()).toLowerCase();
}

/** Whether a Persian or Arabic letter was typed: the keyboard is probably still on Persian. */
export function hasPersianLetters(text: string): boolean {
  return ARABIC_SCRIPT_LETTER.test(text);
}

/** What is wrong with a normalised username, most useful message first, or undefined when it may be used. */
export function usernameProblem(username: string): UsernameProblem | undefined {
  if (username === '') return 'empty';
  if (hasPersianLetters(username)) return 'persian_letters';
  if (!ALLOWED.test(username)) return 'not_latin';
  if (username.length < USERNAME_MIN_LENGTH) return 'too_short';
  if (username.length > USERNAME_MAX_LENGTH) return 'too_long';
  if (!/^[a-z]/.test(username)) return 'starts_without_letter';
  if (RESERVED.has(username) || RESERVED_PREFIXES.some((prefix) => username.startsWith(prefix)))
    return 'reserved';
  return undefined;
}
