import { toLatinDigits } from '@carshenas/locale/digits';

// The password rules the sign-up form can also show while someone types (ADR-0020 point 3). Safe for the browser: the
// common-password list lives in common-passwords.ts, which only the server loads.

export const PASSWORD_MIN_LENGTH = 8;
/** Typed superadmin passwords; generated ones are 24 symbols (generated-password.ts). */
export const SUPERADMIN_PASSWORD_MIN_LENGTH = 20;
export const PASSWORD_MAX_LENGTH = 128;

// Unicode's spaces other than U+0020, which RFC 8265 maps to it: the no-break space (Shift+Space on a Persian
// keyboard), the Ogham space mark, the typographic spaces U+2000 to U+200A, and the narrow no-break, medium
// mathematical and ideographic spaces. Code points, not escapes, so no invisible character sits in this file.
const OTHER_SPACES: ReadonlySet<number> = new Set([
  0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x202f, 0x205f, 0x3000,
]);

// The Arabic letters some systems' Persian keyboards still type, as their Persian forms: yeh and alef maksura become
// «ی» (U+06CC), kaf becomes «ک» (U+06A9). The search normaliser folds the same letters (ADR-0011).
const PERSIAN_FORM: ReadonlyMap<number, string> = new Map([
  [0x064a, String.fromCodePoint(0x06cc)],
  [0x0649, String.fromCodePoint(0x06cc)],
  [0x0643, String.fromCodePoint(0x06a9)],
]);

/**
 * The form a password is checked and hashed in, at sign-up and at sign-in alike: Unicode NFC (NIST SP 800-63B-4),
 * other spaces as U+0020, Persian and Arabic-Indic digits as Latin, Arabic ي, ى and ك as Persian ی and ک. Nothing is
 * trimmed and case is kept. So the same password typed on a phone's Persian keyboard and on Windows matches, a named
 * departure from ASVS 6.2.8 ("exactly as received"); it can never be undone for stored hashes.
 */
export function normalizePassword(typed: string): string {
  return Array.from(toLatinDigits(typed.normalize('NFC')), (character) => {
    const code = character.codePointAt(0) ?? 0;
    if (OTHER_SPACES.has(code)) return ' ';
    return PERSIAN_FORM.get(code) ?? character;
  }).join('');
}

/** Characters as NIST counts them, one per Unicode code point: «رمز» is 3, an emoji is 1. */
export function passwordLength(password: string): number {
  return Array.from(password).length;
}
