import 'server-only';
import { isCarOrigin, isCountryCode, type CarOrigin, type CountryCode } from '@carshenas/search/specs';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';
import { carNameOf } from '@/lib/crawl-requests-names';
import { MAX_SPEC_QUERY_LENGTH, SPEC_MODELS_LIMIT } from '@/lib/model-spec-rules';

// The superadmin's engine volume, origin and country of the catalogue (CS-99, CS-103, ADR-0039, ADR-0041), through the
// section's own role (ADR-0023): how much of what is listed has each value (the share of the active listings, read from
// listing_spec, the one place the inheritance is written), each model with its own row, its trims' rows, its country
// (its make's, and its own where it differs) and the latest changes, the models that miss a value first, and the makes
// that still have no country. A model is listed when it has active
// listings, or when the person searched for it by name: the catalogue has hundreds of models and a car nobody lists yet
// can be filled in before its first listing arrives. It asks for the superadmin itself (ADR-0020 point 10).

const HISTORY_PER_MODEL = 3;

export type SpecSource = 'catalogue' | 'seed' | 'superadmin';

export type SpecValues = {
  volumeCc: number | null;
  origin: CarOrigin | null;
  source: SpecSource;
  /** The superadmin's username; null for the catalogue's and the seed's own rows. */
  setBy: string | null;
  setAt: string;
};

export type SpecChange = {
  action: 'seeded' | 'added' | 'changed' | 'removed';
  /** The trim's name, or null for the model itself. */
  scope: string | null;
  fromVolumeCc: number | null;
  fromOrigin: CarOrigin | null;
  toVolumeCc: number | null;
  toOrigin: CarOrigin | null;
  by: string | null;
  at: string;
};

export type CountryRow = {
  country: CountryCode;
  source: 'seed' | 'superadmin';
  setBy: string | null;
  setAt: string;
};

export type CountryChange = {
  action: 'seeded' | 'added' | 'changed' | 'removed';
  /** `make`: the brand's country; `model`: this model's own. */
  scope: 'make' | 'model';
  fromCountry: CountryCode | null;
  toCountry: CountryCode | null;
  by: string | null;
  at: string;
};

export type MissingCountry = { makeId: number; name: string; active: number };

export type TrimSpec = {
  id: number;
  name: string;
  active: number;
  spec: SpecValues | null;
};

export type SpecModel = {
  modelId: number;
  /** make.model, the row's key on the page. */
  key: string;
  carName: string;
  tracked: boolean;
  makeId: number;
  makeName: string;
  active: number;
  /** Active listings whose volume is known (their own, their trim's or their model's). */
  withVolume: number;
  withOrigin: number;
  withCountry: number;
  spec: SpecValues | null;
  /** The make's country row, and this model's own where it corrects the make's. */
  makeCountry: CountryRow | null;
  modelCountry: CountryRow | null;
  trims: TrimSpec[];
  history: SpecChange[];
  countryHistory: CountryChange[];
};

export type SpecCoverage = {
  active: number;
  withVolume: number;
  withOrigin: number;
  withCountry: number;
  /** Of the listings with a volume: the listing's own title, its trim's row, its model's row (ADR-0039). */
  bySource: { listing: number; trim: number; model: number };
  /** Models with active listings that miss a volume or an origin on some listing. */
  modelsMissing: number;
};

export type AdminModelSpecs = {
  coverage: SpecCoverage;
  models: SpecModel[];
  /** The makes with no country, the most listed first (a few), and how many there are in all. */
  makesWithoutCountry: MissingCountry[];
  makesWithoutCountryTotal: number;
  query: string;
};

/** The search text from the address: one line, bounded, never trusted. */
export function readSpecQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_SPEC_QUERY_LENGTH);
}

/** LIKE's wildcard for any run of characters, built here so no percent sign is written by hand beside a number. */
const ANY_TEXT = String.fromCharCode(0x25);

