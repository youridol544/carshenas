// Plain JSON for the places the layer needs it: provider options, which the SDK takes as JSON while each provider
// types them more loosely; answers stored in ai_answer's jsonb; and the canonical form hashed for prompt versions and
// cache keys. The types are mutable, as the generated database types are, so a value fits both the database and the
// SDK, whose own JSON types are read-only.

export type JsonValue = null | string | number | boolean | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') return Object.values(value).every(isJsonValue);
  return false;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && isJsonValue(value);
}

/** The value as plain JSON, undefined fields dropped; anything JSON cannot carry is refused rather than cast away. */
export function toJsonObject(value: unknown): JsonObject {
  const json: unknown = JSON.parse(JSON.stringify(value));
  if (!isJsonObject(json)) throw new TypeError('expected a plain JSON object');
  return json;
}

function byKey(entries: [string, unknown][]): [string, unknown][] {
  return entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * JSON with every object's keys in code-point order, so equal values always hash the same: `JSON.stringify` keeps
 * insertion order, which a refactor can change without changing the value.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) =>
    nested !== null && typeof nested === 'object' && !Array.isArray(nested)
      ? Object.fromEntries(byKey(Object.entries(nested)))
      : nested,
  );
}
