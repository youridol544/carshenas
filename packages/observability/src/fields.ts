import { isError, serializeError } from './errors.ts';
import { isSensitiveKey, REDACTED, redactText } from './redact.ts';

// Log fields as plain, bounded, redacted JSON values, whatever the caller passed: an Error anywhere becomes a
// serialised error, a secret-named field is replaced, strings are scrubbed, and cycles, depth and size are capped,
// so a log call can never throw, leak or write a megabyte line. Pure, so it is tested without a logger.

export type LogFields = Readonly<Record<string, unknown>>;

const MAX_DEPTH = 6;
const MAX_KEYS = 50;
const MAX_ITEMS = 50;
const MAX_STRING = 8_000;

function sanitizeString(text: string): string {
  const redacted = redactText(text);
  return redacted.length > MAX_STRING
    ? `${redacted.slice(0, MAX_STRING)}… [${redacted.length - MAX_STRING} more characters]`
    : redacted;
}

function sanitizeObject(value: object, depth: number, seen: WeakSet<object>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = Object.keys(value);
  for (const key of keys.slice(0, MAX_KEYS)) {
    result[key] = isSensitiveKey(key)
      ? REDACTED
      : sanitizeValue((value as Record<string, unknown>)[key], depth + 1, seen);
  }
  if (keys.length > MAX_KEYS) result['…'] = `${keys.length - MAX_KEYS} more keys`;
  return result;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  switch (typeof value) {
    case 'string':
      return sanitizeString(value);
    case 'number':
    case 'boolean':
    case 'undefined':
      return value;
    case 'bigint':
      return value.toString();
    case 'function':
    case 'symbol':
      return undefined;
    case 'object':
      break;
  }
  if (value === null) return null;
  if (isError(value)) return serializeError(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  if (value instanceof URL) return sanitizeString(value.href);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return `[binary: ${value.byteLength} bytes]`;
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[too deep]';
  seen.add(value);
  try {
    if (Array.isArray(value) || value instanceof Set) {
      const items: unknown[] = Array.from(value as Iterable<unknown>);
      const sanitized = items.slice(0, MAX_ITEMS).map((item) => sanitizeValue(item, depth + 1, seen));
      if (items.length > MAX_ITEMS) sanitized.push(`… ${items.length - MAX_ITEMS} more items`);
      return sanitized;
    }
    if (value instanceof Map) {
      const entries: Record<string, unknown> = {};
      for (const [key, item] of value as Map<unknown, unknown>) entries[String(key)] = item;
      return sanitizeObject(entries, depth, seen);
    }
    return sanitizeObject(value, depth, seen);
  } finally {
    seen.delete(value);
  }
}

/** The fields as JSON-safe values: errors serialised, secrets redacted, strings scrubbed, size bounded. */
export function sanitizeFields(fields: LogFields): Record<string, unknown> {
  return sanitizeObject(fields, 0, new WeakSet());
}
