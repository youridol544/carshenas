import commonPasswords from './common-passwords.json' with { type: 'json' };
import { fromPersianLayout } from './persian-layout.ts';

// The blocklist of ADR-0020 point 3: the UK National Cyber Security Centre's 100,000 most used passwords (from
// SecLists, MIT licence: Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt, fetched 2026-09-29), kept
// only where at least 8 printable ASCII characters long, since shorter ones fail the length rule first, lowercased and
// deduplicated: 46,453 entries. A match is exact on the whole password (NIST: not substrings), also after lowercasing
// and after mapping keys typed with the Persian layout back to Latin. Server only: the list is about 590 kB.

const COMMON: ReadonlySet<string> = new Set(commonPasswords);

/** "Password1", "PASSWORD1" and «حشسسصخقی1» are all common. */
export function isCommonPassword(password: string): boolean {
  return COMMON.has(password.toLowerCase()) || COMMON.has(fromPersianLayout(password).toLowerCase());
}
