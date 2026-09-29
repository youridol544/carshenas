import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCommonPassword } from './common-passwords.ts';
import { passwordProblem } from './password.ts';
import { normalizePassword, passwordLength } from './password-rules.ts';
import { fromPersianLayout } from './persian-layout.ts';

const ARABIC_YEH = String.fromCodePoint(0x064a);
const ARABIC_KAF = String.fromCodePoint(0x0643);
const NO_BREAK_SPACE = String.fromCodePoint(0x00a0);

test('a password is normalised to one form whatever the keyboard typed, and never trimmed or lowercased', () => {
  assert.equal(normalizePassword('Ali۱۴۰۳'), 'Ali1403');
  assert.equal(normalizePassword('Ali١٤٠٣'), 'Ali1403');
  assert.equal(normalizePassword(`${ARABIC_KAF}ت${ARABIC_YEH}`), 'کتی');
  assert.equal(normalizePassword(`two${NO_BREAK_SPACE}words`), 'two words');
  assert.equal(normalizePassword('  Spaces Kept  '), '  Spaces Kept  ');
  // A decomposed «آ» (alef and madda above) composes to U+0622, as NIST asks (NFC).
  assert.equal(
    normalizePassword(`${String.fromCodePoint(0x0627, 0x0653)}بی`),
    `${String.fromCodePoint(0x0622)}بی`,
  );
});

test('length counts code points, as NIST does', () => {
  assert.equal(passwordLength('رمز'), 3);
  assert.equal(passwordLength('🚗🚗'), 2);
  assert.equal(passwordLength('abcdefgh'), 8);
});

test('a Latin password typed with the Persian layout on reads back as Latin', () => {
  assert.equal(fromPersianLayout('حشسسصخقی'), 'password');
  assert.equal(fromPersianLayout('ش1'), 'a1');
});

test('the blocklist matches whole passwords, whatever their case or keyboard layout', () => {
  assert.equal(isCommonPassword('password1'), true);
  assert.equal(isCommonPassword('PASSWORD1'), true);
  assert.equal(isCommonPassword('iloveyou'), true);
  assert.equal(isCommonPassword('حشسسصخقی1'), true);
  assert.equal(isCommonPassword('password1 for my car'), false);
});

test('a password is at least 8 and at most 128 characters, and not common', () => {
  const username = 'ali_1403';
  assert.equal(passwordProblem('', { username }), 'empty');
  assert.equal(passwordProblem('kf8#qz', { username }), 'too_short');
  assert.equal(passwordProblem('رمز عبور', { username }), undefined);
  assert.equal(passwordProblem(`${'kz9'.repeat(42)}kz`, { username }), undefined);
  assert.equal(passwordProblem('kz9'.repeat(43), { username }), 'too_long');
  assert.equal(passwordProblem('12345678', { username }), 'common');
  assert.equal(passwordProblem('Qwertyuiop', { username }), 'common');
  assert.equal(passwordProblem('blue tiger eats rice', { username }), undefined);
  assert.equal(passwordProblem('پژو ۲۰۶ سفید من', { username }), undefined);
});

test('a password built from the username or the site name is refused, a name inside real words is not', () => {
  const username = 'ali_1403';
  assert.equal(passwordProblem('ali_14031403', { username }), 'built_from_name');
  assert.equal(passwordProblem('ALI_1403!!', { username }), 'built_from_name');
  assert.equal(passwordProblem('Carshenas2026', { username }), 'built_from_name');
  assert.equal(passwordProblem('کارشناس123', { username }), 'built_from_name');
  // "carshenas99" typed with the Persian layout on is caught through the layout map.
  assert.equal(passwordProblem('زشقساثدشس99', { username }), 'built_from_name');
  assert.equal(passwordProblem('my carshenas notes', { username }), undefined);
  assert.equal(passwordProblem('alibaba_1403_x', { username: 'ali' }), undefined);
});

test('a superadmin password needs at least 20 characters', () => {
  assert.equal(passwordProblem('kf8qz-tw2mv-hr', { username: 'pedram', minimumLength: 20 }), 'too_short');
  assert.equal(
    passwordProblem('kf8qz2-tw2mvx-hr7pba-3nd9ke', { username: 'pedram', minimumLength: 20 }),
    undefined,
  );
});
