import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SourceResponse } from '../../runtime/http.ts';
import { postAnswer, searchAnswer } from '../../test-support/divar-fixtures.ts';
import { DivarShapeError, postRefusal, searchRefusal } from './answers.ts';
import { listingPageUrl, postUrl, searchBody, searchUrl } from './api.ts';
import { CANONICAL_VERSION, PHONE_REMOVED, photoUrlsOf, readPost } from './post.ts';
import { readSearchPage } from './search.ts';

// Divar's two answers, read from fixtures built like the real ones (src/test-support/divar-fixtures.ts).

function answer(body: string, status = 200): SourceResponse {
  return {
    url: 'https://api.divar.ir/v8/postlist/w/search',
    status,
    headers: new Headers(),
    body,
    startedAt: new Date(),
    durationMs: 1,
  };
}

test('the crawler builds only the search and the post addresses, and a search body the web client would send', () => {
  assert.equal(searchUrl('https://api.divar.ir'), 'https://api.divar.ir/v8/postlist/w/search');
  assert.equal(postUrl('https://api.divar.ir', 'gaTEST01'), 'https://api.divar.ir/v8/posts-v2/web/gaTEST01');
  assert.equal(listingPageUrl('gaf-cP_-'), 'https://divar.ir/v/gaf-cP_-');
  assert.deepEqual(JSON.parse(searchBody({ brandModels: ['Peugeot 206', 'Pride'], cursor: { page: 1 } })), {
    city_ids: ['1'],
    search_data: {
      form_data: {
        data: {
          category: { str: { value: 'light' } },
          brand_model: { repeated_string: { value: ['Peugeot 206', 'Pride'] } },
        },
      },
      server_payload: {
        '@type': 'type.googleapis.com/widgets.SearchData.ServerPayload',
        additional_form_data: { data: { sort: { str: { value: 'sort_date' } } } },
      },
    },
    pagination_data: { page: 1 },
  });
  // Every car in Tehran: no brand filter, no cursor on the first page.
  const all: unknown = JSON.parse(searchBody({}));
  assert.deepEqual(all, {
    city_ids: ['1'],
    search_data: {
      form_data: { data: { category: { str: { value: 'light' } } } },
      server_payload: {
        '@type': 'type.googleapis.com/widgets.SearchData.ServerPayload',
        additional_form_data: { data: { sort: { str: { value: 'sort_date' } } } },
      },
    },
  });
});

