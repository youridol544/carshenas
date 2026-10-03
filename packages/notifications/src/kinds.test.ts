import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolate } from '@carshenas/locale/bidi';
import { formatCountOf, formatPercent } from '@carshenas/locale/format-number';
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

const digest = {
  searchFileId: 7,
  fileName: 'پژو 206 تیپ ۵',
  newCount: 3,
  goodCount: 2,
  dropCount: 0,
  sinceKey: '1790000000000000',
};

test('a search file digest counts the new listings, says how many are good deals and names the run in its event key', () => {
  assert.deepEqual(renderNotification('search_file_matches', digest), {
    title: `${formatCountOf(3, 'آگهی')} تازه برای «${isolate('پژو ۲۰۶ تیپ ۵')}»`,
    detail: `${formatCountOf(2, 'آگهی')} از آن‌ها قیمت خوب یا عالی دارد.`,
  });
  assert.equal(NOTIFICATION_KINDS.search_file_matches.eventKey(digest), 'search_file:7:1790000000000000');
  assert.equal(
    renderNotification('search_file_matches', { ...digest, goodCount: 3 })?.detail,
    'همه‌شان قیمت خوب یا عالی دارند.',
  );
  assert.equal(renderNotification('search_file_matches', { ...digest, goodCount: 0 }), undefined);
});

test('a digest of price drops alone, or of both, says so; one of nothing is refused', () => {
  assert.equal(
    renderNotification('search_file_matches', { ...digest, newCount: 0, goodCount: 0, dropCount: 2 })?.title,
    `${formatCountOf(2, 'آگهی')} در «${isolate('پژو ۲۰۶ تیپ ۵')}» ارزان‌تر شد`,
  );
  assert.match(
    renderNotification('search_file_matches', { ...digest, goodCount: 0, dropCount: 1 })?.detail ?? '',
    /ارزان‌تر شده/,
  );
  const schema = NOTIFICATION_KINDS.search_file_matches.payload;
  for (const payload of [
    { ...digest, newCount: 0, goodCount: 0 },
    // New listings that are neither good deals nor drops send no digest.
    { ...digest, goodCount: 0, dropCount: 0 },
    { ...digest, goodCount: 4 },
    { ...digest, fileName: ' ' },
    { ...digest, ownerName: 'x' },
  ]) {
    assert.equal(schema.safeParse(payload).success, false, JSON.stringify(payload));
  }
});
