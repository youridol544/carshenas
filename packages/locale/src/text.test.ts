import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withPersianLetters, withoutBidiControls } from './text.ts';

// The controls are built from their code points, never typed.
const RLM = String.fromCodePoint(0x200f);
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
const ZWNJ = String.fromCodePoint(0x200c);

test('direction marks, embeddings and isolates are left out of what is read', () => {
  assert.equal(withoutBidiControls(`${RLM}۱,۲۵۰,۰۰۰ تومان`), '۱,۲۵۰,۰۰۰ تومان');
  assert.equal(withoutBidiControls(`${LRI}+98 912${PDI}`), '+98 912');
});

test('the zero-width non-joiner is Persian spelling, not a control, and stays', () => {
  assert.equal(withoutBidiControls(`به${ZWNJ}روز`), `به${ZWNJ}روز`);
});

test('Arabic yeh and kaf read as the Persian letters', () => {
  assert.equal(withPersianLetters('دي'), 'دی');
  assert.equal(withPersianLetters('كيا'), 'کیا');
  assert.equal(withPersianLetters('مصطفى'), 'مصطفی');
});
