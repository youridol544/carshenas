import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CC_UNIT_FA, formatEngineVolume, isEngineVolume, readEngineVolume } from './engine-volume.ts';

const NBSP = String.fromCharCode(0xa0);

test('a volume with its unit is read in any digit script', () => {
  assert.equal(readEngineVolume('پژو دویست و هفت ۲۰۷ موتور1400cc خشک تحویل فوری'), 1400);
  assert.equal(readEngineVolume('تویوتا کرولا ۱۲۰۰ سی سی ۲۰۲۴'), 1200);
  assert.equal(readEngineVolume(`تویوتا کرولا ۱۲۰۰${CC_UNIT_FA} ۲۰۲۴`), 1200);
  assert.equal(readEngineVolume('کرولا ١٨٠٠ cc'), 1800);
  assert.equal(readEngineVolume('ماشین 2000 CC'), 2000);
  assert.equal(readEngineVolume('1998 c.c'), 1998);
});

test('litres are converted to cubic centimetres', () => {
  assert.equal(readEngineVolume('تویوتا کرولا کراس هیبرید 2 لیتری مدل 2026'), 2000);
  assert.equal(readEngineVolume('موتور ۱٫۶ لیتر'), 1600);
  assert.equal(readEngineVolume('موتور 1.8 لیتری'), 1800);
  assert.equal(readEngineVolume('motor 2.5 L'), 2500);
  assert.equal(readEngineVolume('موتور ۳/۵ لیتر'), 3500);
});

test('a litre figure in another context is not an engine', () => {
  for (const title of [
    'تاکسی ماهانه مصرف ۸ لیتر',
    'ظرفیت ۵ لیتر روغن موتور',
    'دنده ۵ لیتر',
    'باک ۵۰ لیتری پراید',
    'مصرف ۶ لیتر در صد کیلومتر',
    'پژو ۲۰۶ بنزین ۸ لیتری',
    'کرولا ۱۲ لیتر',
    'مخزن ۱۰ لیتر',
    'موتور ۹ لیتری',
    'ماشین ۲ لیتر',
  ]) {
    expect_null(title);
  }
  assert.equal(readEngineVolume('کرولا ۲ لیتری'), 2000);
  assert.equal(readEngineVolume('حجم موتور ۲ لیتر'), 2000);
  assert.equal(readEngineVolume('۳ لیتر موتور'), 3000);
  assert.equal(readEngineVolume('هیوندای ۳٫۳ لیتر'), 3300);
});

function expect_null(title: string): void {
  assert.equal(readEngineVolume(title), null, title);
}

test('a figure with no unit, or not an engine, is not read', () => {
  assert.equal(readEngineVolume('پژو ۲۰۶ مدل ۱۴۰۰'), null);
  assert.equal(readEngineVolume('تاکسی بین شهری ماهانه 750لیتر بنزین'), null);
  assert.equal(readEngineVolume('ماشین ۲۰۰۰ کیلومتر کارکرد'), null);
  assert.equal(readEngineVolume('ماشین 12cc'), null);
  assert.equal(readEngineVolume('قیمت 1.5 میلیارد'), null);
  assert.equal(readEngineVolume(''), null);
});

test('a volume is written in Persian digits with its unit', () => {
  assert.equal(formatEngineVolume(1600), `۱٬۶۰۰${NBSP}${CC_UNIT_FA}`);
  assert.equal(isEngineVolume(500), true);
  assert.equal(isEngineVolume(499), false);
  assert.equal(isEngineVolume(9001), false);
  assert.equal(isEngineVolume(1600.5), false);
});
