import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cleanQuery,
  findPhrase,
  MAX_UNDERSTOOD_CHARACTERS,
  maskedWords,
  normalisePhrase,
  tokenize,
  wordsOf,
  ZWNJ,
} from './text.ts';

// The buyer's words as the understanding reads them (CS-62): every spelling of one thing becomes one form, and the text
// is never interpreted here. Invisible characters are built from code points, never typed (AGENTS.md, Gotchas).

const norms = (text: string) => tokenize(text).map((token) => token.norm);

test('digits in every script, thousands marks and decimals become plain numbers', () => {
  assert.deepEqual(norms('۲۰۶ ٢٠٦ 206'), ['206', '206', '206']);
  assert.deepEqual(norms('۱٬۲۰۰٬۰۰۰٬۰۰۰ 1,200,000,000 ۱۲۰۰۰۰۰۰۰۰'), [
    '1200000000',
    '1200000000',
    '1200000000',
  ]);
  assert.deepEqual(norms('۲٫۵ 2.5 ۱/۵'), ['2.5', '2.5', '1.5']);
  assert.equal(tokenize('۲۰۶')[0]?.kind, 'number');
});

test('an Arabic comma between two three-digit numbers is a list, not a thousands mark', () => {
  assert.deepEqual(norms('۲۰۶،۲۰۷'), ['206', '207']);
  assert.deepEqual(norms('۱،۲۰۰،۰۰۰'), ['1200000']);
});

test('Arabic keyboard letters fold to Persian ones, so «پرايد» and «پراید» are one word', () => {
  const arabic = `${String.fromCodePoint(0x067e)}ر${String.fromCodePoint(0x0627)}${String.fromCodePoint(0x064a)}د`;
  assert.deepEqual(norms(arabic), ['پراید']);
  assert.deepEqual(norms('كورولا'), ['کورولا']);
  assert.deepEqual(norms('کوئیک'), ['کوییک']);
});

test('a half-space splits a word and the tokens remember they were joined', () => {
  const tokens = tokenize(`کم${ZWNJ}کار و بی${ZWNJ}دردسر`);
  assert.deepEqual(
    tokens.map((token) => [token.norm, token.joined]),
    [
      ['کم', false],
      ['کار', true],
      ['و', false],
      ['بی', false],
      ['دردسر', true],
    ],
  );
  // The same words with spaces are the same phrase.
  assert.equal(normalisePhrase(`کم${ZWNJ}کار`), normalisePhrase('کم کار'));
});

test('letters stay apart from digits, except a Latin word that ends in them', () => {
  assert.deepEqual(norms('تیپ۲'), ['تیپ', '2']);
  assert.deepEqual(norms('۷۰۰میلیون'), ['700', 'میلیون']);
  assert.deepEqual(norms('207i 206sd s5'), ['207i', '206sd', 's5']);
});

test('a hyphen between two numbers is a range, other punctuation breaks clauses', () => {
  assert.deepEqual(norms('۵۰۰-۷۰۰'), ['500', 'تا', '700']);
  const tokens = tokenize('زیر ۷۰۰ میلیون، مناسب اسنپ. نادیده بگیر');
  assert.deepEqual(
    tokens.map((token) => token.breakBefore),
    [2, 0, 0, 1, 0, 2, 0],
  );
});

test('Latin accents are folded and case is ignored', () => {
  assert.deepEqual(norms('Citroën PEUGEOT'), ['citroen', 'peugeot']);
});

test('invisible marks are dropped, the half-space stays, and tag characters are reported', () => {
  const clean = cleanQuery(`پراید‏ ۱۳۱​${ZWNJ}${ZWNJ}`);
  assert.equal(clean.text, `پراید ۱۳۱`);
  assert.equal(clean.hidden, false);
  const tag = String.fromCodePoint(0xe0069);
  const hidden = cleanQuery(`پراید ${tag}${String.fromCodePoint(0xe0067)}`);
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.text, 'پراید');
});

test('a query longer than the search schema keeps is cut at a word, and says so', () => {
  const long = `پراید ${'کلمه '.repeat(60)}آخر`;
  const clean = cleanQuery(long);
  assert.equal(clean.cut, true);
  assert.ok(Array.from(clean.text).length <= MAX_UNDERSTOOD_CHARACTERS);
  assert.ok(!clean.text.endsWith('کل'), 'never in the middle of a word');
  assert.equal(cleanQuery('پراید').cut, false);
});

test('a phrase is found as whole words whatever the digit script or spacing', () => {
  const tokens = tokenize(`پژو ۲۰۶ تیپ${ZWNJ}۲ بدون رنگ`);
  assert.deepEqual(findPhrase(tokens, 'پژو 206'), [{ from: 0, to: 2 }]);
  assert.deepEqual(findPhrase(tokens, 'تیپ 2'), [{ from: 2, to: 4 }]);
  assert.deepEqual(findPhrase(tokens, 'بدون'), [{ from: 4, to: 5 }]);
  assert.deepEqual(findPhrase(tokens, 'بد'), [], 'a part of a word is not found');
  assert.deepEqual(findPhrase(tokens, ''), []);
  assert.equal(wordsOf(clean(`پژو ۲۰۶ بدون رنگ`).text, clean(`پژو ۲۰۶ بدون رنگ`).tokens, 2, 4), 'بدون رنگ');
});

function clean(text: string) {
  return cleanQuery(text);
}

test('long digit runs are masked for the model, a claimed number is kept', () => {
  const cleaned = cleanQuery('پراید ۰۹۱۲۳۴۵۶۷۸۹۰۱ زیر ۷۰۰۰۰۰۰۰۰ تومان ۱۰۰۰۰۰۰۰۰۰۰۰');
  const keep = new Set(
    cleaned.tokens
      .filter((token) => token.kind === 'number' && token.norm.length === 12)
      .map((one) => one.index),
  );
  assert.equal(maskedWords(cleaned.text, cleaned.tokens), 'پراید # زیر ۷۰۰۰۰۰۰۰۰ تومان #');
  assert.equal(maskedWords(cleaned.text, cleaned.tokens, keep), 'پراید # زیر ۷۰۰۰۰۰۰۰۰ تومان ۱۰۰۰۰۰۰۰۰۰۰۰');
});
