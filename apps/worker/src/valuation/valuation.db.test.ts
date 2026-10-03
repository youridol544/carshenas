import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test, type TestContext } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { createTestSource, openScratchDatabase } from '../db/test-database.ts';
import { loadComparables } from '../db/valuation-store.ts';
import { testWorkerDatabase } from '../test-support/runtime.ts';
import { fitValuation, predictLn } from './fit.ts';
import { INSTALLMENT_GUARD_GAP_PCT, WINDOW_DAYS } from './method.ts';
import { jalaliYearOf, runValuation } from './run.ts';

// The daily valuation on a scratch database, as the worker's role (CS-51 criteria 2 to 4; S01): a seeded market of one
// model is fitted and stored with its date and comparables; negotiable, instalment and placeholder prices, a dealer's
// zero-km post and an excluded condition never enter the fit; every active listing gets a rating or a reason; the SQL
// value from stored coefficients equals the worker's own, to the toman; a listing after the run is rated from the
// stored numbers; a rerun of the day replaces its run; a listing that accepts instalments and asks 20 % or more below
// its value is valued but not rated (CS-87).

const AS_OF = '2026-09-30';
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

async function catalogueModel(): Promise<{ makeId: number; modelId: number }> {
  const slug = `t-${randomBytes(4).toString('hex')}`;
  const make = await owner
    .insertInto('make')
    .values({ slug, name_en: `Test ${slug}` })
    .returning('id')
    .executeTakeFirstOrThrow();
  const model = await owner
    .insertInto('model')
    .values({ make_id: make.id, slug, name_en: `Model ${slug}` })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { makeId: make.id, modelId: model.id };
}

type Seed = {
  readonly key: string;
  readonly year: number;
  readonly mileageKm: number;
  readonly priceType?: 'asking' | 'negotiable' | 'installment' | 'placeholder';
  readonly askingPriceToman?: number;
  readonly sellerType?: 'private' | 'dealer';
  readonly bodyCondition?: 'intact' | 'accident_damaged';
  readonly matched?: boolean;
  readonly listedAt?: Date;
  /** Divar's «امکان خرید قسطی» row: true when the seller switched it on, null when the post says nothing. */
  readonly acceptsInstallments?: boolean;
};

