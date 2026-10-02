import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readQuantities } from './quantities.ts';
import { tokenize } from './text.ts';

// What a number means (CS-62, S03): the unit and the words around it decide, and the values are the buyer's own.
// 1405 is the current Solar Hijri year for these tests.

const YEAR = 1405;

function read(text: string, taken: readonly number[] = []) {
  const tokens = tokenize(text);
  return readQuantities(tokens, (index) => !taken.includes(index), YEAR).map((claim) => ({
    words: tokens
      .slice(claim.from, claim.to)
      .map((token) => token.norm)
      .join(' '),
    filters: claim.filters,
    unsupported: claim.unsupported,
    implausible: claim.implausible,
  }));
}

function only(text: string) {
  const found = read(text);
  assert.equal(found.length, 1, `${text}: ${JSON.stringify(found)}`);
  const [claim] = found;
  assert.ok(claim);
  return claim;
}

const price = (text: string) => only(text).filters[0];

test('prices: relations, units and ranges', () => {
  assert.deepEqual(price('زیر ۷۰۰ میلیون'), { filterId: 'price', value: { max: 700_000_000 } });
  assert.deepEqual(price('تا ۳۵۰ میلیون تومان'), { filterId: 'price', value: { max: 350_000_000 } });
  assert.deepEqual(price('حدود ۲ میلیارد'), {
    filterId: 'price',
    value: { min: 1_800_000_000, max: 2_200_000_000 },
  });
  assert.deepEqual(price('بین ۴۰۰ تا ۵۰۰ میلیون'), {
    filterId: 'price',
    value: { min: 400_000_000, max: 500_000_000 },
  });
  assert.deepEqual(price('بالای ۸۰۰ میلیون'), { filterId: 'price', value: { min: 800_000_000 } });
  assert.deepEqual(price('از ۹۰۰ میلیون تا ۱ میلیارد'), {
    filterId: 'price',
    value: { min: 900_000_000, max: 1_000_000_000 },
  });
  assert.deepEqual(price('۱.۵ میلیارد به پایین'), { filterId: 'price', value: { max: 1_500_000_000 } });
  assert.deepEqual(price('زیر ۲٫۵ میلیارد'), { filterId: 'price', value: { max: 2_500_000_000 } });
});

test('no relation word is a budget: at most', () => {
  assert.deepEqual(price('یک و نیم میلیارد'), { filterId: 'price', value: { max: 1_500_000_000 } });
});

test('a price in speech: toman figures under 100,000 are millions, a bare figure beside a relation too', () => {
  assert.deepEqual(price('زیر ۵۰۰ تومن'), { filterId: 'price', value: { max: 500_000_000 } });
  assert.deepEqual(price('زیر ۳۰۰'), { filterId: 'price', value: { max: 300_000_000 } });
  assert.deepEqual(price('تا هفتصد'), { filterId: 'price', value: { max: 700_000_000 } });
  assert.deepEqual(price('زیر هفتصد میلیون'), { filterId: 'price', value: { max: 700_000_000 } });
  assert.deepEqual(price('زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان'), { filterId: 'price', value: { max: 1_200_000_000 } });
});

test('rials are divided by ten', () => {
  assert.deepEqual(price('۱۰ میلیارد ریال'), { filterId: 'price', value: { max: 1_000_000_000 } });
});

test('a price no car has is not applied, and says so', () => {
  const found = only('زیر ۱ تومان');
  assert.deepEqual(found.filters, []);
  assert.equal(found.implausible, 'قیمت');
});

test('years: Solar Hijri, two digits, Gregorian, relations', () => {
  const year = (text: string) => only(text).filters[0];
  assert.deepEqual(year('مدل ۱۴۰۰'), { filterId: 'year', value: { min: 1400, max: 1400 } });
  assert.deepEqual(year('مدل ۱۴۰۰ به بالا'), { filterId: 'year', value: { min: 1400 } });
  assert.deepEqual(year('مدل ۹۸'), { filterId: 'year', value: { min: 1398, max: 1398 } });
  assert.deepEqual(year('سال ۱۴۰۲ تا ۱۴۰۴'), { filterId: 'year', value: { min: 1402, max: 1404 } });
  assert.deepEqual(year('۲۰۱۸ به بالا'), { filterId: 'year', value: { min: 1397 } });
  assert.deepEqual(year('مدل ۸۵ به بعد'), { filterId: 'year', value: { min: 1385 } });
  assert.deepEqual(year('۱۳۹۵'), { filterId: 'year', value: { min: 1395, max: 1395 } });
  assert.deepEqual(year('مدل ۹۸ تا ۱۴۰۱'), { filterId: 'year', value: { min: 1398, max: 1401 } });
  assert.deepEqual(year('زیر ۱۴۰۰'), { filterId: 'year', value: { max: 1399 } });
  assert.deepEqual(year('تا ۱۴۰۰'), { filterId: 'year', value: { max: 1400 } });
  assert.deepEqual(year('۲۰۱۶ تا ۲۰۱۸'), { filterId: 'year', value: { min: 1395, max: 1397 } });
  assert.deepEqual(year('۹۸ به بالا'), { filterId: 'year', value: { min: 1398 } });
});

