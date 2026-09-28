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
// Between digits: a space (a no-break or narrow one too), a zero-width non-joiner, a dot or a dash, at most two. After
// a leading 0 or the country code a slash too (0912/123/4567); without one, a path's number segments (/api/912/123/4567)
// would read as a phone number.
const SEPARATOR = '[ .\\-\\u00A0\\u200C\\u202F]';
const PREFIXED_SEPARATOR = '[ ./\\-\\u00A0\\u200C\\u202F]';
const GAP = `${SEPARATOR}{0,2}`;
const BREAK = `${SEPARATOR}{1,2}`;
const PREFIXED_GAP = `${PREFIXED_SEPARATOR}{0,2}`;
const COUNTRY_CODE = '(?:\\+|00)?(?:98|۹۸|٩٨)';
const NINE = '[9۹٩]';
const ZERO = '[0۰٠]';
// After a leading 0 or the country code, in any grouping, the operator code (9 and two digits) in brackets or not:
// 09121234567, 0912 123 45 67, 0912.123.4567, +98 912 123 4567, +98 (912) 123-4567, (0912) 123 4567.
const PREFIXED_MOBILE = `(?:${COUNTRY_CODE}${PREFIXED_GAP}\\(?|\\(?${ZERO})${NINE}(?:${PREFIXED_GAP}${DIGIT}){2}\\)?(?:${PREFIXED_GAP}${DIGIT}){7}`;
// Without either, only when written in groups (912 123 4567, 912-123-45-67, (912) 123 4567): a bare ten-digit number
// that starts with 9 can as well be a price or an error's reference code, and redacting those would hide what the line
// is about.
const GROUPED_MOBILE = `\\(?${NINE}${DIGIT}{2}\\)?${BREAK}${DIGIT}{3}${GAP}${DIGIT}{2}${GAP}${DIGIT}{2}`;

type Replacement = string | ((match: string, first: string, second: string) => string);

// A secret is found by what comes before it: a scheme, `Bearer `, a key and `=`. Those lookups are bounded, so every
// pattern costs time in proportion to its input (a request path is anyone's text, and an unbounded `[\w.-]*` retried
// from every position made a 16 KB path take 350 ms to log). The secret itself is then taken whole, however long it
// is: a cap there would let a longer one through untouched.

// A JSON Web Token: `eyJ` and a run of token characters, redacted when it holds a header and a payload.
const JWT = /^eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}/;

function redactTokenRun(run: string): string {
  return JWT.test(run) ? REDACTED : run;
}

// How PostgreSQL ends a key detail: `Key (email)=(a@b.ir) already exists.`
const KEY_DETAIL_ENDINGS = [
  ') already exists',
  ') is not present in table',
  ') is still referenced from table',
  ') conflicts with existing key',
];

/** A key detail's values run to the last ending on the line (a value can hold one), or to the end of the line. */
function redactKeyDetail(_match: string, prefix: string, rest: string): string {
  const ending = Math.max(...KEY_DETAIL_ENDINGS.map((text) => rest.lastIndexOf(text)));
  return `${prefix}${REDACTED}${ending === -1 ? ')' : rest.slice(ending)}`;
}

