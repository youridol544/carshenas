import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isSensitiveKey,
  readableTarget,
  readableUrlText,
  redactAndTruncate,
  REDACTED,
  redactText,
  replacePhoneNumbers,
} from './redact.ts';

// Shapes that make a pattern with an unbounded run retry from every position, or hold a secret it could lose track of.
const HOSTILE = [
  'a.',
  'a+b-c',
  '-eyJ',
  'Key (a)=(',
  'Failing row contains (',
  '"k":1,',
  '0-',
  'a_b.c-d=',
  "a='",
  'x://u:',
  '?password=',
  'Bearer ',
  '-----BEGIN PRIVATE KEY-----',
  '"password":"',
];

test('secret and personal field names are recognised in any spelling', () => {
  for (const key of [
    'password',
    'dbPassword',
    'DB_PASSWORD',
    'webhookSecret',
    'api_key',
    'API-KEY',
    'secretAccessKey',
    'authorization',
    'Proxy-Authorization',
    'cookie',
    'set-cookie',
    'accessToken',
    'botToken',
    'databaseUrl',
    'DATABASE_URL',
    'phone',
    'mobileNumber',
    'email',
  ]) {
    assert.equal(isSensitiveKey(key), true, key);
  }
});

test('ordinary field names, including a listing token, stay readable', () => {
  for (const key of ['token', 'postToken', 'listingId', 'source', 'priceToman', 'route', 'code', 'author']) {
    assert.equal(isSensitiveKey(key), false, key);
  }
});

test('a password inside a connection string is removed and the rest of the address kept', () => {
  assert.equal(
    redactText('connect to postgres://carshenas_web:local-web@127.0.0.1:5418/carshenas failed'),
    `connect to postgres://carshenas_web:${REDACTED}@127.0.0.1:5418/carshenas failed`,
  );
  assert.equal(redactText('redis://:hunter2@cache:6379'), `redis://:${REDACTED}@cache:6379`);
  // An unescaped @ in the password: all of it goes, up to the host.
  assert.equal(
    redactText('postgres://web:p@ss@db:5432/carshenas'),
    `postgres://web:${REDACTED}@db:5432/carshenas`,
  );
});

test('a password in key=value settings is removed: libpq, an environment dump, a .NET-style string', () => {
  assert.equal(
    redactText('connect host=db user=web password=hunter2 dbname=carshenas'),
    `connect host=db user=web password=${REDACTED} dbname=carshenas`,
  );
  assert.equal(redactText("password='two words' host=db"), `password=${REDACTED} host=db`);
  assert.equal(redactText('PGPASSWORD=hunter2 pnpm db:up'), `PGPASSWORD=${REDACTED} pnpm db:up`);
  assert.equal(redactText('Host=db;Password=hunter2;Database=x'), `Host=db;Password=${REDACTED};Database=x`);
  assert.equal(redactText('email=seller@example.ir page=2'), `email=${REDACTED} page=2`);
});

test('JSON inside a message loses the values of secret and personal keys, and keeps the rest', () => {
  assert.equal(
    redactText('divar answered 401: {"access_token":"abc123","token":"wZ3kB9","otp":123456,"page":2}'),
    `divar answered 401: {"access_token":"${REDACTED}","token":"wZ3kB9","otp":"${REDACTED}","page":2}`,
  );
});

test('signed and keyed query parameters are removed', () => {
  assert.equal(
    redactText(
      'GET https://s3.ir-thr-at1.arvanstorage.ir/b/p.jpg?X-Amz-Credential=AKIA/x&X-Amz-Signature=abc123&w=640',
    ),
    `GET https://s3.ir-thr-at1.arvanstorage.ir/b/p.jpg?X-Amz-Credential=${REDACTED}&X-Amz-Signature=${REDACTED}&w=640`,
  );
  assert.equal(redactText('/search?api_key=s3cr3t'), `/search?api_key=${REDACTED}`);
});

test('bearer tokens and JSON Web Tokens are removed', () => {
  assert.equal(redactText('Authorization: Bearer abc.def-ghi_123'), `Authorization: Bearer ${REDACTED}`);
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlMTIz';
  assert.equal(redactText(`token=${jwt};`), `token=${REDACTED};`);
});