function likeEscaped(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function originOf(value: string | null): CarOrigin | null {
  return value !== null && isCarOrigin(value) ? value : null;
}

function countryOf(value: string | null): CountryCode | null {
  return value !== null && isCountryCode(value) ? value : null;
}

const MISSING_COUNTRY_LIMIT = 12;

export async function loadModelSpecs(query: string): Promise<AdminModelSpecs> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  const pattern = query === '' ? null : `${ANY_TEXT}${likeEscaped(query)}${ANY_TEXT}`;

  const [coverageRow, perModel, missingMakes, missingMakesTotal] = await Promise.all([
    // Every active listing with the volume, origin and country it is given, as listing_spec says.
    database
      .selectFrom('listing as l')
      .innerJoin('listing_spec as sp', 'sp.listing_id', 'l.id')
      .select((eb) => [
        eb.fn.countAll<number>().as('active'),
        eb.fn.count<number>('sp.engine_volume_cc').as('with_volume'),
        eb.fn.count<number>('sp.car_origin').as('with_origin'),
        eb.fn.count<number>('sp.country').as('with_country'),
        eb.fn
          .count<number>('sp.engine_volume_cc')
          .filterWhere('sp.engine_volume_source', '=', 'listing')
          .as('from_listing'),
        eb.fn
          .count<number>('sp.engine_volume_cc')
          .filterWhere('sp.engine_volume_source', '=', 'trim')
          .as('from_trim'),
        eb.fn
          .count<number>('sp.engine_volume_cc')
          .filterWhere('sp.engine_volume_source', '=', 'model')
          .as('from_model'),
      ])
      .where('l.status', '=', 'active')
      .executeTakeFirstOrThrow(),
    // The models with listings, or matching the search, with how many of their listings have each value.
    database
      .selectFrom('model as m')
      .innerJoin('make as k', 'k.id', 'm.make_id')
      .leftJoin('listing as l', (join) => join.onRef('l.model_id', '=', 'm.id').on('l.status', '=', 'active'))
      .leftJoin('listing_spec as sp', 'sp.listing_id', 'l.id')
      .select((eb) => [
        'm.id',
        'm.slug',
        'k.id as make_id',
        'k.slug as make_slug',
        'm.name_fa as model_fa',
        'm.name_en as model_en',
        'k.name_fa as make_fa',
        'k.name_en as make_en',
        eb.fn.count<number>('l.id').as('active'),
        eb.fn.count<number>('sp.engine_volume_cc').as('with_volume'),
        eb.fn.count<number>('sp.car_origin').as('with_origin'),
        eb.fn.count<number>('sp.country').as('with_country'),
      ])
      .$if(pattern === null, (builder) =>
        builder.where((eb) =>
          eb.exists(
            eb
              .selectFrom('listing as a')
              .select('a.id')
              .whereRef('a.model_id', '=', 'm.id')
              .where('a.status', '=', 'active'),
          ),
        ),
      )
      .$if(pattern !== null, (builder) =>
        builder.where((eb) =>
          eb.or([
            eb('m.name_en', 'ilike', pattern ?? ''),
            eb('m.name_fa', 'ilike', pattern ?? ''),
            eb('m.slug', 'ilike', pattern ?? ''),
            eb('k.name_en', 'ilike', pattern ?? ''),
            eb('k.name_fa', 'ilike', pattern ?? ''),
            eb('k.slug', 'ilike', pattern ?? ''),
          ]),
        ),
      )
      .groupBy(['m.id', 'm.slug', 'k.id', 'k.slug', 'm.name_fa', 'm.name_en', 'k.name_fa', 'k.name_en'])
      .execute(),
    // The makes with no country of their own, those with listings first.
    database
      .selectFrom('make as k')
      .leftJoin('listing as l', (join) => join.onRef('l.make_id', '=', 'k.id').on('l.status', '=', 'active'))
      .select((eb) => ['k.id', 'k.slug', 'k.name_fa', 'k.name_en', eb.fn.count<number>('l.id').as('active')])
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('country_spec as c')
              .select('c.id')
              .whereRef('c.make_id', '=', 'k.id')
              .where('c.model_id', 'is', null),
          ),
        ),
      )
      .groupBy(['k.id', 'k.slug', 'k.name_fa', 'k.name_en'])
      .orderBy('active', 'desc')
      .orderBy('k.slug')
      .limit(MISSING_COUNTRY_LIMIT)
      .execute(),
    database
      .selectFrom('make as k')
      .select((eb) => eb.fn.countAll<number>().as('total'))
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('country_spec as c')
              .select('c.id')
              .whereRef('c.make_id', '=', 'k.id')
              .where('c.model_id', 'is', null),
          ),
        ),
      )
      .executeTakeFirstOrThrow(),
  ]);

  const ranked = perModel
    .map((row) => ({
      ...row,
      missing:
        row.active - row.with_volume + (row.active - row.with_origin) + (row.active - row.with_country),
    }))
    .sort((a, b) =>
      query === ''
        ? b.missing - a.missing || b.active - a.active || a.id - b.id
        : b.active - a.active || a.id - b.id,
    );
  const modelsMissing = ranked.filter((row) => row.missing > 0).length;
  const shown = ranked.slice(0, SPEC_MODELS_LIMIT);
  const ids = shown.map((row) => row.id);
  const makeIds = [...new Set(shown.map((row) => row.make_id))];

  const [specRows, trimRows, trimActiveRows, changeRows, trackedRows, countryRows, countryChangeRows] =
    ids.length === 0
      ? [[], [], [], [], [], [], []]
      : await Promise.all([
          database
            .selectFrom('model_spec as s')
            .leftJoin('account as who', 'who.id', 's.set_by_account_id')
            .select([
              's.model_id',
              's.trim_id',
              's.engine_volume_cc',
              's.car_origin',
              's.source',
              's.set_at',
              'who.username as set_by',
            ])
            .where('s.model_id', 'in', ids)
            .execute(),
          database
            .selectFrom('trim as t')
            .select(['t.id', 't.model_id', 't.name_fa', 't.name_en'])
            .where('t.model_id', 'in', ids)
            .orderBy('t.name_en')
            .execute(),
          database
            .selectFrom('listing as l')
            .select((eb) => ['l.trim_id', eb.fn.countAll<number>().as('active')])
            .where('l.status', '=', 'active')
            .where('l.model_id', 'in', ids)
            .where('l.trim_id', 'is not', null)
            .groupBy('l.trim_id')
            .execute(),
          database
            .selectFrom('model_spec_change as c')
            .leftJoin('trim as tr', 'tr.id', 'c.trim_id')
            .leftJoin('account as who', 'who.id', 'c.by_account_id')
            .select([
              'c.model_id',
              'c.action',
              'c.from_volume_cc',
              'c.from_origin',
              'c.to_volume_cc',
              'c.to_origin',
              'c.changed_at',
              'tr.name_fa as trim_fa',
              'tr.name_en as trim_en',
              'who.username as by',
            ])
            .where('c.model_id', 'in', ids)
            .orderBy('c.changed_at', 'desc')
            .orderBy('c.id', 'desc')
            .limit(ids.length * 12)
            .execute(),
          database
            .selectFrom('tracked_model as t')
            .select('t.model_id')
            .where('t.model_id', 'in', ids)
            .execute(),
          database
            .selectFrom('country_spec as c')
            .leftJoin('account as who', 'who.id', 'c.set_by_account_id')
            .select([
              'c.make_id',
              'c.model_id',
              'c.country',
              'c.source',
              'c.set_at',
              'who.username as set_by',
            ])
            .where('c.make_id', 'in', makeIds)
            .execute(),
          database
            .selectFrom('country_spec_change as c')
            .leftJoin('account as who', 'who.id', 'c.by_account_id')
            .select([
              'c.make_id',
              'c.model_id',
              'c.action',
              'c.from_country',
              'c.to_country',
              'c.changed_at',
              'who.username as by',
            ])
            .where('c.make_id', 'in', makeIds)
            .orderBy('c.changed_at', 'desc')
            .orderBy('c.id', 'desc')
            .limit(makeIds.length * 12)
            .execute(),
        ]);

  const valuesOf = (row: (typeof specRows)[number]): SpecValues => ({
    volumeCc: row.engine_volume_cc,
    origin: originOf(row.car_origin),
    source: row.source,
    setBy: row.set_by,
    setAt: row.set_at.toISOString(),
  });
  const modelSpec = new Map<number, SpecValues>();
  const trimSpec = new Map<number, SpecValues>();
  for (const row of specRows) {
    if (row.trim_id === null) modelSpec.set(row.model_id, valuesOf(row));
    else trimSpec.set(row.trim_id, valuesOf(row));
  }
  const activeOfTrim = new Map(trimActiveRows.map((row) => [row.trim_id, row.active]));
  const trimsOf = new Map<number, TrimSpec[]>();
  for (const trim of trimRows) {
    const list = trimsOf.get(trim.model_id) ?? [];
    list.push({
      id: trim.id,
      name: carNameOf({
        makeFa: null,
        makeEn: '',
        modelFa: null,
        modelEn: '',
        trimFa: trim.name_fa,
        trimEn: trim.name_en,
      }),
      active: activeOfTrim.get(trim.id) ?? 0,
      spec: trimSpec.get(trim.id) ?? null,
    });
    trimsOf.set(trim.model_id, list);
  }
  const historyOf = new Map<number, SpecChange[]>();
  for (const row of changeRows) {
    const list = historyOf.get(row.model_id) ?? [];
    if (list.length >= HISTORY_PER_MODEL) continue;
    list.push({
      action: row.action,
      scope:
        row.trim_fa === null && row.trim_en === null
          ? null
          : carNameOf({
              makeFa: null,
              makeEn: '',
              modelFa: null,
              modelEn: '',
              trimFa: row.trim_fa,
              trimEn: row.trim_en,
            }),
      fromVolumeCc: row.from_volume_cc,
      fromOrigin: originOf(row.from_origin),
      toVolumeCc: row.to_volume_cc,
      toOrigin: originOf(row.to_origin),
      by: row.by,
      at: row.changed_at.toISOString(),
    });
    historyOf.set(row.model_id, list);
  }
  const countryRowOf = (row: (typeof countryRows)[number]): CountryRow | null => {
    const country = countryOf(row.country);
    return country === null
      ? null
      : { country, source: row.source, setBy: row.set_by, setAt: row.set_at.toISOString() };
  };
  const makeCountry = new Map<number, CountryRow>();
  const modelCountry = new Map<number, CountryRow>();
  for (const row of countryRows) {
    const found = countryRowOf(row);
    if (found === null) continue;
    if (row.model_id === null) makeCountry.set(row.make_id, found);
    else modelCountry.set(row.model_id, found);
  }
  const countryHistoryOf = new Map<number, CountryChange[]>();
  for (const row of countryChangeRows) {
    // A make's changes belong to every one of its models shown; a model's to that model.
    for (const model of shown) {
      if (model.make_id !== row.make_id || (row.model_id !== null && row.model_id !== model.id)) continue;
      const list = countryHistoryOf.get(model.id) ?? [];
      if (list.length >= HISTORY_PER_MODEL) continue;
      list.push({
        action: row.action,
        scope: row.model_id === null ? 'make' : 'model',
        fromCountry: countryOf(row.from_country),
        toCountry: countryOf(row.to_country),
        by: row.by,
        at: row.changed_at.toISOString(),
      });
      countryHistoryOf.set(model.id, list);
    }
  }
  const trackedModels = new Set(trackedRows.map((row) => row.model_id));

  return {
    coverage: {
      active: coverageRow.active,
      withVolume: coverageRow.with_volume,
      withOrigin: coverageRow.with_origin,
      withCountry: coverageRow.with_country,
      bySource: {
        listing: coverageRow.from_listing,
        trim: coverageRow.from_trim,
        model: coverageRow.from_model,
      },
      modelsMissing,
    },
    models: shown.map((row): SpecModel => ({
      modelId: row.id,
      key: `${row.make_slug}.${row.slug}`,
      carName: carNameOf({
        makeFa: row.make_fa,
        makeEn: row.make_en,
        modelFa: row.model_fa,
        modelEn: row.model_en,
      }),
      tracked: trackedModels.has(row.id),
      makeId: row.make_id,
      makeName: carNameOf({
        makeFa: row.make_fa,
        makeEn: row.make_en,
        modelFa: row.make_fa,
        modelEn: row.make_en,
      }),
      active: row.active,
      withVolume: row.with_volume,
      withOrigin: row.with_origin,
      withCountry: row.with_country,
      spec: modelSpec.get(row.id) ?? null,
      makeCountry: makeCountry.get(row.make_id) ?? null,
      modelCountry: modelCountry.get(row.id) ?? null,
      trims: trimsOf.get(row.id) ?? [],
      history: historyOf.get(row.id) ?? [],
      countryHistory: countryHistoryOf.get(row.id) ?? [],
    })),
    makesWithoutCountry: missingMakes.map((row) => ({
      makeId: row.id,
      name: carNameOf({
        makeFa: row.name_fa,
        makeEn: row.name_en,
        modelFa: row.name_fa,
        modelEn: row.name_en,
      }),
      active: row.active,
    })),
    makesWithoutCountryTotal: missingMakesTotal.total,
    query,
  };
}
