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
// A number must not touch a digit or a hex letter to be taken for a phone number: a digit run inside a trace id, a hash
// or a UUID is not one (a trace id that began 989811836575… was redacted, and its request's lines no longer joined).
// Any other letter may touch it: Farsi text often runs into a number without a space, and so can a Latin word.
const ALONE_BEFORE = '(?<![0-9A-Fa-f۰-۹٠-٩])';
const ALONE_AFTER = '(?![0-9A-Fa-f۰-۹٠-٩])';
// Between digits: a space (a no-break or narrow one too), a zero-width non-joiner, a dot, a dash or a slash, at most two.
const SEPARATOR = '[ ./\\-\\u00A0\\u200C\\u202F]';
const GAP = `${SEPARATOR}{0,2}`;
const BREAK = `${SEPARATOR}{1,2}`;
const COUNTRY_CODE = '(?:\\+|00)?(?:98|۹۸|٩٨)';
const NINE = '[9۹٩]';
const ZERO = '[0۰٠]';
// After a leading 0 or the country code, in any grouping, the operator code (9 and two digits) in brackets or not:
// 09121234567, 0912 123 45 67, 0912.123.4567, +98 912 123 4567, +98 (912) 123-4567, (0912) 123 4567.
const PREFIXED_MOBILE = `(?:${COUNTRY_CODE}${GAP}\\(?|\\(?${ZERO})${NINE}(?:${GAP}${DIGIT}){2}\\)?(?:${GAP}${DIGIT}){7}`;
// Without either, only when written in groups (912 123 4567, 912-123-45-67, (912) 123 4567): a bare ten-digit number
// that starts with 9 can as well be a price or an error's reference code, and redacting those would hide what the line
// is about.
const GROUPED_MOBILE = `\\(?${NINE}${DIGIT}{2}\\)?${BREAK}${DIGIT}{3}${GAP}${DIGIT}{2}${GAP}${DIGIT}{2}`;

type Replacement = string | ((match: string, key: string, separator: string) => string);

/** `key=value` text keeps its key, and loses its value when the key names a secret or personal data. */
function redactAssignment(match: string, key: string, equals: string): string {
  return isSensitiveKey(key) ? `${key}${equals}${REDACTED}` : match;
}

/** The same for a JSON pair inside a message: "accessToken":"…". */
function redactJsonPair(match: string, key: string, colon: string): string {
  return isSensitiveKey(key) ? `"${key}"${colon}"${REDACTED}"` : match;
}

// Every repetition below is bounded, so each pattern costs time in proportion to its input: a request path is
// attacker's text, and an unbounded `[\w.-]*` tried from every position made a 16 KB path take 350 ms to log.

