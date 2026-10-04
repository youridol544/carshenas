import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtureLexicon } from './fixture.ts';
import { readCarFromTitle, titleOfSlug, type TitleCar } from './title-car.ts';

// The titles below are written by hand to pin each rule; the accuracy on real titles is measured by
// scripts/measure-title-car.ts on the listings of the database (6,792 titles on 2026-10-04), not by this file.

const lexicon = fixtureLexicon();
const read = (title: string): TitleCar => readCarFromTitle(titleOfSlug(title), lexicon);

/** What a read names, as keys: «model:peugeot.206», «make:kia», «ambiguous», «none». */
function named(car: TitleCar): string {
  if (car.kind === 'model') return `model:${car.model.key}`;
  if (car.kind === 'make') return `make:${car.make.key}`;
  return car.kind;
}

test('the address of an ad is its title with dashes: they read as spaces', () => {
  assert.equal(titleOfSlug('پژو-۲۰۶-تیپ-۵-مدل-۱۳۹۸'), 'پژو ۲۰۶ تیپ ۵ مدل ۱۳۹۸');
  assert.equal(titleOfSlug('  a--b__c++d '), 'a b c d');
  assert.equal(named(read('پژو-۲۰۶-تیپ-۵-مدل-۱۳۹۸')), 'model:peugeot.206');
});

test('a model is read from its own name, a number alone, or its Latin name, in any digit script', () => {
  assert.equal(named(read('پژو ۲۰۶')), 'model:peugeot.206');
  assert.equal(named(read('۲۰۶ صندوق دار')), 'model:peugeot.206');
  assert.equal(named(read('206 تیپ 2')), 'model:peugeot.206');
  assert.equal(named(read('پراید ۱۳۱ مدل ۹۶')), 'model:pride.131');
  assert.equal(named(read('Peugeot 405 GLX')), 'model:peugeot.405');
  assert.equal(named(read('تویوتا کرولا ۲۰۱۸')), 'model:toyota.corolla');
});

test('a model the index does not collect is still named: the car is read, coverage is decided elsewhere', () => {
  assert.equal(named(read('Hyundai Elantra 2012')), 'model:hyundai.elantra');
  assert.equal(named(read('Kia Cerato')), 'model:kia.cerato');
});

test('words and digits a seller left no space between are read apart', () => {
  assert.equal(named(read('۲۰۶sdمدل۹۳')), 'model:peugeot.206');
  assert.equal(named(read('پژو207فلزدنده')), 'model:peugeot.207i');
  assert.equal(named(read('پراید131seمدل96')), 'model:pride.131');
});

test('two names written together are the two names: «دناپلاس», «پژوپارس»', () => {
  assert.equal(named(read('دناپلاس اتومات')), 'model:dena.plus');
  assert.equal(named(read('پژوپارس سال مدل ۹۲')), 'model:peugeot.pars');
});

test('the last three digits of a year are a year, not a Peugeot 405', () => {
  assert.equal(named(read('دنا اتومات صفر ۴۰۵')), 'make:dena');
  assert.equal(named(read('دنا اپشنال مدل 404')), 'make:dena');
  assert.equal(named(read('پژو ۲۰۷ پانا ۴۰۵ صفر')), 'model:peugeot.207i');
  assert.equal(named(read('۴۰۵ glx')), 'model:peugeot.405');
  assert.equal(named(read('پژو ۴۰۵ مدل ۱۳۹۰')), 'model:peugeot.405');
});

test('a number that is a year, a price or a distance is no model', () => {
  assert.equal(named(read('پژو ۲۰۶ مدل ۲۰۰۸')), 'model:peugeot.206');
  assert.equal(named(read('پژو ۴۰۵ با ۲۰۶ هزار کیلومتر')), 'model:peugeot.405');
  assert.equal(named(read('پراید ۱۳۱ قیمت ۴۰۵ میلیون')), 'model:pride.131');
});

test('what follows an exchange or an engine is another car, not the one for sale', () => {
  assert.equal(named(read('۲۰۶ تیپ ۵ معاوضه با ۲۰۷')), 'model:peugeot.206');
  assert.equal(named(read('سمند سورن موتور پارس')), 'model:samand.soren');
});

test('one or two Latin letters name nothing: the trims a seller lists after the car', () => {
  assert.equal(named(read('کوییک S')), 'make:quick');
  assert.equal(named(read('کوییک R مدل ۱۴۰۰')), 'make:quick');
});

test('only a make is named when the model has no name in the catalogue', () => {
  assert.equal(named(read('هیوندای النترا مدل ۹۸')), 'make:hyundai');
  assert.equal(named(read('کیا سراتو')), 'make:kia');
  assert.equal(named(read('پراید مدل ۹۵')), 'make:pride');
});

test('a make that is not the named model’s is a title about something else: not told', () => {
  assert.equal(named(read('کوییک پژو پارس')), 'ambiguous');
});

test('two cars in one title are not told apart, and a title with no car names none', () => {
  assert.equal(named(read('پژو ۲۰۶ و پژو ۴۰۵')), 'ambiguous');
  assert.equal(named(read('پژو و پراید')), 'ambiguous');
  assert.equal(named(read('فروش فوری خودرو')), 'none');
  assert.equal(named(read('')), 'none');
});

test('a delivery order is the paper, not a car', () => {
  assert.equal(named(read('حواله پراید ۱۳۱')), 'none');
});

test('hostile input is read, not run: long, empty, only digits, only dashes', () => {
  const started = performance.now();
  for (const title of ['ا'.repeat(5000), '۲۰۶'.repeat(2000), '- - - -', '1'.repeat(300), '\u0000‏‌']) {
    assert.doesNotThrow(() => read(title));
  }
  assert.ok(performance.now() - started < 1000);
});
