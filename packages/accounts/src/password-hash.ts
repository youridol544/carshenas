import { argon2id, hash, needsRehash, verify } from 'argon2';
import { createTurns, NoTurnError } from './turns.ts';

// Argon2id with OWASP's first setting (ADR-0020 point 4): 19 MiB of memory, 2 passes, 1 lane, a 16-byte random salt
// (the library's default) and a 32-byte tag, stored as a PHC string. The `argon2` package runs the reference C code
// on libuv's thread pool; when the project moves to Node.js 24, its own crypto.argon2 can replace it, and the stored
// strings stay valid. Never a synchronous hash: it would stop the server for every other request.

const PARAMETERS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const OPTIONS = { ...PARAMETERS, type: argon2id, hashLength: 32 } as const;

// One hash holds a pool thread (four by default) and 19 MiB for about 40 ms. At most two run at once per process, so a
// burst of sign-ins leaves the pool to file and DNS work (the research note measured an fs.stat waiting 150 ms behind
// sixteen hashes, and 2 to 5 ms with two); a request waits at most five seconds for its turn.
const turns = createTurns(2, 5_000);

/** Every thread of the pool is busy hashing: the person is asked to try again in a moment. */
export class PasswordHashingBusyError extends Error {
  constructor(options: { cause: unknown }) {
    super('no turn to hash a password within five seconds', options);
    this.name = 'PasswordHashingBusyError';
  }
}

async function inTurn<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await turns.run(task);
  } catch (error) {
    if (error instanceof NoTurnError) throw new PasswordHashingBusyError({ cause: error });
    throw error;
  }
}

/** The PHC string to store for a normalised password. */
export function hashPassword(password: string): Promise<string> {
  return inTurn(() => hash(password, OPTIONS));
}

/** Whether a normalised password matches a stored hash; the library compares in constant time. */
export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return inTurn(() => verify(passwordHash, password));
}

/** Whether a hash was made with older parameters than today's, so a successful sign-in should store a new one. */
export function hashNeedsUpgrade(passwordHash: string): boolean {
  return needsRehash(passwordHash, PARAMETERS);
}

/**
 * A value made once and kept, unless making it failed: a failure is not kept, so the next call tries again. Kept, a
 * first hash that found no turn within five seconds would answer «busy» to every unknown username from then on,
 * while known ones got «wrong»: a way to tell them apart, and one that no throttle counts (the task review of
 * 2026-09-29).
 */
export function keptUnlessFailed<T>(make: () => Promise<T>): () => Promise<T> {
  let kept: Promise<T> | undefined;
  return () => {
    if (kept === undefined) {
      const made = make();
      kept = made;
      void made.catch(() => {
        if (kept === made) kept = undefined;
      });
    }
    return kept;
  };
}

const unknownAccountHash = keptUnlessFailed(() => hashPassword('a password that belongs to no account'));

/**
 * Spends the time of one real verification for a username that has no account, so the answer takes as long either
 * way and says nothing about which usernames exist (OWASP Authentication Cheat Sheet).
 */
export async function verifyUnknownAccount(password: string): Promise<void> {
  await verifyPassword(await unknownAccountHash(), password);
}
