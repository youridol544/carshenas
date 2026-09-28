// What must never reach a log line: credentials and personal data (ADR-0016). Fields are matched by name, and every
// string is scrubbed by pattern, because a password or a seller's phone number hides inside an error message or a URL
// as easily as in a field called `password`. Pure and dependency-free, so the browser reporter uses it too.

export const REDACTED = '[redacted]';

// Field names are compared lowercased, without `-` and `_`, so `api_key`, `apiKey` and `API-KEY` are one name.
// A name that ends with one of these is always a secret: `dbPassword`, `webhookSecret`, `set-cookie`.
const SECRET_SUFFIXES = [
  'password',
  'passwd',
  'secret',
  'apikey',
  'privatekey',
  'accesskey',
  'authorization',
  'cookie',
] as const;
// Exact names only. A plain `token` stays readable: Divar calls a listing's public id its token (CS-6), so an
// authentication token must be named for what it is (accessToken, botToken).
const SENSITIVE_NAMES: ReadonlySet<string> = new Set([
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authtoken',
  'apitoken',
  'bottoken',
  'bearertoken',
  'sessiontoken',
  'csrftoken',
  'sessionid',
  'otp',
  'databaseurl',
  'connectionstring',
  // Personal data: never logged, whoever it belongs to.
  'phone',
  'phonenumber',
  'mobile',
  'mobilenumber',
  'email',
  'emailaddress',
]);

/** Whether a field with this name holds a secret or personal data, whatever its value. */
export function isSensitiveKey(key: string): boolean {
  const name = key.toLowerCase().replaceAll(/[-_]/g, '');
  return SENSITIVE_NAMES.has(name) || SECRET_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

const DIGIT = '[0-9۰-۹٠-٩]';
const NOT_DIGIT_BEFORE = `(?<!${DIGIT})`;
const NOT_DIGIT_AFTER = `(?!${DIGIT})`;
const SEPARATOR = '[ \\-]';
const COUNTRY_CODE = '(?:\\+|00)?(?:98|۹۸|٩٨)';
const NINE = '[9۹٩]';
const ZERO = '[0۰٠]';
// After a leading 0 or the country code, in any grouping: 09121234567, 0912 123 45 67, +98 912 123 4567.
const PREFIXED_MOBILE = `(?:${COUNTRY_CODE}${SEPARATOR}?|${ZERO})${NINE}(?:${SEPARATOR}?${DIGIT}){9}`;
// Without either, only when written in groups (912 123 4567, 912-123-45-67): a bare ten-digit number that starts with
// 9 can as well be a price or an error's reference code, and redacting those would hide what the line is about.
const GROUPED_MOBILE = `${NINE}${DIGIT}{2}${SEPARATOR}${DIGIT}{3}${SEPARATOR}?${DIGIT}{2}${SEPARATOR}?${DIGIT}{2}`;

// Order matters: a credential inside a URL is removed before the phone pattern could see its digits.
const PATTERNS: readonly (readonly [RegExp, string])[] = [
  // scheme://user:password@host (a PostgreSQL connection string in a driver error, an S3 endpoint).
  [/\b([a-z][a-z0-9+.-]*:\/\/[^\s:/?#@]*:)[^\s/?#@]+@/gi, `$1${REDACTED}@`],
  // Signed or keyed query parameters (presigned object storage URLs, API keys).
  [
    /([?&](?:password|passwd|secret|token|access_token|api_key|apikey|key|signature|sig|x-amz-signature|x-amz-credential|x-amz-security-token)=)[^&#\s]+/gi,
    `$1${REDACTED}`,
  ],
  // An Authorization header value that ended up in a message.
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, `$1 ${REDACTED}`],
  // A JSON Web Token anywhere.
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, REDACTED],
  // PostgreSQL repeats a row's values in an error's detail: `Key (email)=(a@b.ir) already exists.`,
  // `Failing row contains (…).` The constraint's name says what broke; the values stay out.
  [
    /(Key \([^)]*\)=\().*?(\) (?:already exists|is not present in table|is still referenced from table|conflicts with existing key))/g,
    `$1${REDACTED}$2`,
  ],
  [/(Failing row contains \().*(\)\.?)$/gm, `$1${REDACTED}$2`],
  // An Iranian mobile number in Latin, Persian or Arabic-Indic digits.
  [
    new RegExp(`${NOT_DIGIT_BEFORE}(?:${PREFIXED_MOBILE}|${GROUPED_MOBILE})${NOT_DIGIT_AFTER}`, 'g'),
    REDACTED,
  ],
];

/**
 * A URL's path or query as a person reads it, percent-escapes decoded (and `+` in a query as a space), so a phone
 * number sent as `?q=%DB%B0%DB%B9…` or `0912+123+4567` is seen, and redacted, like any other text.
 */
export function readableUrlText(text: string, kind: 'path' | 'query'): string {
  const spaced = kind === 'query' ? text.replaceAll('+', ' ') : text;
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

/**
 * A request target (`/listings/42?_rsc=1a2b&q=…`) as the path and query a log line carries: decoded, without the
 * parameters that say nothing about the request (Next.js's `_rsc` cache buster). A target that starts with `//`
 * stays a path, not a host. Never throws.
 */
export function readableTarget(
  target: string,
  dropParameters: readonly string[] = ['_rsc'],
): { path: string; query: string | undefined } {
  let url: URL;
  try {
    url = new URL(`http://localhost${target}`);
  } catch {
    return { path: readableUrlText(target, 'path'), query: undefined };
  }
  for (const parameter of dropParameters) url.searchParams.delete(parameter);
  return {
    path: readableUrlText(url.pathname, 'path'),
    query: url.search === '' ? undefined : readableUrlText(url.search.slice(1), 'query'),
  };
}

/** The text with credentials, tokens and mobile numbers replaced by `[redacted]`. */
export function redactText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PATTERNS) result = result.replace(pattern, replacement);
  return result;
}
