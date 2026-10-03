import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readMileageWording } from './mileage-wording.ts';

// The wordings of CS-101 on fragments of real Divar listings of 2026-09-30 to 2026-10-03 whose mileage field held a
// figure under 1,000 on a car of three or more model years (docs/evidence/listing-facts/2026-10-03-mileage-in-thousands.md
// has the full measurement). A fragment is a few words of the title or description around the wording, with no
// personal data; the figure is what the structured field said.

const READ_AS_LOW: readonly (readonly [text: string, written: number, wording: string])[] = [
  ['ماشین صفر خشک مدل اسفند ۱۴۰۲', 0, 'صفر خشک'],
  ['۲۰۷ صفر خشک TU5 بیمه یکسال', 0, 'صفر خشک'],
  ['دنا اتومات/دنده (صفر خشک 1405 با رنگبندی)', 0, 'صفر خشک'],
  ['خودرو مدل۱۴۰۰ صفر کیلو متر میباشد باتری تعویض شده', 0, 'صفر کیلو متر'],
  ['خودرو صفرکیلومتر می باشد.دریچه گاز سیمی', 0, 'صفرکیلومتر'],
  ['✅️صفر کیلو مترو ✅️نقد و اقساط', 0, 'صفر کیلو متر'],
  ['سمند صفر خشک 1400 بدون کارکرد از نمایندگی', 0, 'صفر خشک'],
  ['پژو پارس xu7p صفر سال ۱۴۰۲ ماشین حرکت نداشته صفر واقعی', 0, 'حرکت نداشته'],
  ['ماشین صفر صفر ۴۴۰ کیلومتر کارکرد به دلیل چند بار روغن', 0, 'ماشین صفر'],
  ['دنا پلاس صفر خشک مدل 1402 کارکرد 100دونه از نمایندگی تا منزل', 100, 'صفر خشک'],
  ['کوییک ار سفید و قرمز ماشین چند سال خوابیده ۶۰۰ دونه کار بیمه', 0, '600 دونه کار'],
  ['ماشین حدود ۳۵۰۰ کارکرد واقعی دارد به شرط', 0, '3500 کارکرد واقعی'],
  ['خودرو صفر می باشد', 0, 'خودرو صفر'],
  ['ماشین صفر هست از اول داخل پارکینگ بوده', 0, 'ماشین صفر'],
  ['صفر خشک واقعی؛ چهار چرخ دیسک', 660, 'صفر خشک'],
];

const READ_AS_THOUSANDS: readonly (readonly [text: string, written: number, wording: string])[] = [
  ['۱۰۹تا کیلومتر انداخته روغن موتور تعویض شده', 109, '109تا کیلومتر'],
  ['۹۹ تا کارکرد ماشین تمیز و سالم', 99, '99 تا کارکرد'],
  ['ماشین کویک مدل ۱۴۰۰ ۳۰ تا کار بی رنگ', 30, '30 تا کار'],
  ['پژو 206 تیپ 2 مدل 1400 درحدصفر/ کم کار 60 هزارتا', 60, '60 هزار'],
  ['اتومبیل کاملا سالم و بدون تصادف می باشد کار کرد 73000 بیمه تا آخر سال', 73, 'کار کرد 73000'],
  ['کارکرد ۷۳٬۰۰۰ کیلومتر', 73, 'کارکرد 73٬000'],
  ['کیلومتر 73,000 بیمه', 73, 'کیلومتر 73,000'],
  ['۱۲۰ هزار کیلومتر کارکرد', 120, '120 هزار'],
];

const READ_AS_NOTHING: readonly (readonly [text: string, written: number])[] = [
  // Figures of speech and quality claims are not a mileage.
  ['پژو ۲۰۶ در حد صفر', 126],
  ['پارس ۸۵ در حد ** صفر ** بازسازی ۰ تا ۱۰۰ با بهترین متریال', 540],
  ['پرشیا۸۴پلمپ بدون پشت چراغی واقعی موتور صفر نو نو', 0],
  ['ماشین کیلومتر واقعی فقط مصرف کننده', 160],
  ['پارس نونو رنگ سفید کارکرد واقعی بشرط بدون رنگ شدگی', 35],
  // A bare figure beside the word says nothing of its unit; the price decides.
  ['۲۰۶ تیپ ۵ کارکرد 307 تمام رنگ', 307],
  ['کارکرد 130 بیمه نزدیک یکسال', 130],
  // Money and counts are not kilometres.
  ['۱۰۰ هزار تومان تخفیف پای معامله', 100],
  ['۴ دونه لاستیک نو', 4],
  ['۳ تا لکه رنگ دارد', 3],
  ['کد 589389 آکام خودرو', 589],
  ['', 100],
  ['ماشین سالم و تمیز', 0],
];

test('a text that says the car was never driven or states a small exact mileage reads the figure as really that low', () => {
  for (const [text, written, wording] of READ_AS_LOW) {
    const read = readMileageWording(text, written);
    assert.deepEqual(read, { reading: 'really_low', wording }, text);
  }
});

test('a text that counts thousands of kilometres reads the figure as thousands', () => {
  for (const [text, written, wording] of READ_AS_THOUSANDS) {
    const read = readMileageWording(text, written);
    assert.deepEqual(read, { reading: 'thousands_text', wording }, text);
  }
});

test('a text that is a figure of speech, a bare figure or not about kilometres settles nothing', () => {
  for (const [text, written] of READ_AS_NOTHING) {
    assert.equal(readMileageWording(text, written), null, text);
  }
});

test('a text that points both ways points nowhere, and a figure of 0 cannot be thousands', () => {
  assert.equal(readMileageWording('صفر خشک و کارکرد ۱۰۰ هزار', 100), null);
  assert.equal(readMileageWording('۰ هزار', 0), null);
});

test('the figure the thousands wording states is the one the seller wrote', () => {
  // «۶۰ هزار» says nothing about a field that holds 100.
  assert.equal(readMileageWording('کم کار 60 هزارتا', 100), null);
  assert.equal(readMileageWording('کم کار 60 هزارتا', 6), null);
  assert.equal(readMileageWording('کار کرد 73000', 7), null);
});

test('Arabic letters and digits, direction marks and the zero-width non-joiner are read as their Persian forms', () => {
  const zwnj = String.fromCodePoint(0x200c);
  const rlm = String.fromCodePoint(0x200f);
  assert.deepEqual(readMileageWording(`صفر${zwnj}کیلومتر`, 0), { reading: 'really_low', wording: 'صفر کیلومتر' });
  assert.deepEqual(readMileageWording(`${rlm}كارکرد ٧٣٠٠٠`, 73), {
    reading: 'thousands_text',
    wording: 'کارکرد 73000',
  });
});