// Credentials and tokens of a known shape, each pattern with what replaces it. They run before the phone pattern
// (MOBILE), which could otherwise cut a token's digits out and leave the rest of it unrecognised.
const PATTERNS: readonly (readonly [RegExp, Replacement])[] = [
  // scheme://user:password@host (a PostgreSQL connection string in a driver error, an S3 endpoint). The password runs
  // to the last @ before the host, since an unescaped @ inside it is common.
  [/\b([a-z][a-z0-9+.-]{0,31}:\/\/[^\s:/?#@]{0,256}:)[^\s/?#]{1,512}@/gi, `$1${REDACTED}@`],
  // Signed or keyed query parameters (presigned object storage URLs, API keys).
  [
    /([?&](?:password|passwd|secret|token|access_token|api_key|apikey|key|signature|sig|x-amz-signature|x-amz-credential|x-amz-security-token)=)[^&#\s]{1,4096}/gi,
    `$1${REDACTED}`,
  ],
  // An Authorization header value that ended up in a message.
  [/\b(Bearer|Basic)\s{1,4}[A-Za-z0-9._~+/=-]{8,4096}/g, `$1 ${REDACTED}`],
  // A JSON Web Token anywhere: header, payload, signature.
  [/\beyJ[A-Za-z0-9_-]{5,256}\.[A-Za-z0-9_-]{5,8192}\.[A-Za-z0-9_-]{5,1024}/g, REDACTED],
  // PostgreSQL repeats a row's values in an error's detail: `Key (email)=(a@b.ir) already exists.`,
  // `Failing row contains (…).` The constraint's name says what broke; the values stay out.
  [
    /(Key \([^)]{0,256}\)=\().{0,1024}?(\) (?:already exists|is not present in table|is still referenced from table|conflicts with existing key))/g,
    `$1${REDACTED}$2`,
  ],
  [/(Failing row contains \()[^\n]*/g, `$1${REDACTED}).`],
];

// Pairs whose key names a secret or personal data. They run after the phone pattern: an unquoted value ends at the
// first space, so `phone=0912 123 4567` must lose the whole number to MOBILE first, not only `0912` here.
const PAIRS: readonly (readonly [RegExp, Replacement])[] = [
  // key=value text: a libpq connection string (host=db password=…), an environment dump (PGPASSWORD=…), a form body.
  [
    /\b([A-Za-z_][\w.-]{0,63})(\s{0,4}=\s{0,4})(?:'(?:[^'\\]|\\.){0,1024}'|"(?:[^"\\]|\\.){0,1024}"|[^\s'"&;,]{1,1024})/g,
    redactAssignment,
  ],
  // JSON inside a message, such as an API's response body: "accessToken":"…", "otp":123456.
  [
    /"([A-Za-z_][\w.-]{0,63})"(\s{0,4}:\s{0,4})(?:"(?:[^"\\]|\\.){0,8192}"|-?[0-9][0-9.eE+-]{0,63})/g,
    redactJsonPair,
  ],
];

// An Iranian mobile number in Latin, Persian or Arabic-Indic digits.
const MOBILE = new RegExp(`${ALONE_BEFORE}(?:${PREFIXED_MOBILE}|${GROUPED_MOBILE})${ALONE_AFTER}`, 'g');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_CHARACTER = /[0-9a-f-]/i;
const UUID_LENGTH = 36;

/**
 * Whether `text[start, end)` lies inside a UUID. Its hyphenated groups can read as a hyphenated phone number
 * (`fdcf2cfb-9896-4273-8635-…`, 4 random UUIDs in a million), and a job's id must stay whole to be searched for.
 */
function insideUuid(text: string, start: number, end: number): boolean {
  let from = start;
  while (from > 0 && end - from <= UUID_LENGTH && UUID_CHARACTER.test(text.charAt(from - 1))) from -= 1;
  let to = end;
  while (to < text.length && to - from <= UUID_LENGTH && UUID_CHARACTER.test(text.charAt(to))) to += 1;
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

// A path or a query longer than this is cut in a log line: a request target is the requester's own text.
const MAX_TARGET_TEXT = 2_048;
// Redaction reads this far past a cut, so a secret that crosses it is still recognised whole.
const CUT_MARGIN = 1_000;

function cut(text: string, limit: number, fullLength = text.length): string {
  return fullLength > limit
    ? `${text.slice(0, limit)}… [${String(fullLength - limit)} more characters]`
    : text;
}

/**
 * A request target (`/listings/42?_rsc=1a2b&q=…`) as the path and query a log line carries: decoded, without the
 * parameters that say nothing about the request (Next.js's `_rsc` cache buster), each cut to 2,048 characters. A
 * target that starts with `//` stays a path, not a host. Never throws.
 */
export function readableTarget(
  target: string,
  dropParameters: readonly string[] = ['_rsc'],
): { path: string; query: string | undefined } {
  let url: URL;
  try {
    url = new URL(`http://localhost${target}`);
  } catch {
    return { path: cut(readableUrlText(target, 'path'), MAX_TARGET_TEXT), query: undefined };
  }
  for (const parameter of dropParameters) url.searchParams.delete(parameter);
  return {
    path: cut(readableUrlText(url.pathname, 'path'), MAX_TARGET_TEXT),
    query:
      url.search === '' ? undefined : cut(readableUrlText(url.search.slice(1), 'query'), MAX_TARGET_TEXT),
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

/**
 * The text redacted and cut to `limit` characters, with a note of how many more there were. Only what can be shown,
 * and a margin past it, is ever read, so a huge value costs no more to log than one at the limit.
 */
export function redactAndTruncate(text: string, limit: number): string {
  if (text.length <= limit) return redactText(text);
  return cut(redactText(text.slice(0, limit + CUT_MARGIN)), limit, text.length);
}
