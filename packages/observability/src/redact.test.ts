import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSensitiveKey, readableUrlText, REDACTED, redactText } from './redact.ts';

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
  ]) {
    assert.equal(redactText(`تماس: ${phone} فقط پیامک`), `تماس: ${REDACTED} فقط پیامک`, phone);
  }
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
  assert.equal(readableUrlText('/search/%D9%BE%DA%98%D9%88', 'path'), '/search/پژو');
  assert.equal(readableUrlText('/bad/%E0%A4%A', 'path'), '/bad/%E0%A4%A');
  assert.equal(readableUrlText('/keeps+plus', 'path'), '/keeps+plus');
});
