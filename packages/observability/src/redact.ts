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
// A number must not touch a Latin letter or a digit to be taken for a phone number: a digit run inside a hex id, a
// hash or a token is not one (a trace id that began 989811836575… was redacted, and its request's lines no longer
// joined). A Persian letter may touch it, since Farsi text often runs into a number without a space.
const ALONE_BEFORE = '(?<![0-9A-Za-z۰-۹٠-٩])';
const ALONE_AFTER = '(?![0-9A-Za-z۰-۹٠-٩])';
const SEPARATOR = '[ .\\-]';
const COUNTRY_CODE = '(?:\\+|00)?(?:98|۹۸|٩٨)';
const NINE = '[9۹٩]';
const ZERO = '[0۰٠]';
// After a leading 0 or the country code, in any grouping, the operator code (9 and two digits) in brackets or not:
// 09121234567, 0912 123 45 67, 0912.123.4567, +98 912 123 4567, +98 (912) 123-4567, (0912) 123 4567.
const PREFIXED_MOBILE = `(?:${COUNTRY_CODE}${SEPARATOR}?\\(?|\\(?${ZERO})${NINE}(?:${SEPARATOR}?${DIGIT}){2}\\)?(?:${SEPARATOR}?${DIGIT}){7}`;
// Without either, only when written in groups (912 123 4567, 912-123-45-67, (912) 123 4567): a bare ten-digit number
// that starts with 9 can as well be a price or an error's reference code, and redacting those would hide what the line
// is about.
const GROUPED_MOBILE = `\\(?${NINE}${DIGIT}{2}\\)?${SEPARATOR}${DIGIT}{3}${SEPARATOR}?${DIGIT}{2}${SEPARATOR}?${DIGIT}{2}`;

type Replacement = string | ((match: string, key: string, separator: string) => string);

/** `key=value` text keeps its key, and loses its value when the key names a secret or personal data. */
function redactAssignment(match: string, key: string, equals: string): string {
  return isSensitiveKey(key) ? `${key}${equals}${REDACTED}` : match;
}

/** The same for a JSON pair inside a message: "accessToken":"…". */
function redactJsonPair(match: string, key: string, colon: string): string {
  return isSensitiveKey(key) ? `"${key}"${colon}"${REDACTED}"` : match;
}

// Credentials and tokens of a known shape, each pattern with what replaces it. They run before the phone pattern
// (MOBILE), which could otherwise cut a token's digits out and leave the rest of it unrecognised.
const PATTERNS: readonly (readonly [RegExp, Replacement])[] = [
  // scheme://user:password@host (a PostgreSQL connection string in a driver error, an S3 endpoint). The password runs
  // to the last @ before the host, since an unescaped @ inside it is common.
  [/\b([a-z][a-z0-9+.-]*:\/\/[^\s:/?#@]*:)[^\s/?#]+@/gi, `$1${REDACTED}@`],
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
];

// Pairs whose key names a secret or personal data. They run after the phone pattern: an unquoted value ends at the
// first space, so `phone=0912 123 4567` must lose the whole number to MOBILE first, not only `0912` here.
const PAIRS: readonly (readonly [RegExp, Replacement])[] = [
  // key=value text: a libpq connection string (host=db password=…), an environment dump (PGPASSWORD=…), a form body.
  [/\b([A-Za-z_][\w.-]*)(\s*=\s*)(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[^\s'"&;,]+)/g, redactAssignment],
  // JSON inside a message, such as an API's response body: "accessToken":"…", "otp":123456.
  [/"([A-Za-z_][\w.-]*)"(\s*:\s*)(?:"(?:[^"\\]|\\.)*"|-?[0-9][0-9.eE+-]*)/g, redactJsonPair],
];

// An Iranian mobile number in Latin, Persian or Arabic-Indic digits.
const MOBILE = new RegExp(`${ALONE_BEFORE}(?:${PREFIXED_MOBILE}|${GROUPED_MOBILE})${ALONE_AFTER}`, 'g');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_CHARACTER = /[0-9a-f-]/i;

/**
 * Whether `text[start, end)` lies inside a UUID. Its hyphenated groups can read as a hyphenated phone number
 * (`fdcf2cfb-9896-4273-8635-…`, 4 random UUIDs in a million), and a job's id must stay whole to be searched for.
 */
function insideUuid(text: string, start: number, end: number): boolean {
  let from = start;
  while (from > 0 && UUID_CHARACTER.test(text.charAt(from - 1))) from -= 1;
  let to = end;
  while (to < text.length && UUID_CHARACTER.test(text.charAt(to))) to += 1;
  return UUID.test(text.slice(from, to));
}

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

function applyAll(text: string, patterns: readonly (readonly [RegExp, Replacement])[]): string {
  let result = text;
  for (const [pattern, replacement] of patterns) {
    result =
      typeof replacement === 'string'
        ? result.replace(pattern, replacement)
        : result.replace(pattern, replacement);
  }
  return result;
}

/** The text with credentials, tokens and mobile numbers replaced by `[redacted]`. */
export function redactText(text: string): string {
  const withoutTokens = applyAll(text, PATTERNS);
  const withoutPhones = withoutTokens.replace(MOBILE, (match: string, offset: number, input: string) =>
    insideUuid(input, offset, offset + match.length) ? match : REDACTED,
  );
  return applyAll(withoutPhones, PAIRS);
}