async function seedListing(sourceId: string, catalogue: { makeId: number; modelId: number }, seed: Seed) {
  const priceType = seed.priceType ?? 'asking';
  const matched = seed.matched ?? true;
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: sourceId,
      source_listing_key: seed.key,
      url: `https://test.example/${seed.key}`,
      status: 'active',
      listed_at: seed.listedAt ?? new Date('2026-09-28T08:00:00Z'),
      last_seen_at: new Date('2026-09-30T08:00:00Z'),
      make_id: matched ? catalogue.makeId : null,
      model_id: matched ? catalogue.modelId : null,
      catalogue_match: matched ? 'model' : 'unmatched',
      model_year_written: 'sh',
      model_year_sh: seed.year,
      mileage_km: seed.mileageKm,
      gearbox: 'manual',
      fuel: 'petrol',
      body_condition: seed.bodyCondition ?? 'intact',
      seller_type: seed.sellerType ?? 'private',
      accepts_installments: seed.acceptsInstallments ?? null,
      price_type: priceType,
      asking_price_toman: priceType === 'asking' ? (seed.askingPriceToman ?? null) : null,
      down_payment_toman: priceType === 'installment' ? 300_000_000 : null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** A market priced by S01's own shape: 1.5 billion new, 6 % less a year, 5 % less per 100,000 km over the norm. */
function marketPrice(year: number, mileageKm: number, wobble: number): number {
  const age = Math.max(1405 - year, 0);
  const deviation = (mileageKm - 20_000 * Math.max(age, 0.5)) / 100_000;
  return Math.round(1_500_000_000 * Math.exp(-0.06 * age - 0.05 * deviation + wobble));
}

async function seedMarket(context: TestContext) {
  const sourceId = await createTestSource(owner, context);
  const catalogue = await catalogueModel();
  const regular: number[] = [];
  for (let i = 0; i < 30; i++) {
    const year = 1396 + (i % 10);
    const mileageKm = Math.max(1405 - year, 0.5) * 20_000 + ((i * 7) % 5) * 10_000;
    const wobble = (((i * 37) % 11) - 5) / 100;
    regular.push(
      await seedListing(sourceId, catalogue, {
        key: `m${String(i)}`,
        year,
        mileageKm,
        askingPriceToman: marketPrice(year, mileageKm, wobble),
      }),
    );
  }
  // Private zero-km cars, so a zero-km listing of this model has its own kind to compare with.
  for (let i = 0; i < 3; i++) {
    regular.push(
      await seedListing(sourceId, catalogue, {
        key: `z${String(i)}`,
        year: 1405,
        mileageKm: 0,
        askingPriceToman: Math.round(1_500_000_000 * (1.02 + i / 100)),
      }),
    );
  }
  const special = {
    negotiable: await seedListing(sourceId, catalogue, {
      key: 'neg',
      year: 1400,
      mileageKm: 100_000,
      priceType: 'negotiable',
    }),
    installment: await seedListing(sourceId, catalogue, {
      key: 'inst',
      year: 1400,
      mileageKm: 100_000,
      priceType: 'installment',
    }),
    placeholder: await seedListing(sourceId, catalogue, {
      key: 'ph',
      year: 1400,
      mileageKm: 100_000,
      priceType: 'placeholder',
    }),
    dealerNew: await seedListing(sourceId, catalogue, {
      key: 'dnew',
      year: 1405,
      mileageKm: 0,
      sellerType: 'dealer',
      askingPriceToman: 900_000_000,
    }),
    accident: await seedListing(sourceId, catalogue, {
      key: 'acc',
      year: 1400,
      mileageKm: 100_000,
      bodyCondition: 'accident_damaged',
      askingPriceToman: 700_000_000,
    }),
    unmatched: await seedListing(sourceId, catalogue, {
      key: 'unm',
      year: 1400,
      mileageKm: 100_000,
      matched: false,
      askingPriceToman: 1_000_000_000,
    }),
    // Posted after the run's day, so not a comparable, and priced with three zeros too many: rated as an outlier,
    // and the run does not fail on the gap's size.
    typo: await seedListing(sourceId, catalogue, {
      key: 'typo',
      year: 1400,
      mileageKm: 100_000,
      askingPriceToman: marketPrice(1400, 100_000, 0) * 1000,
      listedAt: new Date('2026-10-01T08:00:00Z'),
    }),
    farYear: await seedListing(sourceId, catalogue, {
      key: 'old',
      year: 1385,
      mileageKm: 400_000,
      askingPriceToman: 400_000_000,
    }),
  };
  return { sourceId, catalogue, regular, special };
}

async function valuationsOf(runId: number, listingIds: readonly number[]) {
  const rows = await owner
    .selectFrom('listing_valuation')
    .select([
      'listing_id',
      'asking_price_toman',
      'market_value_toman',
      'price_gap_pct',
      'deal_rating',
      'no_rating_reason',
    ])
    .where('valuation_run_id', '=', runId)
    .where('listing_id', 'in', listingIds)
    .execute();
  return new Map(rows.map((row) => [row.listing_id, row]));
}

test('a daily run stores its date, coefficients, segment and comparables, and rates every active listing or says why not', async (context) => {
  const { catalogue, regular, special } = await seedMarket(context);
  const summary = await runValuation(worker, AS_OF);

  const run = await owner
    .selectFrom('valuation_run')
    .select([
      'status',
      sql<string>`as_of_date::text`.as('as_of'),
      'reference_year_sh',
      'comparable_count',
      'rated_count',
    ])
    .where('id', '=', summary.runId)
    .executeTakeFirstOrThrow();
  assert.equal(run.status, 'succeeded');
  assert.equal(run.as_of, AS_OF);
  assert.equal(run.reference_year_sh, 1405);

  const segment = await owner
    .selectFrom('valuation_segment')
    .selectAll()
    .where('valuation_run_id', '=', summary.runId)
    .where('model_id', '=', catalogue.modelId)
    .executeTakeFirstOrThrow();
  assert.equal(segment.rates_listings, true);
  assert.ok(segment.comparable_count >= 30, `comparables ${String(segment.comparable_count)}`);

  // Criterion 3: negotiable, instalment and placeholder prices, a dealer's zero-km post and an excluded condition
  // never enter a market value.
  const learned = await owner
    .selectFrom('valuation_comparable')
    .select('listing_id')
    .where('valuation_run_id', '=', summary.runId)
    .where('model_id', '=', catalogue.modelId)
    .execute();
  const learnedIds = new Set(learned.map((row) => row.listing_id));
  for (const [name, id] of Object.entries(special)) {
    if (name === 'farYear' || name === 'typo') continue;
    assert.equal(learnedIds.has(id), false, `${name} entered the fit`);
  }

  // Criterion 4: a rating with a gap, or exactly one reason.
  const valuations = await valuationsOf(summary.runId, [...regular, ...Object.values(special)]);
  const reasonOf = (id: number) => valuations.get(id)?.no_rating_reason;
  assert.equal(reasonOf(special.negotiable), 'no_asking_price');
  assert.ok(
    valuations.get(special.negotiable)?.market_value_toman,
    'a negotiable listing keeps its market value',
  );
  assert.equal(reasonOf(special.installment), 'installment_price');
  assert.equal(reasonOf(special.placeholder), 'placeholder_price');
  assert.equal(reasonOf(special.dealerNew), 'dealer_new_car');
  assert.equal(reasonOf(special.accident), 'excluded_condition');
  assert.equal(valuations.get(special.accident)?.market_value_toman, null);
  assert.equal(reasonOf(special.unmatched), 'unmatched_model');
  assert.equal(reasonOf(special.typo), 'price_outlier');
  assert.equal(valuations.get(special.typo)?.price_gap_pct, null);
  // A 1385 car among 1396 to 1405 ones: no three comparables within two model years.
  assert.equal(reasonOf(special.farYear), 'year_out_of_range');
  const ratedRegular = regular.filter((id) => valuations.get(id)?.deal_rating !== null);
  assert.ok(ratedRegular.length >= 29, `rated ${String(ratedRegular.length)} of 33`);
  for (const id of ratedRegular) {
    const row = valuations.get(id);
    assert.ok(row?.price_gap_pct !== null && row?.asking_price_toman && row.market_value_toman);
  }

  // The SQL value from stored coefficients equals the worker's own prediction for the run's day, to the toman.
  const comparables = await loadComparables(worker, { asOfDate: AS_OF, windowDays: WINDOW_DAYS });
  const valuation = fitValuation(comparables, jalaliYearOf(AS_OF));
  const regularSet = new Set(regular);
  for (const comparable of comparables.filter((c) => regularSet.has(c.listingId))) {
    const stored = valuations.get(comparable.listingId)?.market_value_toman;
    if (stored === null || stored === undefined) continue;
    const ln = predictLn(
      valuation.model,
      { ...comparable, attributes: { ...comparable.attributes, daysBeforeAsOf: 0 } },
      1405,
    );
    assert.equal(stored, Math.round(Math.exp(ln ?? Number.NaN)), `listing ${String(comparable.listingId)}`);
  }

  // The comparables shown beside a rated listing: its model's nearest, never itself, their prices adjusted to it.
  const [first] = ratedRegular;
  assert.ok(first !== undefined);
  const shown = await owner
    .selectFrom('listing_valuation_comparable as s')
    .innerJoin('valuation_comparable as c', (join) =>
      join
        .onRef('c.valuation_run_id', '=', 's.valuation_run_id')
        .onRef('c.listing_id', '=', 's.comparable_listing_id'),
    )
    .select([
      's.comparable_listing_id',
      's.position',
      's.asking_price_toman',
      's.adjusted_price_toman',
      'c.fitted_value_toman',
    ])
    .where('s.valuation_run_id', '=', summary.runId)
    .where('s.listing_id', '=', first)
    .orderBy('s.position')
    .execute();
  assert.equal(shown.length, 10);
  const value = valuations.get(first)?.market_value_toman ?? 0;
  for (const row of shown) {
    assert.notEqual(row.comparable_listing_id, first);
    assert.equal(
      row.adjusted_price_toman,
      Math.round((row.asking_price_toman * value) / row.fitted_value_toman),
    );
  }
});

test('a run analyses the tables it wrote, so the rating is planned for their size (the 86-second batch of 2026-10-02)', async (context) => {
  await seedMarket(context);
  await runValuation(worker, AS_OF);
  const { rows } = await sql<{ relname: string; reltuples: number }>`
    SELECT relname::text, reltuples::float8 AS reltuples FROM pg_class
     WHERE relname IN ('valuation_coefficient', 'valuation_segment', 'valuation_comparable', 'listing_valuation')`.execute(
    owner,
  );
  assert.equal(rows.length, 4);
  // reltuples is -1 until a table has been analysed: autovacuum does not reach a scratch table this small within a test.
  for (const row of rows) assert.ok(row.reltuples > 0, `${row.relname} was not analysed`);
});

test('rating in small batches gives exactly the results of the default batch', async (context) => {
  await seedMarket(context);
  const read = async (runId: number) => {
    const valuations = await owner
      .selectFrom('listing_valuation')
      .select(['listing_id', 'market_value_toman', 'price_gap_pct', 'deal_rating', 'no_rating_reason'])
      .where('valuation_run_id', '=', runId)
      .orderBy('listing_id')
      .execute();
    const shown = await owner
      .selectFrom('listing_valuation_comparable')
      .select(['listing_id', 'comparable_listing_id', 'position', 'adjusted_price_toman'])
      .where('valuation_run_id', '=', runId)
      .orderBy('listing_id')
      .orderBy('position')
      .execute();
    return { valuations, shown };
  };
  const whole = await runValuation(worker, AS_OF);
  const expected = await read(whole.runId);
  // The same day again replaces the run: the batches of seven must write the same rows, none twice, none missed.
  const batched = await runValuation(worker, AS_OF, { ratingBatch: 7 });
  const actual = await read(batched.runId);
  assert.ok(
    expected.valuations.length >= 30 && expected.shown.length >= 100,
    'the market has rated listings',
  );
  assert.deepEqual(actual.valuations, expected.valuations);
  assert.deepEqual(actual.shown, expected.shown);
});

test('a listing that arrives after the run is valued and rated from the stored numbers alone', async (context) => {
  const { sourceId, catalogue } = await seedMarket(context);
  const { runId } = await runValuation(worker, AS_OF);
  const late = await seedListing(sourceId, catalogue, {
    key: 'late',
    year: 1401,
    mileageKm: 90_000,
    askingPriceToman: Math.round(marketPrice(1401, 90_000, 0) * 1.3),
    listedAt: new Date('2026-09-30T12:00:00Z'),
  });
  const { rows } = await sql<{ market_value_toman: number | null; deal_rating: string | null }>`
    SELECT market_value_toman, deal_rating FROM valuation_rate_listing(${runId}, ${late})`.execute(worker);
  const [rated] = rows;
  assert.ok(rated?.market_value_toman, 'valued');
  assert.equal(rated.deal_rating, 'overpriced');
});

type Outcome = {
  asking_price_toman: number | null;
  market_value_toman: number | null;
  price_gap_pct: string | null;
  deal_rating: string | null;
  no_rating_reason: string | null;
};

/** What valuation_rate_listing() says of a listing in a run: the same function the run rates every listing with. */
async function rateNow(runId: number, listingId: number): Promise<Outcome> {
  const { rows } = await sql<Outcome>`
    SELECT asking_price_toman, market_value_toman, price_gap_pct, deal_rating, no_rating_reason
      FROM valuation_rate_listing(${runId}, ${listingId})`.execute(worker);
  const [outcome] = rows;
  assert.ok(outcome, `no outcome for listing ${String(listingId)}`);
  return outcome;
}

test('a listing that accepts instalments and asks 20 % or more below its value is valued but not rated, and every other listing keeps its outcome (CS-87)', async (context) => {
  const { sourceId, catalogue } = await seedMarket(context);
  // The same car in every case, posted after the run's day so that none is a comparable: each is rated as a listing the
  // fit did not learn from, by the factor-of-three rule alone.
  const car = { year: 1401, mileageKm: 90_000, listedAt: new Date('2026-10-01T08:00:00Z') };
  const priced = (ratio: number) => Math.round(marketPrice(car.year, car.mileageKm, 0) * ratio);
  const cases = {
    // The three of the task: an instalment-accepting listing at about -45 %, one at about -15 %, a cash listing at -45 %.
    instalmentFar: await seedListing(sourceId, catalogue, {
      key: 'inst-far',
      ...car,
      askingPriceToman: priced(0.55),
      acceptsInstallments: true,
    }),
    instalmentNear: await seedListing(sourceId, catalogue, {
      key: 'inst-near',
      ...car,
      askingPriceToman: priced(0.85),
      acceptsInstallments: true,
    }),
    cashFar: await seedListing(sourceId, catalogue, {
      key: 'cash-far',
      ...car,
      askingPriceToman: priced(0.55),
    }),
    // A post that says it does not take instalments is no instalment post, and a price beyond a factor of three keeps
    // the reason it always had.
    declinedFar: await seedListing(sourceId, catalogue, {
      key: 'declined-far',
      ...car,
      askingPriceToman: priced(0.55),
      acceptsInstallments: false,
    }),
    instalmentOutlier: await seedListing(sourceId, catalogue, {
      key: 'inst-outlier',
      ...car,
      askingPriceToman: priced(0.25),
      acceptsInstallments: true,
    }),
  };
  const { runId, rated } = await runValuation(worker, AS_OF);
  const stored = await valuationsOf(runId, Object.values(cases));
  const outcome = (name: keyof typeof cases) => {
    const row = stored.get(cases[name]);
    assert.ok(row, name);
    return row;
  };

  // Valued, with the price it asked, but neither rated nor given a gap (a stored gap means a rating: search sorts on it).
  const guarded = outcome('instalmentFar');
  assert.equal(guarded.no_rating_reason, 'installment_price');
  assert.equal(guarded.deal_rating, null);
  assert.equal(guarded.price_gap_pct, null);
  assert.ok(guarded.market_value_toman, 'it keeps its market value');
  assert.equal(guarded.asking_price_toman, priced(0.55));
  // The same instalment post at about -15 % is rated as any other, and so is a cash listing at -45 %.
  for (const name of ['instalmentNear', 'cashFar', 'declinedFar'] as const) {
    const row = outcome(name);
    assert.equal(row.deal_rating, 'great', name);
    assert.equal(row.no_rating_reason, null, name);
    assert.ok(row.price_gap_pct !== null, name);
  }
  const gapOf = (name: keyof typeof cases) => Number(outcome(name).price_gap_pct);
  assert.ok(gapOf('instalmentNear') > -20 && gapOf('instalmentNear') < -10, String(gapOf('instalmentNear')));
  assert.ok(gapOf('cashFar') <= -20, String(gapOf('cashFar')));
  // The reason an instalment-accepting listing had before the rule stays: a price beyond a factor of three is an outlier.
  assert.equal(outcome('instalmentOutlier').no_rating_reason, 'price_outlier');

  // The shown comparables belong to rated listings only, and the run rated exactly the ones that carry a rating.
  const shown = await owner
    .selectFrom('listing_valuation_comparable')
    .select(['listing_id', (eb) => eb.fn.countAll<number>().as('shown')])
    .where('valuation_run_id', '=', runId)
    .where('listing_id', 'in', Object.values(cases))
    .groupBy('listing_id')
    .execute();
  assert.deepEqual(
    new Map(shown.map((row) => [row.listing_id, row.shown])),
    new Map([
      [cases.instalmentNear, 10],
      [cases.cashFar, 10],
      [cases.declinedFar, 10],
    ]),
  );
  const ratedInRun = await owner
    .selectFrom('listing_valuation')
    .select((eb) => eb.fn.countAll<number>().as('rated'))
    .where('valuation_run_id', '=', runId)
    .where('deal_rating', 'is not', null)
    .executeTakeFirstOrThrow();
  assert.equal(rated, ratedInRun.rated);

  // The daily run and a listing rated now, from the same stored numbers, agree on every case.
  for (const [name, id] of Object.entries(cases)) {
    const now = await rateNow(runId, id);
    const row = stored.get(id);
    assert.deepEqual(
      [
        now.asking_price_toman,
        now.market_value_toman,
        now.price_gap_pct,
        now.deal_rating,
        now.no_rating_reason,
      ],
      [
        row?.asking_price_toman,
        row?.market_value_toman,
        row?.price_gap_pct,
        row?.deal_rating,
        row?.no_rating_reason,
      ],
      name,
    );
  }

  // The threshold itself, on the gap as it is stored (two decimals): -20.00 % is guarded, -19.99 % is rated.
  const value = guarded.market_value_toman;
  assert.ok(value);
  const edge = async (key: string, gapPct: number) => {
    const id = await seedListing(sourceId, catalogue, {
      key,
      ...car,
      askingPriceToman: Math.round((value * (100 + gapPct)) / 100),
      acceptsInstallments: true,
    });
    return rateNow(runId, id);
  };
  const atThreshold = await edge('inst-edge', INSTALLMENT_GUARD_GAP_PCT);
  assert.equal(atThreshold.price_gap_pct, null);
  assert.equal(atThreshold.no_rating_reason, 'installment_price');
  const justAbove = await edge('inst-above', INSTALLMENT_GUARD_GAP_PCT + 0.01);
  assert.equal(justAbove.price_gap_pct, '-19.99');
  assert.equal(justAbove.deal_rating, 'great');
  assert.equal(justAbove.no_rating_reason, null);
});

test('a rerun of a day replaces its run, and a failed fit leaves a failed run', async (context) => {
  await seedMarket(context);
  const first = await runValuation(worker, AS_OF);
  const second = await runValuation(worker, AS_OF);
  assert.notEqual(first.runId, second.runId);
  const succeeded = await owner
    .selectFrom('valuation_run')
    .select('id')
    .where(sql<boolean>`as_of_date = ${AS_OF}::date`)
    .where('status', '=', 'succeeded')
    .execute();
  assert.deepEqual(
    succeeded.map((row) => row.id),
    [second.runId],
  );
  // A day before any listing was posted has nothing to learn from: the run is recorded as failed.
  await assert.rejects(runValuation(worker, '2020-01-01'), /no comparables/);
  const failed = await owner
    .selectFrom('valuation_run')
    .select('status')
    .where(sql<boolean>`as_of_date = '2020-01-01'::date`)
    .execute();
  assert.deepEqual(
    failed.map((row) => row.status),
    ['failed'],
  );
});

/** A listing whose written mileage is under the floor and was not settled by its words (CS-101). */
async function seedUnread(
  sourceId: string,
  catalogue: { makeId: number; modelId: number },
  key: string,
  year: number,
  writtenKm: number,
  askingPriceToman: number,
): Promise<number> {
  const id = await seedListing(sourceId, catalogue, { key, year, mileageKm: 0, askingPriceToman });
  await owner
    .updateTable('listing')
    .set({ mileage_km: null, mileage_written_km: writtenKm, mileage_reading: 'unread' })
    .where('id', '=', id)
    .execute();
  return id;
}

async function readingOf(listingId: number) {
  return owner
    .selectFrom('listing')
    .select(['mileage_km', 'mileage_written_km', 'mileage_reading', 'mileage_ask_ratio'])
    .where('id', '=', listingId)
    .executeTakeFirstOrThrow();
}

test('an unsettled mileage under the floor is read in thousands only when the asking price fits the car at 1,000 times the figure, and the reading is rated and kept out of the fit (CS-101)', async (context) => {
  const { sourceId, catalogue } = await seedMarket(context);
  // A 1396 car that wrote «۳۷۰» and asks what a car of 370,000 km is worth: thousands, rated as such.
  const used = await seedUnread(sourceId, catalogue, 'u-used', 1396, 370, marketPrice(1396, 370_000, 0.02));
  // The same figure and age at a price far above that of a 370,000 km car: the price does not say, so it stays unread.
  const dear = await seedUnread(sourceId, catalogue, 'u-dear', 1396, 370, marketPrice(1396, 370_000, 0) * 2);
  // A car of three years: 100 km and 100,000 km are worth within 15 % of each other, so the price cannot tell.
  const young = await seedUnread(sourceId, catalogue, 'u-young', 1402, 100, marketPrice(1402, 100_000, 0));
  // 900 thousand km on a car of five years is 180,000 km a year: not a mileage, whatever the price.
  const absurd = await seedUnread(sourceId, catalogue, 'u-absurd', 1400, 900, marketPrice(1400, 900_000, 0));
  // A written 0 has no thousands.
  const zero = await seedUnread(sourceId, catalogue, 'u-zero', 1396, 0, marketPrice(1396, 100_000, 0));
  // The text decided this one: it is a comparable like any other, and never tested.
  const byText = await seedListing(sourceId, catalogue, {
    key: 'u-text',
    year: 1392,
    mileageKm: 120_000,
    askingPriceToman: marketPrice(1392, 120_000, 0),
  });
  await owner
    .updateTable('listing')
    .set({ mileage_written_km: 120, mileage_reading: 'thousands_text', mileage_wording: '120 هزار' })
    .where('id', '=', byText)
    .execute();

  const summary = await runValuation(worker, AS_OF);
  assert.equal(summary.mileageTested, 4);
  assert.equal(summary.mileageThousands, 1);

  const read = await readingOf(used);
  assert.equal(read.mileage_reading, 'thousands_price');
  assert.equal(read.mileage_km, 370_000);
  assert.ok(Number(read.mileage_ask_ratio) > 0.8 && Number(read.mileage_ask_ratio) <= 1.15, String(read.mileage_ask_ratio));
  for (const id of [dear, young, absurd]) {
    const unread = await readingOf(id);
    assert.equal(unread.mileage_reading, 'unread');
    assert.equal(unread.mileage_km, null);
  }
  assert.ok(Number((await readingOf(dear)).mileage_ask_ratio) > 1.15);
  assert.deepEqual(await readingOf(zero), {
    mileage_km: null,
    mileage_written_km: 0,
    mileage_reading: 'unread',
    mileage_ask_ratio: null,
  });

  // It is valued and rated at the assumed mileage; the unread ones lack an attribute, as under CS-86.
  const valuations = await valuationsOf(summary.runId, [used, dear, young, absurd, zero]);
  assert.ok(valuations.get(used)?.market_value_toman, 'the thousands reading is valued');
  assert.ok(valuations.get(used)?.deal_rating, 'and rated');
  for (const id of [dear, young, absurd, zero]) assert.equal(valuations.get(id)?.no_rating_reason, 'missing_attributes');

  // The price chose the reading, so the listing never teaches the fit; the text's reading is a comparable.
  const learned = new Set(
    (
      await owner
        .selectFrom('valuation_comparable')
        .select('listing_id')
        .where('valuation_run_id', '=', summary.runId)
        .execute()
    ).map((row) => row.listing_id),
  );
  assert.equal(learned.has(used), false);
  assert.equal(learned.has(byText), true);
  assert.equal((await readingOf(byText)).mileage_reading, 'thousands_text');

  // The same data, the same decisions: a second run changes nothing.
  const again = await runValuation(worker, AS_OF);
  assert.equal(again.mileageThousands, 1);
  assert.deepEqual(await readingOf(used), read);

  // The price goes up to a near-new car's: the next run takes the reading back; a listing whose price the run can no
  // longer test is taken back too.
  await owner
    .updateTable('listing')
    .set({ asking_price_toman: marketPrice(1396, 370_000, 0) * 2 })
    .where('id', '=', used)
    .execute();
  await runValuation(worker, AS_OF);
  assert.equal((await readingOf(used)).mileage_reading, 'unread');
  assert.equal((await readingOf(used)).mileage_km, null);
  await owner
    .updateTable('listing')
    .set({ mileage_km: 370_000, mileage_reading: 'thousands_price', mileage_ask_ratio: 1 })
    .where('id', '=', used)
    .execute();
  await owner
    .updateTable('listing')
    .set({ price_type: 'negotiable', asking_price_toman: null })
    .where('id', '=', used)
    .execute();
  await runValuation(worker, AS_OF);
  assert.deepEqual(await readingOf(used), {
    mileage_km: null,
    mileage_written_km: 370,
    mileage_reading: 'unread',
    mileage_ask_ratio: null,
  });
});
