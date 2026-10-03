import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test, type TestContext } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB, JsonObject } from '@carshenas/db/db-types';
import { writeDerivedListingOrRefusal } from './db/attribute-store.ts';
import { createTestSource, openScratchDatabase } from './db/test-database.ts';
import { deriveStoredListings, type DerivationReport } from './listing-derivation.ts';
import type { DerivedListing } from './sources/attributes.ts';
import { jsonObjectOf } from './sources/divar/answers.ts';
import { DIVAR_PARSER_VERSION, deriveDivarListing } from './sources/divar/attributes.ts';
import { testWorkerDatabase } from './test-support/runtime.ts';
import { until } from './test-support/wait.ts';

// `pnpm derive:listings` (CS-34 criterion 4) on a scratch database: every stored listing is derived again from its
// latest snapshot, as the crawler left it, with no request to any source. The snapshots are made from real Divar posts
// (src/test-support/divar-snapshots).

let owner: Kysely<DB>;
let worker: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
  worker = testWorkerDatabase();
});

after(async () => {
  await worker.destroy();
  await owner.destroy();
});

function realSnapshot(name: string): string {
  return JSON.stringify(
    JSON.parse(readFileSync(new URL(`./test-support/divar-snapshots/${name}.json`, import.meta.url), 'utf8')),
  );
}

function payloadOf(text: string): JsonObject {
  const payload = jsonObjectOf(text);
  if (payload === undefined) throw new Error('not a JSON object');
  return payload;
}

const REAL = realSnapshot('private-206-both-calendars');
const MILEAGE = '"title":"کارکرد","value":"۹۱۰۰۰"';

/** The real private seller's post with another mileage. */
function withMileage(text: string): JsonObject {
  if (!REAL.includes(MILEAGE)) throw new Error('the fixture no longer states its mileage as expected');
  return payloadOf(REAL.replace(MILEAGE, `"title":"کارکرد","value":${JSON.stringify(text)}`));
}

type Crawl = { readonly sourceId: string; readonly runId: number };

/** A source of the test's own, with a crawl run for its fetches. */
async function crawl(context: TestContext): Promise<Crawl> {
  const sourceId = await createTestSource(owner, context);
  const check = await owner
    .selectFrom('source_policy_check')
    .select('id')
    .where('source_id', '=', sourceId)
    .executeTakeFirstOrThrow();
  const run = await owner
    .insertInto('crawl_run')
    .values({ source_id: sourceId, policy_check_id: check.id, kind: 'detail' })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { sourceId, runId: run.id };
}

