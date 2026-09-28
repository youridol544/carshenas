import { isSensitiveKey, REDACTED, redactText } from './redact.ts';

// A thrown value as a plain, bounded, redacted object, the shape every error takes in a log line (ADR-0016). It keeps
// what finds a root cause: the type, the message, the stack, the whole cause chain (a failed fetch's ECONNRESET sits
// in its cause), an AggregateError's members, and the error's own fields such as PostgreSQL's SQLSTATE `code` and
// `constraint` or Next.js's `digest`. Pure and dependency-free, so the browser reporter serialises the same way.

export type SerializedError = {
  type: string;
  message: string;
  stack?: string;
  cause?: SerializedError;
  errors?: SerializedError[];
  /** Own fields with primitive values: `code`, `errno`, `syscall`, `constraint`, `detail`, `digest`, … */
  [field: string]: unknown;
};

const MAX_DEPTH = 5;
const MAX_MEMBERS = 10;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_STACK_LENGTH = 16_000;
const MAX_FIELD_LENGTH = 1_000;
const MAX_FIELDS = 30;
// Read on their own below, or not worth a field: `length` is a byte count PostgreSQL's driver adds to every error.
const HANDLED_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'message',
  'stack',
  'cause',
  'errors',
  'length',
]);

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}… [${text.length - limit} more characters]` : text;
}

/** Whether a value is an Error, including one from another realm (a jsdom window, a `vm` context). */
export function isError(value: unknown): value is Error {
  return value instanceof Error || Object.prototype.toString.call(value) === '[object Error]';
}

function typeOf(error: Error): string {
  // A subclass that does not set its own name still carries its class name: `class SourceBlockedError extends
  // Error {}` reports SourceBlockedError, not Error.
  if (error.name && error.name !== 'Error') return error.name;
  const constructorName = (error as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof constructorName === 'string' && constructorName !== '' && constructorName !== 'Object'
    ? constructorName
    : 'Error';
}

function primitiveField(value: unknown): unknown {
  switch (typeof value) {
    case 'string':
      return truncate(redactText(value), MAX_FIELD_LENGTH);
    case 'number':
    case 'boolean':
      return value;
    case 'bigint':
      return value.toString();
    default:
      return value === null ? null : undefined;
  }
}

function describe(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    // A cycle or a BigInt inside the object.
    return Object.prototype.toString.call(value);
  }
}

function serialize(value: unknown, depth: number, seen: WeakSet<object>): SerializedError {
  if (!isError(value)) {
    // `throw 'text'`, `throw 404`, a rejected promise with a plain object: keep what it said and what it was.
    const type = value === null ? 'null' : typeof value === 'object' ? 'Object' : typeof value;
    const message =
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { message?: unknown }).message === 'string'
        ? (value as { message: string }).message
        : describe(value);
    return { type, message: truncate(redactText(message), MAX_MESSAGE_LENGTH) };
  }
  seen.add(value);
  const serialized: SerializedError = {
    type: typeOf(value),
    message: truncate(redactText(value.message), MAX_MESSAGE_LENGTH),
  };
  if (typeof value.stack === 'string') serialized.stack = truncate(redactText(value.stack), MAX_STACK_LENGTH);

  let fields = 0;
  for (const key of Object.keys(value)) {
    if (HANDLED_FIELDS.has(key) || fields >= MAX_FIELDS) continue;
    const field = isSensitiveKey(key)
      ? REDACTED
      : primitiveField((value as unknown as Record<string, unknown>)[key]);
    if (field === undefined) continue;
    serialized[key] = field;
    fields += 1;
  }

  // `cause` given to the constructor is an own property that is not enumerable, so it is read by name.
  const { cause } = value as { cause?: unknown };
  if (cause !== undefined && depth < MAX_DEPTH) {
    serialized.cause =
      typeof cause === 'object' && cause !== null && seen.has(cause)
        ? { type: 'Circular', message: 'the cause chain loops back to an error already shown' }
        : serialize(cause, depth + 1, seen);
  }

  const { errors } = value as { errors?: unknown };
  if (Array.isArray(errors) && depth < MAX_DEPTH) {
    const members: unknown[] = errors;
    serialized.errors = members
      .slice(0, MAX_MEMBERS)
      .map((member) =>
        typeof member === 'object' && member !== null && seen.has(member)
          ? { type: 'Circular', message: 'this member is an error already shown' }
          : serialize(member, depth + 1, seen),
      );
    if (members.length > MAX_MEMBERS) serialized.omittedErrors = members.length - MAX_MEMBERS;
  }
  return serialized;
}

/** Any thrown value as a bounded, redacted plain object: `{ type, message, stack, cause, errors, …fields }`. */
export function serializeError(value: unknown): SerializedError {
  return serialize(value, 0, new WeakSet());
}

/**
 * A key that is the same for every occurrence of one bug: the type, the message with numbers blanked out, and the
 * first stack frame. Reports of the same failure are counted instead of logged again.
 */
export function errorFingerprint(error: SerializedError): string {
  const firstFrame = error.stack
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('at ') || line.includes('@'));
  return [error.type, error.message.replaceAll(/\d+/g, '0'), firstFrame ?? ''].join('|');
}
