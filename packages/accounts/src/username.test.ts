import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasPersianLetters, normalizeUsername, usernameProblem } from './username.ts';

test('a typed username loses the spaces at its ends, its capitals and its Persian or Arabic-Indic digits', () => {
  assert.equal(normalizeUsername('  Ali_۱۴۰۳ '), 'ali_1403');
  assert.equal(normalizeUsername('REZA٢٠٢٦'), 'reza2026');
  assert.equal(normalizeUsername('sara'), 'sara');
});

test('a username is 3 to 30 Latin letters, digits and underscores, starting with a letter', () => {
  assert.equal(usernameProblem('ali'), undefined);
  assert.equal(usernameProblem('ali_1403'), undefined);
  assert.equal(usernameProblem('a'.repeat(30)), undefined);
  assert.equal(usernameProblem(''), 'empty');
  assert.equal(usernameProblem('al'), 'too_short');
  assert.equal(usernameProblem('a'.repeat(31)), 'too_long');
  assert.equal(usernameProblem('1ali'), 'starts_without_letter');
  assert.equal(usernameProblem('_ali'), 'starts_without_letter');
  assert.equal(usernameProblem('ali-reza'), 'not_latin');
  assert.equal(usernameProblem('ali reza'), 'not_latin');
  assert.equal(usernameProblem('ali.reza'), 'not_latin');
});

test('Persian letters in a username point at the keyboard before any other rule', () => {
  assert.equal(usernameProblem('علی'), 'persian_letters');
  assert.equal(usernameProblem('شمه'), 'persian_letters');
  assert.equal(hasPersianLetters('ali'), false);
  assert.equal(hasPersianLetters('aliر'), true);
});

test('names that would pass for the site or its staff are refused', () => {
  for (const name of [
    'admin',
    'root',
    'support',
    'superadmin',
    'carshenas',
    'karshenas_team',
    'carshenas2',
  ]) {
    assert.equal(usernameProblem(name), 'reserved', name);
  }
  assert.equal(usernameProblem('pedram'), undefined);
  assert.equal(usernameProblem('admiral'), undefined);
});