async function listing(db: Kysely<DB>, crawled: Crawl, key: string): Promise<number> {
  const row = await db
    .insertInto('listing')
    .values({
      source_id: crawled.sourceId,
      source_listing_key: key,
      url: `https://divar.ir/v/${key}`,
      status: 'active',
      listed_at: new Date('2026-09-24T06:17:00Z'),
      last_seen_at: new Date('2026-09-30T08:00:00Z'),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function snapshot(
  db: Kysely<DB>,
  listingId: number,
  payload: JsonObject,
  firstFetchedAt = new Date('2026-09-30T08:00:00Z'),
): Promise<number> {
  const row = await db
    .insertInto('snapshot')
    .values({
      listing_id: listingId,
      first_fetched_at: firstFetchedAt,
      url: 'https://api.divar.ir/v8/posts-v2/web/test',
      canonical_version: 1,
      payload,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

let clock = Date.parse('2026-09-30T08:00:00Z');

/** A fetch of the listing that returned this snapshot, or nothing (404); each a minute after the one before. */
async function fetched(
  db: Kysely<DB>,
  crawled: Crawl,
  listingId: number,
  snapshotId: number | null,
): Promise<void> {
  clock += 60_000;
  await db
    .insertInto('fetch_log')
    .values({
      source_id: crawled.sourceId,
      crawl_run_id: crawled.runId,
      url: 'https://api.divar.ir/v8/posts-v2/web/test',
      requested_at: new Date(clock),
      http_status: snapshotId === null ? 404 : 200,
      outcome: snapshotId === null ? 'not_found' : 'ok',
      listing_id: listingId,
      snapshot_id: snapshotId,
    })
    .execute();
}

async function mileageOf(listingId: number): Promise<number | null> {
  const row = await owner
    .selectFrom('listing')
    .select('mileage_km')
    .where('id', '=', listingId)
    .executeTakeFirstOrThrow();
  return row.mileage_km;
}

async function countOf(
  table: 'listing_photo' | 'listing_unparsed_value',
  listingId: number,
): Promise<number> {
  const row = await owner
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('listing_id', '=', listingId)
    .executeTakeFirstOrThrow();
  return row.count;
}

/** The mileage rows kept as the seller's text, as the database holds them. */
async function unparsedMileageOf(listingId: number) {
  return owner
    .selectFrom('listing_unparsed_value')
    .select(['field', 'raw_text'])
    .where('listing_id', '=', listingId)
    .where('field', '=', 'mileage_km')
    .execute();
}

test('every stored listing is derived again from its latest snapshot, and a run that finds nothing new writes nothing', async (context) => {
  const crawled = await crawl(context);
  // A page that changed and changed back: its latest fetch returned the first snapshot again.
  const changedBack = await listing(owner, crawled, 'gaFIX001');
  const first = await snapshot(owner, changedBack, payloadOf(REAL));
  const second = await snapshot(owner, changedBack, withMileage('۱۲۰۰۰۰'));
  await fetched(owner, crawled, changedBack, first);
  await fetched(owner, crawled, changedBack, second);
  await fetched(owner, crawled, changedBack, first);
  const pickup = await listing(owner, crawled, 'gaFIX003');
  await fetched(
    owner,
    crawled,
    pickup,
    await snapshot(owner, pickup, payloadOf(realSnapshot('dealer-pickup-placeholder-price'))),
  );
  const dealer = await listing(owner, crawled, 'gaFIX002');
  await fetched(
    owner,
    crawled,
    dealer,
    await snapshot(owner, dealer, payloadOf(realSnapshot('dealer-206-swap-installments'))),
  );
  // Seen, never read in detail; and a snapshot that is not a post.
  const gone = await listing(owner, crawled, 'gaGONE001');
  await fetched(owner, crawled, gone, null);
  const notAPost = await listing(owner, crawled, 'gaNOTPOST');
  await fetched(owner, crawled, notAPost, await snapshot(owner, notAPost, { title: 'not a post' }));

  const parsers = { [crawled.sourceId]: deriveDivarListing };
  // Two listings a batch, so the batches go on past a listing with no snapshot.
  const report = await deriveStoredListings(worker, parsers, { batchSize: 2 });
  assert.deepEqual([report.derived, report.heldElsewhere], [3, 0]);
  assert.equal(report.withoutSnapshot, 1);
  assert.deepEqual(report.unreadable, [notAPost]);
  assert.deepEqual([report.attributesChanged, report.photosChanged, report.unparsedChanged], [3, 3, 0]);
  assert.equal(await mileageOf(changedBack), 91_000);
  assert.equal(await countOf('listing_photo', changedBack), 7);
  assert.deepEqual(report.fields.mileage_km, {
    read: 3,
    statedUnknown: 0,
    unparsed: 0,
    implausible: 0,
    absent: 0,
  });
  assert.deepEqual(report.fields.insurance_months_left, {
    read: 2,
    statedUnknown: 0,
    unparsed: 0,
    implausible: 0,
    absent: 1,
  });
  assert.deepEqual(report.fields.gearbox_condition, {
    read: 2,
    statedUnknown: 0,
    unparsed: 0,
    implausible: 0,
    absent: 1,
  });
  assert.deepEqual(report.fields.accepts_swap, {
    read: 1,
    statedUnknown: 0,
    unparsed: 0,
    implausible: 0,
    absent: 2,
  });
  assert.deepEqual([report.unparsedTexts, report.unknownLabels], [[], []]);
  assert.deepEqual([report.photosKept, report.photosSkipped], [14, 0]);

  const again = await deriveStoredListings(worker, parsers, { batchSize: 2 });
  assert.equal(again.derived, 3);
  assert.deepEqual([again.attributesChanged, again.photosChanged, again.unparsedChanged], [0, 0, 0]);

  // A value changed behind the parser's back is put right by the next run.
  await owner.updateTable('listing').set({ mileage_km: 1 }).where('id', '=', changedBack).execute();
  const repaired = await deriveStoredListings(worker, parsers);
  assert.equal(repaired.attributesChanged, 1);
  assert.equal(await mileageOf(changedBack), 91_000);
});

test('a listing whose snapshots were copied without their fetches is derived from the one first fetched last, until a fetch here records one', async (context) => {
  const crawled = await crawl(context);
  // Copied from another database without its request log, as the bake-off's listings were into the main database
  // (2026-09-30). The later snapshot was stored first, so its id is the lower one: the date decides, not the id.
  const copied = await listing(owner, crawled, 'gaCOPY001');
  await snapshot(owner, copied, payloadOf(REAL), new Date('2026-09-30T08:02:00Z'));
  const earlier = await snapshot(owner, copied, withMileage('۱۲۰۰۰۰'), new Date('2026-09-30T08:01:00Z'));
  const parsers = { [crawled.sourceId]: deriveDivarListing };
  const report = await deriveStoredListings(worker, parsers);
  assert.deepEqual([report.derived, report.withoutFetch, report.withoutSnapshot], [1, 1, 0]);
  assert.equal(await mileageOf(copied), 91_000);

  // Once a fetch here records one of its snapshots, that fetch decides, as for every crawled listing.
  await fetched(owner, crawled, copied, earlier);
  const recrawled = await deriveStoredListings(worker, parsers);
  assert.deepEqual([recrawled.derived, recrawled.withoutFetch], [1, 0]);
  assert.equal(await mileageOf(copied), 120_000);
});

test('a value the parser cannot read is kept and reported, and a parser that learns it fills it without a new crawl', async (context) => {
  const crawled = await crawl(context);
  const listed = await listing(owner, crawled, 'gaFIX001');
  await fetched(owner, crawled, listed, await snapshot(owner, listed, withMileage('زیر صد هزار')));
  const report = await deriveStoredListings(worker, { [crawled.sourceId]: deriveDivarListing });
  assert.equal(await mileageOf(listed), null);
  assert.equal(await countOf('listing_unparsed_value', listed), 1);
  assert.deepEqual(report.fields.mileage_km, {
    read: 0,
    statedUnknown: 0,
    unparsed: 1,
    implausible: 0,
    absent: 0,
  });
  assert.deepEqual(report.unparsedTexts, [['mileage_km: زیر صد هزار', 1]]);

  // The next version of the parser reads «زیر صد هزار»: the stored snapshot is enough.
  const learned = (payload: JsonObject, fetchedAt: Date): DerivedListing => {
    const derived = deriveDivarListing(payload, fetchedAt);
    return {
      ...derived,
      parserVersion: derived.parserVersion + 1,
      attributes: { ...derived.attributes, mileageKm: 100_000 },
      unparsed: derived.unparsed.filter((value) => value.field !== 'mileage_km'),
    };
  };
  const relearned = await deriveStoredListings(worker, { [crawled.sourceId]: learned });
  assert.deepEqual([relearned.attributesChanged, relearned.unparsedChanged], [1, 1]);
  assert.equal(await mileageOf(listed), 100_000);
  assert.equal(await countOf('listing_unparsed_value', listed), 0);
  const version = await owner
    .selectFrom('listing')
    .select('parser_version')
    .where('id', '=', listed)
    .executeTakeFirstOrThrow();
  assert.equal(version.parser_version, DIVAR_PARSER_VERSION + 1);
});

test("a mileage a seller typed in thousands is kept as the seller's text and never as a mileage, as of the day its snapshot was first fetched (CS-86)", async (context) => {
  const crawled = await crawl(context);
  const denaOf1402 = realSnapshot('private-dena-1402-zero-km');
  // The same post of a 1402 car that states 0 km, first fetched in the last instant of 1404 and in the first of 1405:
  // it is two model years old, then three.
  const lastOf1404 = new Date('2026-03-20T20:29:59.999Z');
  const firstOf1405 = new Date('2026-03-20T20:30:00Z');
  const stillNew = await listing(owner, crawled, 'gaFIX005');
  const stillNewSnapshot = await snapshot(owner, stillNew, payloadOf(denaOf1402), lastOf1404);
  // Fetched again, unchanged, now that the car is three model years old: a later fetch does not move the day the
  // snapshot was read at.
  await fetched(owner, crawled, stillNew, stillNewSnapshot);
  await fetched(owner, crawled, stillNew, stillNewSnapshot);
  const notNew = await listing(owner, crawled, 'gaFIX006');
  await fetched(owner, crawled, notNew, await snapshot(owner, notNew, payloadOf(denaOf1402), firstOf1405));
  // The post of a 1397 car whose seller typed «۱۰۹» for 109,000 km, read as of its real fetch.
  const thousands = await listing(owner, crawled, 'gaFIX004');
  await fetched(
    owner,
    crawled,
    thousands,
    await snapshot(
      owner,
      thousands,
      payloadOf(realSnapshot('private-405-mileage-in-thousands')),
      new Date('2026-09-30T13:05:50.986Z'),
    ),
  );

  const parsers = { [crawled.sourceId]: deriveDivarListing };
  const report = await deriveStoredListings(worker, parsers);
  assert.equal(report.derived, 3);
  assert.equal(await mileageOf(stillNew), 0);
  assert.deepEqual(await unparsedMileageOf(stillNew), []);
  assert.equal(await mileageOf(notNew), null);
  assert.deepEqual(await unparsedMileageOf(notNew), [{ field: 'mileage_km', raw_text: '۰' }]);
  assert.equal(await mileageOf(thousands), null);
  assert.deepEqual(await unparsedMileageOf(thousands), [{ field: 'mileage_km', raw_text: '۱۰۹' }]);

  // The report counts them apart from the values it could not read, and names the reason beside the text.
  assert.deepEqual(report.fields.mileage_km, {
    read: 1,
    statedUnknown: 0,
    unparsed: 0,
    implausible: 2,
    absent: 0,
  });
  assert.deepEqual(
    report.unparsedTexts.filter(([text]) => text.startsWith('mileage_km')),
    [
      ['mileage_km: ۰ (implausible)', 1],
      ['mileage_km: ۱۰۹ (implausible)', 1],
    ],
  );

  // Derived again, the same snapshots give the same listings: nothing is written.
  const again = await deriveStoredListings(worker, parsers);
  assert.equal(again.derived, 3);
  assert.deepEqual([again.attributesChanged, again.unparsedChanged], [0, 0]);
  assert.deepEqual(again.fields.mileage_km, report.fields.mileage_km);
});

/** A real post with the seller's description set to this text (the committed fixtures hold a placeholder). */
function withText(name: string, text: string): JsonObject {
  const copy = JSON.parse(realSnapshot(name)) as { sections: { section_name: string; widgets: unknown[] }[] };
  for (const section of copy.sections) {
    if (section.section_name === 'DESCRIPTION') {
      section.widgets = [{ widget_type: 'DESCRIPTION_ROW', data: { text, is_primary: true } }];
    }
  }
  return payloadOf(JSON.stringify(copy));
}

async function readingOf(listingId: number) {
  return owner
    .selectFrom('listing')
    .select(['mileage_km', 'mileage_written_km', 'mileage_reading', 'mileage_wording', 'mileage_ask_ratio'])
    .where('id', '=', listingId)
    .executeTakeFirstOrThrow();
}

test("a mileage under the floor is stored with the figure written, its reading and its words; a reading the valuation run made by the price survives a derivation of the same post and goes with a changed figure (CS-101)", async (context) => {
  const crawled = await crawl(context);
  const fetchedOn = new Date('2026-09-30T13:05:50.986Z');
  const make = async (key: string, payload: JsonObject) => {
    const id = await listing(owner, crawled, key);
    await fetched(owner, crawled, id, await snapshot(owner, id, payload, fetchedOn));
    return id;
  };
  const unsettled = await make('gaFIX101', payloadOf(realSnapshot('private-405-mileage-in-thousands')));
  const byText = await make('gaFIX102', withText('private-405-mileage-in-thousands', '۱۰۹تا کیلومتر انداخته'));
  const neverDriven = await make('gaFIX103', withText('private-dena-1402-zero-km', 'ماشین صفر خشک'));
  const parsers = { [crawled.sourceId]: deriveDivarListing };
  const report = await deriveStoredListings(worker, parsers);
  assert.equal(report.derived, 3);
  assert.deepEqual(await readingOf(unsettled), {
    mileage_km: null,
    mileage_written_km: 109,
    mileage_reading: 'unread',
    mileage_wording: null,
    mileage_ask_ratio: null,
  });
  assert.deepEqual(await readingOf(byText), {
    mileage_km: 109_000,
    mileage_written_km: 109,
    mileage_reading: 'thousands_text',
    mileage_wording: '109تا کیلومتر',
    mileage_ask_ratio: null,
  });
  assert.deepEqual(await readingOf(neverDriven), {
    mileage_km: 0,
    mileage_written_km: 0,
    mileage_reading: 'really_low',
    mileage_wording: 'صفر خشک',
    mileage_ask_ratio: null,
  });
  // Only the unsettled one is kept as the seller's text, as under CS-86.
  assert.deepEqual(await unparsedMileageOf(unsettled), [{ field: 'mileage_km', raw_text: '۱۰۹' }]);
  assert.deepEqual(await unparsedMileageOf(byText), []);
  assert.deepEqual(await unparsedMileageOf(neverDriven), []);
  assert.deepEqual(
    [report.fields.mileage_km.read, report.fields.mileage_km.implausible],
    [2, 1],
  );

  // Derived again: nothing is written.
  const again = await deriveStoredListings(worker, parsers);
  assert.deepEqual([again.attributesChanged, again.unparsedChanged], [0, 0]);

  // The valuation run reads the unsettled figure in thousands by the price. A derivation of the same post leaves that
  // reading and its evidence alone: it is the run's decision, taken again at the next run.
  await owner
    .updateTable('listing')
    .set({ mileage_km: 109_000, mileage_reading: 'thousands_price', mileage_ask_ratio: 0.93 })
    .where('id', '=', unsettled)
    .execute();
  const kept = await deriveStoredListings(worker, parsers);
  assert.deepEqual([kept.attributesChanged, kept.unparsedChanged], [0, 0]);
  assert.deepEqual(await readingOf(unsettled), {
    mileage_km: 109_000,
    mileage_written_km: 109,
    mileage_reading: 'thousands_price',
    mileage_wording: null,
    mileage_ask_ratio: 0.93,
  });

  // The seller edits the figure: a new snapshot says 110, and the reading is the parser's again, with no evidence.
  await fetched(
    owner,
    crawled,
    unsettled,
    await snapshot(
      owner,
      unsettled,
      payloadOf(realSnapshot('private-405-mileage-in-thousands').replace('"value":"۱۰۹"', '"value":"۱۱۰"')),
      new Date('2026-10-01T08:00:00Z'),
    ),
  );
  await deriveStoredListings(worker, parsers);
  assert.deepEqual(await readingOf(unsettled), {
    mileage_km: null,
    mileage_written_km: 110,
    mileage_reading: 'unread',
    mileage_wording: null,
    mileage_ask_ratio: null,
  });
});

/** Locks waited for in this scratch database: a row lock's wait is on a transaction id, which names no database. */
async function waitingLocks(): Promise<number> {
  const { rows } = await sql<{ waiting: number }>`
    SELECT count(*)::int AS waiting
    FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE NOT l.granted AND a.datname = current_database()`.execute(owner);
  return rows[0]?.waiting ?? 0;
}

test('the command waits for a listing the crawler holds, then derives it from the snapshot the crawler committed', async (context) => {
  const crawled = await crawl(context);
  const listed = await listing(owner, crawled, 'gaFIX001');
  await fetched(owner, crawled, listed, await snapshot(owner, listed, payloadOf(REAL)));
  // The crawler holds the listing while it stores a newer page of it.
  const crawler = await owner.startTransaction().execute();
  let derivation: Promise<DerivationReport> | undefined;
  try {
    await crawler.selectFrom('listing').select('id').where('id', '=', listed).forNoKeyUpdate().execute();
    await fetched(crawler, crawled, listed, await snapshot(crawler, listed, withMileage('۱۲۰۰۰۰')));
    derivation = deriveStoredListings(worker, { [crawled.sourceId]: deriveDivarListing });
    await until('the command waits for the held listing', async () => (await waitingLocks()) > 0);
  } catch (error) {
    await crawler.rollback().execute();
    throw error;
  }
  await crawler.commit().execute();
  assert.ok(derivation);
  const report = await derivation;
  assert.deepEqual([report.derived, report.heldElsewhere], [1, 1]);
  // Read after the crawler's commit: the newer page, not the one the command saw when it started.
  assert.equal(await mileageOf(listed), 120_000);
});

test('the command never deadlocks with a writer that holds listings in another order, as discovery does', async (context) => {
  const crawled = await crawl(context);
  const first = await listing(owner, crawled, 'gaFIX001');
  await fetched(owner, crawled, first, await snapshot(owner, first, payloadOf(REAL)));
  const second = await listing(owner, crawled, 'gaFIX002');
  await fetched(
    owner,
    crawled,
    second,
    await snapshot(owner, second, payloadOf(realSnapshot('dealer-206-swap-installments'))),
  );
  // A writer holds the second listing, then asks for the first while the command waits for the second: a command
  // that held the first while waiting would close a cycle with it, and PostgreSQL would abort one of the two.
  const writer = await owner.startTransaction().execute();
  let derivation: Promise<DerivationReport> | undefined;
  try {
    await writer.selectFrom('listing').select('id').where('id', '=', second).forNoKeyUpdate().execute();
    derivation = deriveStoredListings(worker, { [crawled.sourceId]: deriveDivarListing });
    await until('the command waits for the second listing', async () => (await waitingLocks()) > 0);
    await writer.selectFrom('listing').select('id').where('id', '=', first).forNoKeyUpdate().execute();
  } catch (error) {
    await writer.rollback().execute();
    throw error;
  }
  await writer.commit().execute();
  assert.ok(derivation);
  const report = await derivation;
  assert.deepEqual([report.derived, report.heldElsewhere], [2, 1]);
  assert.equal(await mileageOf(second), 90_000);
});

test('a listing still held when the lock timeout ends the wait is reported, and the run keeps its report', async (context) => {
  const crawled = await crawl(context);
  const held = await listing(owner, crawled, 'gaFIX001');
  await fetched(owner, crawled, held, await snapshot(owner, held, payloadOf(REAL)));
  const free = await listing(owner, crawled, 'gaFIX002');
  await fetched(
    owner,
    crawled,
    free,
    await snapshot(owner, free, payloadOf(realSnapshot('dealer-206-swap-installments'))),
  );
  // A writer holds one listing for longer than the worker role's lock timeout (5 s).
  const writer = await owner.startTransaction().execute();
  try {
    await writer.selectFrom('listing').select('id').where('id', '=', held).forNoKeyUpdate().execute();
    const report = await deriveStoredListings(worker, { [crawled.sourceId]: deriveDivarListing });
    assert.deepEqual(report.stillHeld, [held]);
    assert.deepEqual([report.derived, report.heldElsewhere], [1, 1]);
  } finally {
    await writer.rollback().execute();
  }
  assert.equal(await mileageOf(free), 90_000);
  assert.equal(await mileageOf(held), null);
});

test('a derivation the database refuses costs only the derivation: a crawl keeps its snapshot, and the command goes on', async (context) => {
  const crawled = await crawl(context);
  const refused = await listing(owner, crawled, 'gaFIX001');
  const derived = deriveDivarListing(payloadOf(REAL), new Date('2026-09-30T08:00:00Z'));
  // As the listing job does, in one transaction: the snapshot and its fetch, then a derivation whose mileage its
  // column cannot hold.
  const outcome = await worker.transaction().execute(async (trx) => {
    const snapshotId = await snapshot(trx, refused, payloadOf(REAL));
    await fetched(trx, crawled, refused, snapshotId);
    return writeDerivedListingOrRefusal(trx, refused, snapshotId, {
      ...derived,
      attributes: { ...derived.attributes, mileageKm: 3_000_000_000 },
    });
  });
  assert.deepEqual(outcome.refused, { code: '22003', constraint: undefined });
  const kept = await owner
    .selectFrom('snapshot')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('listing_id', '=', refused)
    .executeTakeFirstOrThrow();
  assert.equal(kept.count, 1);
  assert.equal(await mileageOf(refused), null);

  // The command reports a listing whose derivation a rule refuses, and derives the next one.
  const next = await listing(owner, crawled, 'gaFIX002');
  await fetched(
    owner,
    crawled,
    next,
    await snapshot(owner, next, payloadOf(realSnapshot('dealer-206-swap-installments'))),
  );
  const refusing = (payload: JsonObject, fetchedAt: Date): DerivedListing => {
    const read = deriveDivarListing(payload, fetchedAt);
    return read.attributes.sourceModelKey === 'Peugeot 206 5'
      ? { ...read, attributes: { ...read.attributes, mileageKm: 10_000_000 } }
      : read;
  };
  const report = await deriveStoredListings(worker, { [crawled.sourceId]: refusing });
  assert.deepEqual(report.refused, [
    { listingId: refused, code: '23514', constraint: 'listing_mileage_km_range' },
  ]);
  assert.equal(report.derived, 1);
  assert.equal(await mileageOf(next), 90_000);
});