test('Iranian mobile numbers are removed in every digit script and spacing', () => {
  for (const phone of [
    '09121234567',
    '+989121234567',
    '00989121234567',
    '989121234567',
    '0912 123 4567',
    '0912-123-4567',
    '+98 912 123 4567',
    '۰۹۱۲۱۲۳۴۵۶۷',
    '۰۹۱۲ ۱۲۳ ۴۵۶۷',
    '٠٩١٢١٢٣٤٥٦٧',
    '0912 123 45 67',
    '+98 912 123 45 67',
    '0912-1234567',
    '912 123 4567',
    '912-123-45-67',
    '+98 (912) 123-4567',
    '(0912) 123 4567',
    '(912) 123 4567',
    '0912.123.4567',
    '0912/123/4567',
    '0912  123  4567',
    '0912\u00A0123\u00A04567',
    '۰۹۱۲\u200C۱۲۳\u200C۴۵۶۷',
  ]) {
    assert.equal(redactText(`تماس: ${phone} فقط پیامک`), `تماس: ${REDACTED} فقط پیامک`, phone);
  }
});

test('Iranian landline numbers are removed too, with their area code', () => {
  for (const phone of [
    '02122334455',
    '021 2233 4455',
    '021-22334455',
    '(021) 22334455',
    '+98 21 2233 4455',
    '۰۲۱-۲۲۳۳۴۴۵۵',
  ]) {
    assert.equal(redactText(`تلفن: ${phone} ساعت اداری`), `تلفن: ${REDACTED} ساعت اداری`, phone);
  }
});

test('the phone rule takes any replacement, for a stored listing as for a log line', () => {
  assert.equal(
    replacePhoneNumbers('تماس ۰۹۱۲۱۲۳۴۵۶۷ یا 021-2233 4455', '[شماره حذف شد]'),
    'تماس [شماره حذف شد] یا [شماره حذف شد]',
  );
  // Only phone numbers: a price, a secret or a job's UUID is not its business.
  const text = 'قیمت ۱,۱۴۰,۰۰۰,۰۰۰ تومان password=hunter2 job fdcf2cfb-9896-4273-8635-1eb5b9a19225';
  assert.equal(replacePhoneNumbers(text, 'x'), text);
});

test('a number that runs into a Persian or a Latin word is still removed', () => {
  assert.equal(redactText('تماس۰۹۱۲۱۲۳۴۵۶۷ فقط پیامک'), `تماس${REDACTED} فقط پیامک`);
  assert.equal(redactText('call seller09121234567 now'), `call seller${REDACTED} now`);
});

test('a digit run inside a hex id, a hash or a UUID is not taken for a phone number', () => {
  for (const text of [
    'trace 989811836575e82d0af7651916cd43dd',
    'sha 0a09121234567b',
    'job fdcf2cfb-9896-4273-8635-1eb5b9a19225 failed',
    'job 545e12da-7b1f-489d-bac7-989450317851',
  ]) {
    assert.equal(redactText(text), text);
  }
});

test('a secret is taken whole, however long it is', () => {
  const pem = `-----BEGIN PRIVATE KEY-----\n${'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC'.repeat(50)}\n-----END PRIVATE KEY-----`;
  for (const [text, expected] of [
    [`password='${'s'.repeat(1_500)}' host=db`, `password=${REDACTED} host=db`],
    [`PRIVATE_KEY="${pem}"`, `PRIVATE_KEY=${REDACTED}`],
    [`key: ${pem} end`, `key: ${REDACTED} end`],
    [`postgres://web:${'p'.repeat(700)}@db/carshenas`, `postgres://web:${REDACTED}@db/carshenas`],
    [`Key (title)=(${'v'.repeat(1_500)}) already exists.`, `Key (title)=(${REDACTED}) already exists.`],
    [`Authorization: Bearer ${'b'.repeat(6_000)}`, `Authorization: Bearer ${REDACTED}`],
    [`/x?api_key=${'k'.repeat(6_000)}&w=1`, `/x?api_key=${REDACTED}&w=1`],
    [`{"accessToken":"${'t'.repeat(10_000)}"}`, `{"accessToken":"${REDACTED}"}`],
  ] as const) {
    assert.equal(redactText(text), expected);
  }
});

test('an unclosed quote hides no secret: after a harmless key it is passed over, around a secret it runs to the end', () => {
  assert.equal(redactText("note='unclosed password=hunter2"), `note='unclosed password=${REDACTED}`);
  assert.equal(redactText("password='hunter2 and the rest"), `password=${REDACTED}`);
});

test("a path's number segments are not a phone number, unless they start with its 0", () => {
  assert.equal(redactText('/api/912/123/4567'), '/api/912/123/4567');
  assert.equal(redactText('/listings/0912/123/4567'), `/listings/${REDACTED}`);
});

