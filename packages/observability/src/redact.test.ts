import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSensitiveKey, REDACTED, redactText } from './redact.ts';

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
  ]) {
    assert.equal(redactText(`تماس: ${phone} فقط پیامک`), `تماس: ${REDACTED} فقط پیامک`, phone);
  }
});

test('prices, years, ids and longer digit runs are left alone', () => {
  for (const text of [
    'قیمت ۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان',
    'price 1250000000',
    'مدل ۱۴۰۲',
    'listing 912345',
    'digest 2847193056',
    'id 1091212345678',
  ]) {
    assert.equal(redactText(text), text);
  }
});
