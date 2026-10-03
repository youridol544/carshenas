import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolate } from '@carshenas/locale/bidi';
import { formatPercent } from '@carshenas/locale/format-number';
import { formatTomanInWords, toToman } from '@carshenas/locale/toman';
import { NOTIFICATION_KIND_IDS, NOTIFICATION_KINDS, renderNotification } from './kinds.ts';

// Each kind's definition (ADR-0026 point 3): the Farsi it builds from stored facts, the event key it deduplicates on,
// and the payloads its schema refuses. One test per kind; a new kind adds its own.

const drop = {
  priceEventId: 812,
  carName: 'پژو ۲۰۶ تیپ ۵',
  modelYearSh: 1399,
  previousPriceToman: 850_000_000,
  priceToman: 810_000_000,
};

test('a price drop names the car and its year, the drop in words and as a share, and keeps both prices', () => {
  const text = renderNotification('listing_price_drop', drop);
  assert.deepEqual(text, {
    title: `قیمت ${isolate('پژو ۲۰۶ تیپ ۵')} مدل ۱۳۹۹ کم شد`,
    detail: `${formatTomanInWords(toToman(40_000_000))} (${formatPercent(0.047)}) ارزان‌تر از قیمت قبلی.`,
    priceChange: { fromToman: 850_000_000, toToman: 810_000_000 },
  });
  assert.equal(NOTIFICATION_KINDS.listing_price_drop.eventKey(drop), 'price_event:812');
  const { modelYearSh: _year, ...withoutYear } = drop;
  assert.equal(
    renderNotification('listing_price_drop', withoutYear)?.title,
    `قیمت ${isolate('پژو ۲۰۶ تیپ ۵')} کم شد`,
  );
});

test("a number standing alone in the car's name reads in Persian digits, and a Latin code keeps its own", () => {
  const title = renderNotification('listing_price_drop', { ...drop, carName: 'پژو 206 SD V8' })?.title;
  assert.equal(title, `قیمت ${isolate('پژو ۲۰۶ SD V8')} مدل ۱۳۹۹ کم شد`);
});

test('a price drop refuses a rise, an unchanged price, a price out of range and facts it does not know', () => {
  const schema = NOTIFICATION_KINDS.listing_price_drop.payload;
  for (const payload of [
    { ...drop, priceToman: 900_000_000 },
    { ...drop, priceToman: drop.previousPriceToman },
    { ...drop, priceToman: 0 },
    { ...drop, previousPriceToman: 1e18 },
    { ...drop, carName: '  ' },
    { ...drop, sellerPhone: '09120000000' },
  ]) {
    assert.equal(schema.safeParse(payload).success, false, JSON.stringify(payload));
  }
});

test('a notification of an unknown kind, or whose facts no longer fit its kind, renders as nothing', () => {
  assert.equal(renderNotification('made_up', drop), undefined);
  assert.equal(renderNotification('listing_price_drop', { priceEventId: 1 }), undefined);
});

test('every kind has a mute label and a description in Farsi', () => {
  for (const kind of NOTIFICATION_KIND_IDS) {
    const { label, description } = NOTIFICATION_KINDS[kind].setting;
    assert.match(label, /\p{Script=Arabic}/u);
    assert.match(description, /\p{Script=Arabic}/u);
  }
});

const decided = { requestId: 31, decision: 'approved', carName: 'پژو 405 GLX', fileId: 7 } as const;

test('an approved crawl request says the model is queued, names the car and opens the buyer’s own file (CS-71)', () => {
  const text = renderNotification('crawl_request_decided', decided);
  assert.ok(text);
  assert.equal(text.title, `درخواست شما برای ${isolate('پژو ۴۰۵ GLX')} تأیید شد`);
  assert.match(text.detail ?? '', /در صف خواندن آگهی‌ها/);
  assert.equal(text.href, '/account/searches/7');
  assert.equal(NOTIFICATION_KINDS.crawl_request_decided.eventKey(decided), 'crawl_request:31:approved');
});

test('a declined crawl request gives the superadmin’s reason, and each decision is its own event (CS-71)', () => {
  const declined = { ...decided, decision: 'declined', reason: 'این مدل خارج از بازار تهران است' } as const;
  const text = renderNotification('crawl_request_decided', declined);
  assert.ok(text);
  assert.equal(text.title, `درخواست شما برای ${isolate('پژو ۴۰۵ GLX')} پذیرفته نشد`);
  assert.equal(text.detail, 'دلیل: این مدل خارج از بازار تهران است');
  assert.notEqual(
    NOTIFICATION_KINDS.crawl_request_decided.eventKey(declined),
    NOTIFICATION_KINDS.crawl_request_decided.eventKey(decided),
  );
});

test('a crawl request notification refuses a made-up decision, a blank car and facts it does not know (CS-71)', () => {
  const schema = NOTIFICATION_KINDS.crawl_request_decided.payload;
  for (const payload of [
    { ...decided, decision: 'pending' },
    { ...decided, carName: ' ' },
    { ...decided, fileId: 0 },
    { ...decided, buyerPhone: '09120000000' },
  ]) {
    assert.equal(schema.safeParse(payload).success, false, JSON.stringify(payload));
  }
});
