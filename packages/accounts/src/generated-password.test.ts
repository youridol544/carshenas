import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePassword } from './generated-password.ts';
import { keyedHash } from './keyed-hash.ts';
import { passwordProblem } from './password.ts';
import { SUPERADMIN_PASSWORD_MIN_LENGTH } from './password-rules.ts';

test('a generated password is 24 symbols that are hard to misread, in four groups of six, new every time', () => {
  const passwords = new Set(Array.from({ length: 50 }, generatePassword));
  assert.equal(passwords.size, 50);
  for (const password of passwords) {
    assert.match(password, /^[a-km-np-z2-9]{6}(-[a-km-np-z2-9]{6}){3}$/);
    assert.equal(
      passwordProblem(password, { username: 'pedram', minimumLength: SUPERADMIN_PASSWORD_MIN_LENGTH }),
      undefined,
    );
  }
});

test('a keyed hash is 32 bytes, repeatable, and differs by key and by purpose', () => {
  const key = new Uint8Array(32).fill(1);
  const other = new Uint8Array(32).fill(2);
  const value = keyedHash(key, 'sign_in_account', 'ali_1403');
  assert.equal(value.length, 32);
  assert.deepEqual(value, keyedHash(key, 'sign_in_account', 'ali_1403'));
  assert.notDeepEqual(value, keyedHash(other, 'sign_in_account', 'ali_1403'));
  assert.notDeepEqual(value, keyedHash(key, 'sign_up_address', 'ali_1403'));
});
