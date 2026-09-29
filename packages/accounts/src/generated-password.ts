import { randomInt } from 'node:crypto';

// A superadmin's password when the command makes one (ADR-0020 point 9): 24 symbols drawn uniformly from 32 that are
// hard to misread (no l, o, 0 or 1), 120 bits, in four groups of six so it can be read aloud or copied by hand.

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const GROUPS = 4;
const GROUP_LENGTH = 6;

export function generatePassword(): string {
  return Array.from({ length: GROUPS }, () =>
    Array.from({ length: GROUP_LENGTH }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join(''),
  ).join('-');
}
