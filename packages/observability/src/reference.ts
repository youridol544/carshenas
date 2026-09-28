// The code an error shows a person and its log line carries (ADR-0016): ten digits, easy to read out and to search
// for. Uses the Web Crypto every supported runtime has (browsers, Node.js 22). Pure apart from the random source.

const LENGTH = 10;
// The largest multiple of 10 a byte can hold: a byte from 250 up is drawn again, so every digit is equally likely
// (with `byte % 10` alone, 0 to 5 would come up more often than 6 to 9).
const UNBIASED_LIMIT = 250;

/** A new ten-digit reference code. */
export function newReference(): string {
  let reference = '';
  while (reference.length < LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(LENGTH))) {
      if (byte < UNBIASED_LIMIT && reference.length < LENGTH) reference += String(byte % 10);
    }
  }
  return reference;
}