test('a search page gives each row its token, sort time and labels, the cursor, and the values one level down', () => {
  const page = readSearchPage(
    searchAnswer(
      [
        { token: 'gaPROMO1', sortedAt: '2026-09-27T08:13:27.181938Z', promoted: true },
        { token: 'gaNEW001', sortedAt: '2026-09-29T10:28:48.770Z', price: 'توافقی' },
        { token: 'gaBUMP01', sortedAt: '2026-09-29T10:28:31.752095Z', bumped: true },
      ],
      {
        hasNextPage: true,
        cursor: { page: 1, last_post_date: '2026-09-29T10:12:09.155900Z' },
        childValues: ['Peugeot 206', 'Peugeot 405'],
      },
    ),
  );
  assert.deepEqual(
    page.rows.map((row) => [row.token, row.sortedAt?.toISOString(), row.bumped, row.promoted, row.priceText]),
    [
      ['gaPROMO1', '2026-09-27T08:13:27.181Z', false, true, '۱,۲۵۰,۰۰۰,۰۰۰ تومان'],
      ['gaNEW001', '2026-09-29T10:28:48.770Z', false, false, 'توافقی'],
      ['gaBUMP01', '2026-09-29T10:28:31.752Z', true, false, '۱,۲۵۰,۰۰۰,۰۰۰ تومان'],
    ],
  );
  assert.equal(page.hasNextPage, true);
  assert.deepEqual(page.cursor, { page: 1, last_post_date: '2026-09-29T10:12:09.155900Z' });
  assert.deepEqual(page.childValues, ['Peugeot 206', 'Peugeot 405']);
  assert.match(page.rows[0]?.imageUrl ?? '', /^https:\/\/s100\.divarcdn\.com\//);
});

test('a search answer that is not a page, or a row without a token, is a changed API, not a page', () => {
  assert.throws(() => readSearchPage('{"sections": []}'), DivarShapeError);
  assert.throws(
    () =>
      readSearchPage(JSON.stringify({ list_widgets: [{ widget_type: 'POST_ROW', data: { title: 'x' } }] })),
    DivarShapeError,
  );
  assert.throws(
    () =>
      readSearchPage(
        JSON.stringify({ list_widgets: [{ widget_type: 'POST_ROW', data: { token: 'bad token!' } }] }),
      ),
    DivarShapeError,
  );
});

test('a challenge page, an empty answer, or no listings where some must be are refusals; a 404 is not', () => {
  const expectingRows = searchRefusal(true);
  assert.equal(
    expectingRows(answer('<!DOCTYPE html><html><body>Checking your browser</body></html>')),
    'challenge',
  );
  assert.equal(expectingRows(answer('')), 'blocked');
  assert.equal(expectingRows(answer('{}')), 'blocked');
  assert.equal(expectingRows(answer('[]')), 'blocked');
  assert.equal(expectingRows(answer(searchAnswer([]))), 'blocked');
  assert.equal(
    expectingRows(answer(searchAnswer([{ token: 'gaNEW001', sortedAt: '2026-09-29T10:00:00Z' }]))),
    undefined,
  );
  // A slice a measurement walks may hold nothing at all: an empty but whole page is an answer.
  assert.equal(searchRefusal(false)(answer(searchAnswer([]))), undefined);
  assert.equal(searchRefusal(false)(answer('{}')), 'blocked');
  assert.equal(postRefusal(answer('{"code": 5, "message": "آگهی یافت نشد"}', 404)), undefined);
  assert.equal(postRefusal(answer('{"code": 5}')), 'blocked');
  assert.equal(postRefusal(answer('<html>captcha</html>')), 'challenge');
  assert.equal(postRefusal(answer(postAnswer({ token: 'gaTEST01' }))), undefined);
});

test('a post is stored without its contact, map, owner id, interface rows, analytics and daily-changing lines', () => {
  const { payload } = readPost(postAnswer({ token: 'gaTEST01', dealer: true, price: '۱,۲۵۰,۰۰۰,۰۰۰ تومان' }));
  const text = JSON.stringify(payload);
  for (const absent of [
    'contact_uuid',
    'latitude',
    'MAP_ROW',
    'hashed_post_owner_user_id',
    'BUSINESS_SECTION',
    'یادداشت من',
    'گزارش آگهی',
    'زنگ خطرهای قبل از معامله',
    'بررسی و کارشناسی',
    'analytics',
    'action_log',
    'gender',
    '1249999872',
    'روز پیش',
    '۷ مهر ۱۴۰۵"',
  ]) {
    assert.ok(!text.includes(absent), `the snapshot still holds ${absent}`);
  }
  assert.deepEqual(
    (payload.sections as { section_name: string }[]).map((section) => section.section_name),
    ['BREADCRUMB', 'TITLE', 'DESCRIPTION', 'IMAGE', 'LIST_DATA', 'TAGS'],
  );
  // What the car is, when it was posted and the features it lists stay.
  for (const present of [
    'انتشار آگهی: ۲ مهر ۱۴۰۵، ۰۹:۴۷',
    'قیمت پایه',
    'مالک خودرو هستم',
    'unavailable_after',
    'premium-panel',
  ]) {
    assert.ok(text.includes(present), `the snapshot lost ${present}`);
  }
  assert.equal(CANONICAL_VERSION, 1);
});

test('every photo is kept, full size and thumbnail, in Divar’s order, so pages can show them without another crawl', () => {
  const { payload, facts } = readPost(postAnswer({ token: 'gaTEST01', photos: 3 }));
  const expected = [0, 1, 2].map((index) => ({
    url: `https://s100.divarcdn.com/static/photo/neda/webp_post/FULL${String(index)}/gaTEST01-${String(index)}.webp`,
    thumbnailUrl: `https://s100.divarcdn.com/static/photo/neda/webp_thumbnail/THUMB${String(index)}/gaTEST01-${String(index)}.webp`,
  }));
  assert.deepEqual(facts.photos, expected);
  // Read back from the stored payload, as CS-60 or a page would.
  assert.deepEqual(photoUrlsOf(payload), expected);
  assert.deepEqual(readPost(postAnswer({ token: 'gaTEST02', photos: 0 })).facts.photos, []);
});

test('a phone number written into a title or description is removed; addresses are left whole', () => {
  const { payload } = readPost(
    postAnswer({
      token: 'gaTEST01',
      title: 'پژو ۲۰۶ تماس ۰۹۱۲۱۲۳۴۵۶۷',
      description: 'فقط تماس 0912 123 4567 یا ۰۲۱-۲۲۳۳۴۴۵۵\nبیمه دارد',
    }),
  );
  const text = JSON.stringify(payload);
  assert.ok(!/۰۹۱۲۱۲۳۴۵۶۷|0912 123 4567|۰۲۱-۲۲۳۳۴۴۵۵/.test(text), text);
  assert.ok(text.includes(`پژو ۲۰۶ تماس ${PHONE_REMOVED}`));
  assert.ok(text.includes('https://s100.divarcdn.com/static/photo/neda/webp_post/FULL0/gaTEST01-0.webp'));
});

test('a post says whether it is a car, when it was posted, what it asks and which make and model it is', () => {
  const read = readPost(
    postAnswer({ token: 'gaTEST01', price: '۱,۲۵۰,۰۰۰,۰۰۰ تومان', published: '۲ مهر ۱۴۰۵، ۰۹:۴۷' }),
  );
  assert.equal(read.facts.isCar, true);
  assert.deepEqual(read.facts.publishedAt, new Date('2026-09-24T06:17:00Z'));
  assert.deepEqual(read.facts.price, { type: 'asking', toman: 1_250_000_000 });
  assert.equal(read.facts.brandModel, 'Peugeot 206 5');
  assert.deepEqual(read.facts.unknownSections, []);
  assert.equal(readPost(postAnswer({ token: 'gaTEST01', category: 'motorcycles' })).facts.isCar, false);
  assert.deepEqual(readPost(postAnswer({ token: 'gaTEST01', price: 'توافقی' })).facts.price, {
    type: 'negotiable',
  });
  const unread = readPost(postAnswer({ token: 'gaTEST01', price: 'تماس بگیرید', published: 'دیروز' }));
  assert.equal(unread.facts.price, undefined);
  assert.equal(unread.facts.priceText?.includes('تماس بگیرید'), true);
  assert.equal(unread.facts.publishedAt, undefined);
  assert.equal(readPost(postAnswer({ token: 'gaTEST01' })).facts.price, undefined);
});

test('a section Divar adds later is left out and reported, and an unchanged post reads to the same snapshot', () => {
  const read = readPost(postAnswer({ token: 'gaTEST01', extraSection: 'SELLER_PROFILE' }));
  assert.deepEqual(read.facts.unknownSections, ['SELLER_PROFILE']);
  assert.ok(!JSON.stringify(read.payload).includes('SELLER_PROFILE'));
  assert.deepEqual(
    readPost(postAnswer({ token: 'gaTEST01' })).payload,
    readPost(postAnswer({ token: 'gaTEST01' })).payload,
  );
  assert.throws(() => readPost('{"list_widgets": []}'), DivarShapeError);
});
