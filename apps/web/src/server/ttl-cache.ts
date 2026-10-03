import 'server-only';

// A small cache in this process's memory with an expiry, for a read that is expensive and the same for everyone (CS-65: the
// rating computed on the spot for a listing the daily run did not rate, ~70 ms of SQL). Per process, bounded (the oldest
// entries go first), and a value is never older than `ttlMs`. `undefined` is "not cached"; cache `null` for "no answer".

export type TtlCache<K, V> = {
  get(key: K, now?: number): V | undefined;
  set(key: K, value: V, now?: number): void;
  clear(): void;
};

export function ttlCache<K, V>(ttlMs: number, maxEntries: number): TtlCache<K, V> {
  const entries = new Map<K, { value: V; until: number }>();
  return {
    get(key, now = Date.now()) {
      const found = entries.get(key);
      if (found === undefined) return undefined;
      if (found.until <= now) {
        entries.delete(key);
        return undefined;
      }
      return found.value;
    },
    set(key, value, now = Date.now()) {
      entries.delete(key);
      if (entries.size >= maxEntries) {
        for (const old of [...entries.keys()].slice(0, Math.ceil(maxEntries / 10))) entries.delete(old);
      }
      entries.set(key, { value, until: now + ttlMs });
    },
    clear() {
      entries.clear();
    },
  };
}