test('a two-digit number is a year only with a word or a relation that says so', () => {
  assert.deepEqual(read('۹۸'), []);
  assert.deepEqual(read('تیپ ۹۸'), []);
});

test('a year no car has is not applied', () => {
  assert.equal(only('مدل ۱۴۱۰').implausible, 'سال ساخت');
  assert.equal(only('مدل ۱۴۱۰').filters.length, 0);
});

test('mileage: scale words, units, spoken thousands', () => {
  const km = (text: string) => only(text).filters[0];
  assert.deepEqual(km('کارکرد زیر ۵۰ هزار'), { filterId: 'mileage', value: { max: 50_000 } });
  assert.deepEqual(km('زیر ۱۰۰ هزار کیلومتر'), { filterId: 'mileage', value: { max: 100_000 } });
  assert.deepEqual(km('کارکرد ۳۰ تا ۶۰ هزار'), { filterId: 'mileage', value: { min: 30_000, max: 60_000 } });
  assert.deepEqual(km('کارکرد کمتر از ۸۰ هزار'), { filterId: 'mileage', value: { max: 80_000 } });
  assert.deepEqual(km('۲۰ هزار کیلومتر کارکرده'), { filterId: 'mileage', value: { max: 20_000 } });
  assert.deepEqual(km('کارکرد ۸۰'), { filterId: 'mileage', value: { max: 80_000 } });
  assert.deepEqual(km('۳۰۰ هزار کیلومتر'), { filterId: 'mileage', value: { max: 300_000 } });
  assert.deepEqual(km('کارکرد حدود ۵۰ هزار'), { filterId: 'mileage', value: { min: 45_000, max: 55_000 } });
});

test('an engine size is a wish the data cannot serve', () => {
  const found = only('۱۸۰۰ سی سی');
  assert.equal(found.unsupported, 'حجم موتور');
  assert.deepEqual(found.filters, []);
});

test('insurance, the days since a listing was posted, and a car’s age', () => {
  assert.deepEqual(only('بیمه ۶ ماه').filters[0], { filterId: 'insurance', value: 6 });
  assert.deepEqual(only('۳ روز اخیر').filters[0], { filterId: 'posted_within', value: 3 });
  assert.deepEqual(only('۴۸ ساعت').filters[0], { filterId: 'posted_within', value: 2 });
  assert.deepEqual(only('۵ ساله').filters[0], { filterId: 'age', value: 5 });
  assert.deepEqual(only('زیر ۵ سال').filters[0], { filterId: 'age', value: 5 });
});

test('a bare number, a trim number and a number that is taken are left alone', () => {
  assert.deepEqual(read('۲'), []);
  assert.deepEqual(read('تیپ ۲'), []);
  assert.deepEqual(read('زیر ۱'), []);
  assert.deepEqual(read('۲۰۶ زیر ۷۰۰ میلیون', [0]).length, 1);
  assert.deepEqual(read('۲۰۶', [0]), []);
});

test('the words around a number are part of its claim, so they are not shown as unused', () => {
  assert.equal(only('کارکرد زیر ۵۰ هزار').words, 'کارکرد زیر 50 هزار');
  assert.equal(only('مدل ۱۴۰۰ به بالا').words, 'مدل 1400 به بالا');
  assert.equal(only('حدود ۲ میلیارد').words, 'حدود 2 میلیارد');
});

test('two quantities in one query stay two', () => {
  const found = read('زیر ۷۰۰ میلیون کارکرد زیر ۵۰ هزار مدل ۱۴۰۰ به بالا');
  assert.deepEqual(
    found.map((one) => one.filters[0]?.filterId),
    ['price', 'mileage', 'year'],
  );
});