// Credentials and tokens of a known shape, each pattern with what replaces it. They run before the phone pattern
// (MOBILE), which could otherwise cut a token's digits out and leave the rest of it unrecognised.
const PATTERNS: readonly (readonly [RegExp, Replacement])[] = [
  // A private key in PEM form, to its end line, or to the end of the text without one.
  [/-----BEGIN [A-Z ]{0,32}PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]{0,32}PRIVATE KEY-----|$)/g, REDACTED],
  // scheme://user:password@host (a PostgreSQL connection string in a driver error, an S3 endpoint). The password runs
  // to the last @ before the host, since an unescaped @ inside it is common.
  [/\b([a-z][a-z0-9+.-]{0,31}:\/\/[^\s:/?#@]{0,256}:)[^\s/?#]+@/gi, `$1${REDACTED}@`],
  // Signed or keyed query parameters (presigned object storage URLs, API keys).
  [
    /([?&](?:password|passwd|secret|token|access_token|api_key|apikey|key|signature|sig|x-amz-signature|x-amz-credential|x-amz-security-token)=)[^&#\s]+/gi,
    `$1${REDACTED}`,
  ],
  // An Authorization header value that ended up in a message.
  [/\b(Bearer|Basic)\s{1,4}[A-Za-z0-9._~+/=-]{8,}/g, `$1 ${REDACTED}`],
  // A JSON Web Token anywhere. The whole run is taken at once, so a run with no token in it is read only once.
  [/\beyJ[A-Za-z0-9_.-]*/g, redactTokenRun],
  // PostgreSQL repeats a row's values in an error's detail: `Key (email)=(a@b.ir) already exists.`,
  // `Failing row contains (…).` The constraint's name says what broke; the values stay out.
  [/(Key \([^)\n]{0,256}\)=\()([^\n]*)/g, redactKeyDetail],
  [/(Failing row contains \()[^\n]*/g, `$1${REDACTED}).`],
];

// Pairs whose key names a secret or personal data (isSensitiveKey), in `key=value` text (a libpq connection string,
// an environment dump such as PGPASSWORD=…, a form body) and in JSON inside a message (an API's response body). They
// run after the phone pattern: an unquoted value ends at the first space, so `phone=0912 123 4567` must lose the whole
// number to MOBILE first.
const ASSIGNMENT_KEY = /\b([A-Za-z_][\w.-]{0,63})\s{0,4}=\s{0,4}/g;
const ASSIGNMENT_VALUE_END = /[\s'"&;,]/g;
const JSON_KEY = /"([A-Za-z_][\w.-]{0,63})"\s{0,4}:\s{0,4}/g;
const JSON_VALUE_END = /[\s,}\]]/g;

/** Where a value starting at `start` ends: after its closing quote (the end of the text without one), or at `stop`. */
function valueEnd(text: string, start: number, stop: RegExp): number {
  const quote = text.charAt(start);
  if (quote === '"' || quote === "'") {
    for (let index = start + 1; index < text.length; index += 1) {
      const character = text.charAt(index);
      if (character === '\\') index += 1;
      else if (character === quote) return index + 1;
    }
    return text.length;
  }
  stop.lastIndex = start;
  return stop.exec(text)?.index ?? text.length;
}

/**
 * The text with the value of every pair whose key is sensitive replaced. Other pairs are only passed over, never taken
 * whole, so an unclosed quote after a harmless key cannot hide a secret behind it.
 */
function redactPairs(text: string, keys: RegExp, stop: RegExp, replacement: string): string {
  let result = '';
  let copied = 0;
  keys.lastIndex = 0;
  for (let found = keys.exec(text); found !== null; found = keys.exec(text)) {
    if (!isSensitiveKey(found[1] ?? '')) continue;
    const start = found.index + found[0].length;
    const end = valueEnd(text, start, stop);
    if (end === start) continue;
    result += `${text.slice(copied, start)}${replacement}`;
    copied = end;
    keys.lastIndex = end;
  }
  return result + text.slice(copied);
}

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

function cut(text: string, shown: number, fullLength = text.length): string {
  return fullLength > shown
    ? `${text.slice(0, shown)}… [${String(fullLength - shown)} more characters]`
    : text;
}

/**
 * A request target (`/listings/42?_rsc=1a2b&q=…`) as the path and query a log line carries: decoded, without the
 * parameters that say nothing about the request (Next.js's `_rsc` cache buster), each redacted and cut to 2,048
 * characters. A target that starts with `//` stays a path, not a host. Never throws.
 */
export function readableTarget(
  target: string,
  dropParameters: readonly string[] = ['_rsc'],
): { path: string; query: string | undefined } {
  let url: URL;
  try {
    url = new URL(`http://localhost${target}`);
  } catch {
    return { path: redactAndTruncate(readableUrlText(target, 'path'), MAX_TARGET_TEXT), query: undefined };
  }
  for (const parameter of dropParameters) url.searchParams.delete(parameter);
  return {
    path: redactAndTruncate(readableUrlText(url.pathname, 'path'), MAX_TARGET_TEXT),
    query:
      url.search === ''
        ? undefined
        : redactAndTruncate(readableUrlText(url.search.slice(1), 'query'), MAX_TARGET_TEXT),
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
  const withoutAssignments = redactPairs(withoutPhones, ASSIGNMENT_KEY, ASSIGNMENT_VALUE_END, REDACTED);
  return redactPairs(withoutAssignments, JSON_KEY, JSON_VALUE_END, `"${REDACTED}"`);
}

/**
 * The text redacted and cut to `limit` characters, with a note of how many more there were. Text is cut only after it
 * is redacted, since a secret cut in two is recognised by no pattern. Only what can be shown, and a margin past it, is
 * read, so a huge value costs no more to log than one at the limit; that slice can itself end inside a secret, so its
 * last CUT_MARGIN characters are never shown, even when redaction has shortened what comes before them.
 */
export function redactAndTruncate(text: string, limit: number): string {
  if (text.length <= limit + CUT_MARGIN) return cut(redactText(text), limit);
  const redacted = redactText(text.slice(0, limit + CUT_MARGIN));
  return cut(redacted, Math.max(0, Math.min(limit, redacted.length - CUT_MARGIN)), text.length);
}