test('redaction time grows in proportion to the text, whatever its shape', () => {
  // Four times the text takes about four times as long. A pattern that is retried from every position takes sixteen
  // times as long (16 KB of 'a.' took 350 ms before), which this catches; a run too fast to matter is not compared.
  for (const unit of HOSTILE) {
    const time = (size: number) => {
      const text = unit.repeat(Math.ceil(size / unit.length));
      const started = performance.now();
      redactText(text);
      return performance.now() - started;
    };
    time(5_000);
    const small = time(20_000);
    const large = time(80_000);
    assert.ok(
      large < 250 || large / small < 8,
      `${unit}: ${small.toFixed(1)} ms, then ${large.toFixed(1)} ms`,
    );
  }
});

test('a megabyte of hostile text costs no more to log than a line at the limit', () => {
  for (const unit of HOSTILE) {
    const text = unit.repeat(Math.ceil(1_000_000 / unit.length));
    const started = performance.now();
    const logged = redactAndTruncate(text, 8_000);
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 250, `${unit}: ${elapsed.toFixed(0)} ms`);
    assert.ok(logged.length < 8_100);
  }
});

test('a long value is cut with a note, and a secret across the cut is still recognised whole', () => {
  assert.equal(redactAndTruncate('abcdefghij', 4), 'abcd… [6 more characters]');
  const text = `${'a'.repeat(95)} 09121234567 and more`;
  const logged = redactAndTruncate(text, 100);
  assert.ok(logged.startsWith(`${'a'.repeat(95)} [red`), logged);
  assert.doesNotMatch(logged, /0912/);
});

test('a path is cut only after it is redacted, so a number across the cut does not show in part', () => {
  const { path } = readableTarget(`/${'z'.repeat(2_040)}-09121234567`);
  assert.doesNotMatch(path, /0912/);
});

test('when redaction shortens the part read before a cut, the end of that part is still never shown', () => {
  // The token is redacted, so the 1,100 characters read shrink to about 40, and the number the read cut in two
  // would otherwise be in plain view.
  const text = `Authorization: Bearer ${'b'.repeat(1_070)} 09121234567 ${'z'.repeat(2_000)}`;
  const logged = redactAndTruncate(text, 100);
  assert.doesNotMatch(logged, /0912/);
  assert.match(logged, /more characters\]$/);
});

test('a request path or query longer than 2,048 characters is cut', () => {
  const { path, query } = readableTarget(`/${'p'.repeat(5_000)}?q=${'x'.repeat(3_000)}`);
  assert.equal(path, `/${'p'.repeat(2_047)}… [2953 more characters]`);
  assert.match(query ?? '', /^q=x{2046}… \[954 more characters\]$/);
});

test('prices, years, ids, reference codes and longer digit runs are left alone', () => {
  for (const text of [
    'قیمت ۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان',
    'price 1250000000',
    'price 9500000000',
    'مدل ۱۴۰۲',
    'listing 912345',
    'digest 2847193056',
    // A reference code can start with 9 or 0; without a prefix or groups it is not taken for a phone number.
    'reference 9731186250',
    'reference 0476001501',
    'reference 9891234567',
    'id 1091212345678',
  ]) {
    assert.equal(redactText(text), text);
  }
});

test("PostgreSQL's detail keeps the columns and loses the values", () => {
  assert.equal(
    redactText('Key (email)=(someone@example.ir) already exists.'),
    `Key (email)=(${REDACTED}) already exists.`,
  );
  assert.equal(
    redactText('Key (source_id, source_listing_key)=(1, gYk3pQ2x) is not present in table "listing".'),
    `Key (source_id, source_listing_key)=(${REDACTED}) is not present in table "listing".`,
  );
  assert.equal(
    redactText('Failing row contains (7, divar, 09121234567, 1250000000).'),
    `Failing row contains (${REDACTED}).`,
  );
});

test('a URL path or query reads as text, so what it encodes is redacted like any text', () => {
  const query = readableUrlText(
    'q=%DB%B0%DB%B9%DB%B1%DB%B2%DB%B1%DB%B2%DB%B3%DB%B4%DB%B5%DB%B6%DB%B7&page=2',
    'query',
  );
  assert.equal(query, 'q=۰۹۱۲۱۲۳۴۵۶۷&page=2');
  assert.equal(redactText(query), `q=${REDACTED}&page=2`);
  assert.equal(redactText(readableUrlText('q=0912+123+4567', 'query')), `q=${REDACTED}`);
  // A spaced number under a personal key goes whole, not only up to its first space.
  assert.equal(
    redactText(readableUrlText('phone=0912+123+4567&page=2', 'query')),
    `phone=${REDACTED}&page=2`,
  );
  assert.equal(readableUrlText('/search/%D9%BE%DA%98%D9%88', 'path'), '/search/پژو');
  assert.equal(readableUrlText('/bad/%E0%A4%A', 'path'), '/bad/%E0%A4%A');
  assert.equal(readableUrlText('/keeps+plus', 'path'), '/keeps+plus');
});
