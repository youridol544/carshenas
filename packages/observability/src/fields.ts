import { isError, serializeError, type SerializeOptions } from './errors.ts';
import { isSensitiveKey, REDACTED, redactAndTruncate } from './redact.ts';

// Log fields as plain, bounded, redacted JSON values, whatever the caller passed: an Error anywhere becomes a
// serialised error, a secret-named field is replaced, strings are scrubbed, and cycles, depth and size are capped,
// so a log call can never throw, leak or write a megabyte line. Pure, so it is tested without a logger.

export type LogFields = Readonly<Record<string, unknown>>;

const MAX_DEPTH = 6;
const MAX_KEYS = 50;
const MAX_ITEMS = 50;
const MAX_STRING = 8_000;

function sanitizeString(text: string): string {
  return redactAndTruncate(text, MAX_STRING);
}

type Walk = { seen: WeakSet<object>; errors: SerializeOptions };

function sanitizeObject(value: object, depth: number, walk: Walk): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = Object.keys(value);
  for (const key of keys.slice(0, MAX_KEYS)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
      continue;
    }
    let item: unknown;
    try {
      item = (value as Record<string, unknown>)[key];
    } catch {
      result[key] = '[unreadable]';
      continue;
    }
    result[key] = sanitizeValue(item, depth + 1, walk);
  }
  if (keys.length > MAX_KEYS) result['…'] = `${keys.length - MAX_KEYS} more keys`;
  return result;
}

function sanitizeValue(value: unknown, depth: number, walk: Walk): unknown {
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
  if (isError(value)) return serializeError(value, walk.errors);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  if (value instanceof URL) return sanitizeString(value.href);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return `[binary: ${value.byteLength} bytes]`;
  if (walk.seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[too deep]';
  walk.seen.add(value);
  try {
    if (Array.isArray(value) || value instanceof Set) {
      const items: unknown[] = Array.from(value as Iterable<unknown>);
      const sanitized = items.slice(0, MAX_ITEMS).map((item) => sanitizeValue(item, depth + 1, walk));
      if (items.length > MAX_ITEMS) sanitized.push(`… ${items.length - MAX_ITEMS} more items`);
      return sanitized;
    }
    if (value instanceof Map) {
      const entries: Record<string, unknown> = {};
      for (const [key, item] of value as Map<unknown, unknown>) entries[String(key)] = item;
      return sanitizeObject(entries, depth, walk);
    }
    return sanitizeObject(value, depth, walk);
  } finally {
    walk.seen.delete(value);
  }
}

/** The fields as JSON-safe values: errors serialised, secrets redacted, strings scrubbed, size bounded. */
export function sanitizeFields(fields: LogFields, errors: SerializeOptions = {}): Record<string, unknown> {
  return sanitizeObject(fields, 0, { seen: new WeakSet(), errors });
}

/** Any one value, made safe the same way: for an object printed as text, such as a console argument. */
export function sanitizeLoggedValue(value: unknown): unknown {
  return sanitizeValue(value, 0, { seen: new WeakSet(), errors: {} });
}
