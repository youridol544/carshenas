import 'server-only';

// A token bucket per name and key, in this process's memory (CS-65, ADR-0034): `capacity` requests at once, refilled at
// `perSecond`. It is per process, so with several web processes the allowance is that many times larger; the app runs as
// one process today, and the limit guards a few expensive reads (a rating computed on the spot, a pasted link's answer)
// from a loop, not an account. The keys are client addresses, already coarsened (server/auth/client-address.ts); the map is
// bounded (the oldest keys are forgotten first), and nothing here is stored or logged.

export type BucketRule = { readonly capacity: number; readonly perSecond: number };
type Bucket = { tokens: number; at: number };

const MAX_KEYS = 5000;
const globalForBuckets = globalThis as typeof globalThis & { carshenasBuckets?: Map<string, Bucket> };

function buckets(): Map<string, Bucket> {
  globalForBuckets.carshenasBuckets ??= new Map();
  return globalForBuckets.carshenasBuckets;
}

/** Takes one token; false when the bucket is empty (the caller says «later» and does not do the work). */
export function takeToken(name: string, key: string, rule: BucketRule, now = Date.now()): boolean {
  const all = buckets();
  const id = `${name}|${key}`;
  const found = all.get(id);
  const refilled =
    found === undefined
      ? rule.capacity
      : Math.min(rule.capacity, found.tokens + ((now - found.at) / 1000) * rule.perSecond);
  all.delete(id);
  if (all.size >= MAX_KEYS) {
    for (const old of [...all.keys()].slice(0, MAX_KEYS / 10)) all.delete(old);
  }
  if (refilled < 1) {
    all.set(id, { tokens: refilled, at: now });
    return false;
  }
  all.set(id, { tokens: refilled - 1, at: now });
  return true;
}

/** For tests: forgets every bucket. */
export function resetBuckets(): void {
  buckets().clear();
}
