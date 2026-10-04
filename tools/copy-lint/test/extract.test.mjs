// What counts as a unit of text, and what does not (lib/extract.mjs, lib/kinds.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractUnits } from '../lib/extract.mjs';
import { kindOf, kindOfAttribute, kindOfElement, kindOfKey, isNonCopyKey } from '../lib/kinds.mjs';
import { NBSP, PLACEHOLDER } from '../lib/persian.mjs';

const units = (source, file = 'apps/web/src/features/x/x-copy.ts') => extractUnits(file, source);
const texts = (source, file) => units(source, file).map((unit) => unit.text);

test('string literals, templates without holes and templates with holes are units', () => {
  const found = units('const a = { title: "آگهی تازه", body: `قیمت کم شد`, n: `${count} آگهی` };');
  assert.deepEqual(
    found.map((unit) => [unit.form, unit.text]),
    [
      ['string', 'آگهی تازه'],
      ['string', 'قیمت کم شد'],
      ['template', `${PLACEHOLDER} آگهی`],
    ],
  );
  assert.equal(found[2].hasHoles, true);
});

test('text without a Persian word is not a unit, a single Persian letter is not a word', () => {
  assert.deepEqual(texts('const a = ["hello", "ی", "،", "۱۲۳", "className"];'), []);
});

test('English prose that quotes a Persian word is not copy', () => {
  assert.deepEqual(
    texts('const reason = "A used car is clean when «تمیز» means the body, in a used-car ad";'),
    [],
  );
});

test('imports, object keys, type literals, case labels and element access are code', () => {
  const source = `
    import x from 'ماژول';
    type T = 'عالی' | 'خوب';
    const table = { 'باما': 1 };
    switch (v) { case 'عالی': break; }
    const w = table['باما'];
  `;
  assert.deepEqual(texts(source), []);
});

test('strings handed to a matching method are what the code searches for, not what it shows', () => {
  const source = `
    const a = text.replace('ي', 'ی');
    const b = text.includes('تومان');
    const c = new RegExp('تومان$');
    const d = parts.join(' · ');
  `;
  assert.deepEqual(texts(source), [' · ']);
});

test('a vocabulary key (words, aliases) holds no copy', () => {
  assert.deepEqual(texts('const f = { label: "برند", words: ["برند", "سازنده"], aliases: ["مدل"] };'), [
    'برند',
  ]);
  assert.equal(isNonCopyKey('words'), true);
  assert.equal(isNonCopyKey('label'), false);
});

test('JSX text follows JSX whitespace rules, entities are decoded, expressions are not text', () => {
  const found = units(
    `const a = (<p>
        قیمت&nbsp;تومان
        {value}
        بدون ارزیابی
      </p>);`,
    'apps/web/src/features/x/x.tsx',
  );
  assert.equal(found.length, 2);
  assert.equal(found[0].text, `قیمت${NBSP}تومان`);
  assert.equal(found[0].form, 'jsx-text');
  assert.equal(found[0].element, 'p');
  assert.equal(found[1].text, 'بدون ارزیابی');
});

test('JSX text is placed at its first letter, not at the tag before it', () => {
  const found = units('const a = (\n  <p>\n    سلام دنیا\n  </p>\n);', 'apps/web/src/features/x/x.tsx');
  assert.equal(found[0].line, 3);
});

test('a JSX attribute string is a unit with its attribute name', () => {
  const found = units(
    'const a = <button aria-label="بستن توضیح" title={"عنوان"}>تلاش دوباره</button>;',
    'x/x.tsx',
  );
  assert.deepEqual(
    found.map((unit) => [unit.form, unit.attribute, unit.element, unit.kind]),
    [
      ['jsx-attr', 'aria-label', undefined, 'name'],
      ['string', 'title', undefined, 'title'],
      ['jsx-text', undefined, 'button', 'button'],
    ],
  );
});

test('a middle dot used as a separator is a unit even without a Persian word', () => {
  const found = units('const a = <p>{x} · {y}</p>;', 'x/x.tsx');
  assert.deepEqual(
    found.map((unit) => [unit.text, unit.persian, unit.dot]),
    [[' · ', false, true]],
  );
});

test('the kind comes from the key, through arrays, arrows and conditionals', () => {
  const found = units(`
    const c = {
      retry: 'تلاش دوباره',
      hint: ['راهنما'],
      chip: (n) => (n ? 'یک' : 'دو'),
      lead: cond ? 'پیام اول' : 'پیام دوم',
      rule: (n) => { if (n) return 'قانون یک'; return 'قانون دو'; },
    };`);
  const kinds = Object.fromEntries(found.map((unit) => [unit.text, unit.kind]));
  assert.equal(kinds['تلاش دوباره'], 'button');
  assert.equal(kinds['راهنما'], 'hint');
  assert.equal(kinds['پیام اول'], 'notice');
  assert.equal(kinds['قانون یک'], 'popover');
});

test('standalone means the whole value, not a piece of a larger string', () => {
  const found = units(
    'const a = { x: "جمله کامل است", y: "عکس از " + name, z: join("چند کلمه"), t: `قیمت ${v} تومان` };',
  );
  const by = Object.fromEntries(found.map((unit) => [unit.text, unit.standalone]));
  assert.equal(by['جمله کامل است'], true);
  assert.equal(by['عکس از '], false);
  assert.equal(by['چند کلمه'], false);
});

test('units carry their line and column', () => {
  const found = units('const a = 1;\nconst b = {\n  title: "آگهی",\n};');
  assert.deepEqual([found[0].line, found[0].column], [3, 10]);
});

test('tagged templates (css, sql, String.raw) are code', () => {
  assert.deepEqual(texts('const a = String.raw`^تومان$`; const b = sql`select ${x} where y = ${"آگهی"}`;'), [
    'آگهی',
  ]);
});

test('kinds: keys, attributes and elements', () => {
  assert.equal(kindOfKey('retry'), 'button');
  assert.equal(kindOfKey('submit'), 'button');
  assert.equal(kindOfKey('title'), 'title');
  assert.equal(kindOfKey('errorTitle'), 'title');
  assert.equal(kindOfKey('listLabel'), 'name');
  assert.equal(kindOfKey('label'), 'label');
  assert.equal(kindOfKey('hint'), 'hint');
  assert.equal(kindOfKey('queuedHint'), 'hint');
  assert.equal(kindOfKey('paragraphs'), 'popover');
  assert.equal(kindOfKey('description'), 'popover');
  assert.equal(kindOfKey('lead'), 'notice');
  assert.equal(kindOfKey('errorBody'), 'notice');
  assert.equal(kindOfKey('whatever'), 'unknown');
  assert.equal(kindOfKey(undefined), 'unknown');
  assert.equal(kindOfAttribute('aria-label'), 'name');
  assert.equal(kindOfAttribute('placeholder'), 'hint');
  assert.equal(kindOfElement('button'), 'button');
  assert.equal(kindOfElement('h2'), 'title');
  assert.equal(kindOfElement('div'), 'unknown');
});

test('kinds: a button, label or title that ends with a full stop is a sentence, a notice', () => {
  assert.equal(kindOf({ key: 'retry' }, 'تلاش دوباره'), 'button');
  assert.equal(kindOf({ key: 'retry' }, 'کار دوباره به صف رفت.'), 'notice');
  assert.equal(kindOf({ key: 'title' }, 'یک عنوان.'), 'notice');
  assert.equal(kindOf({ key: 'hint' }, 'یک راهنما.'), 'hint');
});
