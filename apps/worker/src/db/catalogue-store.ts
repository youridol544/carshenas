import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { TRACKED_MODEL_ALIASES } from '../catalogue/aliases.ts';
import { placeDivarKey, slugOf } from '../catalogue/catalogue.ts';
import { BODY_TYPES, COLOURS } from '../catalogue/codes.ts';
import { DIVAR_MAKES, TRIM_BODY_TYPES } from '../catalogue/divar-catalogue.ts';
import { TRACKED_MODELS } from '../sources/divar/tracked-models.ts';

// The catalogue in the database (CS-50; docs/design/data-model.md, section 3): upserted from the curated files, grown
// by what the listings' keys name, named in Persian by what the posts say, and matched to every listing. A make, model
// or trim is found by the source's own key (catalogue_source_key), never by its slug: a slug is given once, when its
// row is made, and never moves. Everything that writes the catalogue runs in one transaction under one advisory lock,
// so the job and `pnpm catalogue:sync` never race, and a crash leaves no model without its key.

type Executor = Kysely<DB>;

/** The advisory lock every catalogue refresh holds for its transaction. */
const CATALOGUE_LOCK = 'carshenas.catalogue';

/** The code tables, from the one list the parser reads too. */
export async function syncCodes(db: Executor): Promise<void> {
  for (const [index, type] of BODY_TYPES.entries()) {
    await sql`
      INSERT INTO body_type (code, label_fa, position) VALUES (${type.code}, ${type.labelFa}, ${index + 1})
      ON CONFLICT ON CONSTRAINT body_type_pkey DO UPDATE SET label_fa = excluded.label_fa, position = excluded.position
      WHERE (body_type.label_fa, body_type.position) IS DISTINCT FROM (excluded.label_fa, excluded.position)`.execute(
      db,
    );
  }
  for (const colour of COLOURS) {
    await sql`
      INSERT INTO colour (code, label_fa, family) VALUES (${colour.code}, ${colour.labelFa}, ${colour.family})
      ON CONFLICT ON CONSTRAINT colour_pkey DO UPDATE SET label_fa = excluded.label_fa, family = excluded.family
      WHERE (colour.label_fa, colour.family) IS DISTINCT FROM (excluded.label_fa, excluded.family)`.execute(
      db,
    );
  }
}

type KnownKey =
  | { readonly level: 'make'; readonly makeId: number }
  | { readonly level: 'model'; readonly makeId: number; readonly modelId: number }
  | { readonly level: 'trim'; readonly makeId: number; readonly modelId: number; readonly trimId: number };

/** What one refresh knows, read once and kept up to date as it writes: the source's keys and the slugs taken. */
type Catalogue = {
  readonly db: Executor;
  readonly sourceId: string;
  readonly keys: Map<string, KnownKey>;
  readonly slugs: Map<string, Set<string>>;
};

async function openCatalogue(db: Executor, sourceId: string): Promise<Catalogue> {
  const rows = await db
    .selectFrom('catalogue_source_key')
    .select(['source_model_key', 'level', 'make_id', 'model_id', 'trim_id'])
    .where('source_id', '=', sourceId)
    .execute();
  const keys = new Map<string, KnownKey>();
  for (const row of rows) {
    if (row.level === 'make') keys.set(row.source_model_key, { level: 'make', makeId: row.make_id });
    else if (row.level === 'model' && row.model_id !== null)
      keys.set(row.source_model_key, { level: 'model', makeId: row.make_id, modelId: row.model_id });
    else if (row.level === 'trim' && row.model_id !== null && row.trim_id !== null)
      keys.set(row.source_model_key, {
        level: 'trim',
        makeId: row.make_id,
        modelId: row.model_id,
        trimId: row.trim_id,
      });
  }
  return { db, sourceId, keys, slugs: new Map() };
}

/** A slug not taken under the parent (every make shares one parent): the base, or the base with -2, -3 … */
async function freeSlug(
  catalogue: Catalogue,
  table: 'make' | 'model' | 'trim',
  parentId: number | null,
  base: string,
): Promise<string> {
  const scope = `${table}:${String(parentId)}`;
  let taken = catalogue.slugs.get(scope);
  if (taken === undefined) {
    const { db } = catalogue;
    const rows =
      table === 'make'
        ? await db.selectFrom('make').select('slug').execute()
        : table === 'model'
          ? await db
              .selectFrom('model')
              .select('slug')
              .where('make_id', '=', parentId ?? 0)
              .execute()
          : await db
              .selectFrom('trim')
              .select('slug')
              .where('model_id', '=', parentId ?? 0)
              .execute();
    taken = new Set(rows.map((row) => row.slug));
    catalogue.slugs.set(scope, taken);
  }
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${String(n)}`;
  taken.add(slug);
  return slug;
}

async function addSourceKey(catalogue: Catalogue, key: string, target: KnownKey): Promise<void> {
  await catalogue.db
    .insertInto('catalogue_source_key')
    .values({
      source_id: catalogue.sourceId,
      source_model_key: key,
      level: target.level,
      make_id: target.makeId,
      model_id: target.level === 'make' ? null : target.modelId,
      trim_id: target.level === 'trim' ? target.trimId : null,
    })
    .execute();
  catalogue.keys.set(key, target);
}

/** The make a key names, made with its source key the first time; a curated Persian name wins over none. */
async function makeFor(catalogue: Catalogue, key: string, nameFa: string | null): Promise<number> {
  const known = catalogue.keys.get(key);
  if (known !== undefined) {
    await sql`
      UPDATE make SET name_en = ${key}, name_fa = coalesce(${nameFa}, name_fa)
      WHERE id = ${known.makeId} AND (name_en, name_fa) IS DISTINCT FROM (${key}, coalesce(${nameFa}, name_fa))`.execute(
      catalogue.db,
    );
    return known.makeId;
  }
  const slug = await freeSlug(catalogue, 'make', null, slugOf(key, 'make'));
  const made = await catalogue.db
    .insertInto('make')
    .values({ slug, name_en: key, name_fa: nameFa })
    .returning('id')
    .executeTakeFirstOrThrow();
  await addSourceKey(catalogue, key, { level: 'make', makeId: made.id });
  return made.id;
}

/**
 * The model a key names, made with its source key the first time. A curated body type wins; null (unclassified)
 * leaves a person's choice alone.
 */
async function modelFor(
  catalogue: Catalogue,
  makeId: number,
  key: string,
  rest: string,
  bodyType: string | null,
): Promise<number> {
  const known = catalogue.keys.get(key);
  if (known !== undefined && known.level !== 'make') {
    await sql`
      UPDATE model SET name_en = ${key}, body_type = coalesce(${bodyType}, body_type)
      WHERE id = ${known.modelId}
        AND (name_en, body_type) IS DISTINCT FROM (${key}, coalesce(${bodyType}, body_type))`.execute(
      catalogue.db,
    );
    return known.modelId;
  }
  const slug = await freeSlug(catalogue, 'model', makeId, slugOf(rest, 'model'));
  const made = await catalogue.db
    .insertInto('model')
    .values({ make_id: makeId, slug, name_en: key, body_type: bodyType })
    .returning('id')
    .executeTakeFirstOrThrow();
  await addSourceKey(catalogue, key, { level: 'model', makeId, modelId: made.id });
  return made.id;
}

type AliasTarget = { makeId?: number; modelId?: number; trimId?: number };

/** An alias, unless the same one is there: looked for first, so a repeated refresh spends no identity values. */
async function addAlias(
  db: Executor,
  target: AliasTarget,
  alias: string,
  script: 'fa' | 'latin' | 'spelled',
  status: 'curated' | 'suggested',
  sourceId: string | null,
): Promise<void> {
  const makeId = target.makeId ?? null;
  const modelId = target.modelId ?? null;
  const trimId = target.trimId ?? null;
  await sql`
    INSERT INTO catalogue_alias (make_id, model_id, trim_id, alias, script, status, source_id)
    SELECT ${makeId}::bigint, ${modelId}::bigint, ${trimId}::bigint, ${alias}, ${script}, ${status}, ${sourceId}
    WHERE NOT EXISTS (
      SELECT FROM catalogue_alias a
      WHERE a.alias_norm = fa_normalize(${alias})
        AND (a.make_id, a.model_id, a.trim_id, a.source_id)
            IS NOT DISTINCT FROM (${makeId}::bigint, ${modelId}::bigint, ${trimId}::bigint, ${sourceId}::text))
    ON CONFLICT ON CONSTRAINT catalogue_alias_unique DO NOTHING`.execute(db);
}

export type CatalogueCounts = {
  readonly makes: number;
  readonly models: number;
  readonly trimsLearned: number;
  readonly modelsLearned: number;
  readonly named: number;
};

/**
 * Brings Divar's catalogue up to date in one transaction under the catalogue's lock: with `curated`, the curated makes,
 * models, Persian names and aliases (criterion 3; they change only with the code); then every key the source's listings
 * carry that the catalogue does not know, placed as a trim under its model or as a model of its own under its make
 * (learned: its body type waits for a person); the curated trim body types; and Persian names from the posts.
 */
export async function refreshDivarCatalogue(
  db: Executor,
  sourceId: string,
  options: { readonly curated: boolean },
): Promise<CatalogueCounts> {
  return db.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext(${CATALOGUE_LOCK}))`.execute(trx);
    const catalogue = await openCatalogue(trx, sourceId);
    const curated = options.curated ? await syncCurated(catalogue) : { makes: 0, models: 0 };
    const learned = await learnDivarKeys(catalogue);
    await applyTrimBodyTypes(catalogue);
    const named = await suggestDivarNames(trx, sourceId);
    return { ...curated, ...learned, named };
  });
}

async function syncCurated(catalogue: Catalogue): Promise<{ makes: number; models: number }> {
  const { db } = catalogue;
  let makes = 0;
  let models = 0;
  for (const [makeKey, make] of Object.entries(DIVAR_MAKES)) {
    const makeId = await makeFor(catalogue, makeKey, make.nameFa);
    makes += 1;
    await addAlias(db, { makeId }, makeKey, 'latin', 'curated', null);
    if (make.nameFa !== null) await addAlias(db, { makeId }, make.nameFa, 'fa', 'curated', null);
    for (const [rest, bodyType] of Object.entries(make.models)) {
      await modelFor(catalogue, makeId, `${makeKey} ${rest}`, rest, bodyType);
      models += 1;
    }
  }
  // A tracked model's Persian name is the one the crawl already shows for it; a person's own name stays.
  for (const tracked of TRACKED_MODELS) {
    const known = catalogue.keys.get(tracked.brandModel);
    if (known?.level !== 'model')
      throw new Error(`the tracked model ${tracked.brandModel} is not in the catalogue`);
    await db
      .updateTable('model')
      .set({ name_fa: tracked.nameFa })
      .where('id', '=', known.modelId)
      .where('name_fa', 'is', null)
      .execute();
  }
  for (const [key, aliases] of Object.entries(TRACKED_MODEL_ALIASES)) {
    const known = catalogue.keys.get(key);
    if (known?.level !== 'model')
      throw new Error(`a tracked model's aliases name ${key}, which is not a model`);
    for (const alias of aliases)
      await addAlias(db, { modelId: known.modelId }, alias.alias, alias.script, 'curated', null);
  }
  return { makes, models };
}

/** The keys this source's listings carry that no catalogue_source_key names yet. */
async function unknownKeys(db: Executor, sourceId: string): Promise<string[]> {
  const { rows } = await sql<{ key: string }>`
    SELECT DISTINCT l.source_model_key AS key
    FROM listing l
    WHERE l.source_id = ${sourceId} AND l.source_model_key IS NOT NULL
      AND NOT EXISTS (
        SELECT FROM catalogue_source_key k WHERE k.source_id = l.source_id AND k.source_model_key = l.source_model_key)
    ORDER BY 1`.execute(db);
  return rows.map((row) => row.key);
}

async function learnDivarKeys(
  catalogue: Catalogue,
): Promise<{ trimsLearned: number; modelsLearned: number }> {
  const keys = await unknownKeys(catalogue.db, catalogue.sourceId);
  if (keys.length === 0) return { trimsLearned: 0, modelsLearned: 0 };
  const modelsByMake = new Map<string, string[]>();
  const makeKeyById = new Map<number, string>();
  for (const [key, known] of catalogue.keys) if (known.level === 'make') makeKeyById.set(known.makeId, key);
  for (const [key, known] of catalogue.keys) {
    const makeKey = known.level === 'model' ? makeKeyById.get(known.makeId) : undefined;
    if (makeKey !== undefined) modelsByMake.set(makeKey, [...(modelsByMake.get(makeKey) ?? []), key]);
  }
  let trimsLearned = 0;
  let modelsLearned = 0;
  // Models first, so a trim whose model is learned in the same run finds it.
  for (const key of keys) {
    const place = placeDivarKey(key, modelsByMake);
    const make = place === undefined ? undefined : catalogue.keys.get(place.make);
    if (place?.level !== 'model' || make === undefined) continue;
    await modelFor(catalogue, make.makeId, place.model, place.model.slice(place.make.length + 1), null);
    modelsByMake.set(place.make, [...(modelsByMake.get(place.make) ?? []), place.model]);
    modelsLearned += 1;
  }
  for (const key of keys) {
    const place = placeDivarKey(key, modelsByMake);
    if (place?.level !== 'trim') continue;
    const model = catalogue.keys.get(place.model);
    if (model?.level !== 'model') continue;
    const slug = await freeSlug(
      catalogue,
      'trim',
      model.modelId,
      slugOf(place.trim.slice(place.model.length + 1), 'trim'),
    );
    const made = await catalogue.db
      .insertInto('trim')
      .values({ model_id: model.modelId, slug, name_en: place.trim })
      .returning('id')
      .executeTakeFirstOrThrow();
    await addSourceKey(catalogue, key, {
      level: 'trim',
      makeId: model.makeId,
      modelId: model.modelId,
      trimId: made.id,
    });
    trimsLearned += 1;
  }
  return { trimsLearned, modelsLearned };
}

/** Sets the curated body type of every trim that differs from its model (TRIM_BODY_TYPES); a person's choice stays. */
async function applyTrimBodyTypes(catalogue: Catalogue): Promise<void> {
  for (const rule of TRIM_BODY_TYPES) {
    const model = catalogue.keys.get(rule.model);
    if (model?.level !== 'model') continue;
    for (const [key, known] of catalogue.keys) {
      if (known.level !== 'trim' || known.modelId !== model.modelId) continue;
      if (!rule.trimWord.test(key.slice(rule.model.length + 1))) continue;
      await catalogue.db
        .updateTable('trim')
        .set({ body_type: rule.bodyType })
        .where('id', '=', known.trimId)
        .where('body_type', 'is', null)
        .execute();
    }
  }
}

/**
 * Persian names from what the source's own posts call each key that has none yet (Divar's «برند و مدل» row), the most
 * common wording per key: set on the trim or model, and kept as a suggested alias (the owner's decision of 2026-09-30).
 * Only the posts of unnamed keys are read, so the work shrinks as names are set. Returns how many names were set.
 */
async function suggestDivarNames(db: Executor, sourceId: string): Promise<number> {
  const { rows } = await sql<{
    level: 'model' | 'trim';
    model_id: number;
    trim_id: number | null;
    name: string;
  }>`
    WITH unnamed AS (
      SELECT k.source_model_key AS key, k.level, k.model_id, k.trim_id
      FROM catalogue_source_key k
      LEFT JOIN trim t ON t.id = k.trim_id
      LEFT JOIN model m ON m.id = k.model_id
      WHERE k.source_id = ${sourceId}
        AND ((k.level = 'trim' AND t.name_fa IS NULL) OR (k.level = 'model' AND m.name_fa IS NULL))
    ), stated AS (
      SELECT u.key, btrim(w -> 'data' ->> 'value') AS name, count(*) AS n
      FROM unnamed u
      JOIN listing l ON l.source_id = ${sourceId} AND l.source_model_key = u.key
      JOIN LATERAL (
        SELECT s.payload FROM snapshot s WHERE s.listing_id = l.id ORDER BY s.first_fetched_at DESC LIMIT 1
      ) latest ON true
      CROSS JOIN LATERAL jsonb_array_elements(latest.payload -> 'sections') sec
      CROSS JOIN LATERAL jsonb_array_elements(sec -> 'widgets') w
      WHERE w -> 'data' ->> 'title' = 'برند و مدل' AND btrim(w -> 'data' ->> 'value') <> ''
      GROUP BY 1, 2
    )
    SELECT DISTINCT ON (u.key) u.level, u.model_id, u.trim_id, s.name
    FROM stated s JOIN unnamed u ON u.key = s.key
    ORDER BY u.key, s.n DESC, s.name`.execute(db);
  let named = 0;
  for (const row of rows) {
    if (row.level === 'trim' && row.trim_id !== null) {
      await db.updateTable('trim').set({ name_fa: row.name }).where('id', '=', row.trim_id).execute();
      await addAlias(db, { trimId: row.trim_id }, row.name, 'fa', 'suggested', sourceId);
    } else {
      await db.updateTable('model').set({ name_fa: row.name }).where('id', '=', row.model_id).execute();
      await addAlias(db, { modelId: row.model_id }, row.name, 'fa', 'suggested', sourceId);
    }
    named += 1;
  }
  return named;
}

/**
 * Sets every listing's make, model, trim and catalogue_match from its source_model_key (criterion 1): trim or model
 * when its key names one, unmatched otherwise (no key, a key the catalogue does not know, or one that names only a
 * make); never a guess. Only listings whose match changes are written, locked in id order and skipping any a crawl
 * job holds (the next run matches them), so it never deadlocks with a sweep. Returns how many.
 */
export async function matchListings(db: Executor): Promise<number> {
  const result = await sql`
    WITH target AS (
      SELECT l.id,
             CASE k.level WHEN 'trim' THEN 'trim' WHEN 'model' THEN 'model' ELSE 'unmatched' END AS match,
             CASE WHEN k.level IN ('trim', 'model') THEN k.make_id END AS make_id,
             CASE WHEN k.level IN ('trim', 'model') THEN k.model_id END AS model_id,
             CASE WHEN k.level = 'trim' THEN k.trim_id END AS trim_id
      FROM listing l
      LEFT JOIN catalogue_source_key k
        ON k.source_id = l.source_id AND k.source_model_key = l.source_model_key
      WHERE (l.catalogue_match, l.make_id, l.model_id, l.trim_id) IS DISTINCT FROM (
        CASE k.level WHEN 'trim' THEN 'trim' WHEN 'model' THEN 'model' ELSE 'unmatched' END,
        CASE WHEN k.level IN ('trim', 'model') THEN k.make_id END,
        CASE WHEN k.level IN ('trim', 'model') THEN k.model_id END,
        CASE WHEN k.level = 'trim' THEN k.trim_id END)
      ORDER BY l.id
      FOR UPDATE OF l SKIP LOCKED
    )
    UPDATE listing l
    SET catalogue_match = t.match, make_id = t.make_id, model_id = t.model_id, trim_id = t.trim_id
    FROM target t
    WHERE l.id = t.id`.execute(db);
  return Number(result.numAffectedRows ?? 0);
}

export type MatchShare = {
  /** A tracked model's Divar key, or null for the whole source. */
  readonly scope: string | null;
  readonly listings: number;
  readonly trim: number;
  readonly model: number;
  readonly unmatched: number;
};

/**
 * The matched share (criterion 2): for the whole source and for each tracked model (its listings and its trims'), how
 * many listings are matched to a trim, to the model only, or not at all. A tracked model's listings are those whose key
 * is the model's or starts with it, so an unmatched one is counted where it belongs.
 */
export async function matchShares(
  db: Executor,
  sourceId: string,
  trackedKeys: readonly string[],
): Promise<MatchShare[]> {
  const { rows } = await sql<{
    scope: string | null;
    listings: string;
    trim: string;
    model: string;
    unmatched: string;
  }>`
    SELECT s.scope, count(l.id) AS listings,
           count(l.id) FILTER (WHERE l.catalogue_match = 'trim') AS trim,
           count(l.id) FILTER (WHERE l.catalogue_match = 'model') AS model,
           count(l.id) FILTER (WHERE l.catalogue_match = 'unmatched' OR l.catalogue_match IS NULL) AS unmatched
    FROM (SELECT NULL::text AS scope UNION ALL SELECT unnest(${[...trackedKeys]}::text[])) s
    LEFT JOIN listing l
      ON l.source_id = ${sourceId}
     AND (s.scope IS NULL OR l.source_model_key = s.scope OR starts_with(l.source_model_key, s.scope || ' '))
    GROUP BY s.scope
    ORDER BY s.scope NULLS FIRST`.execute(db);
  return rows.map((row) => ({
    scope: row.scope,
    listings: Number(row.listings),
    trim: Number(row.trim),
    model: Number(row.model),
    unmatched: Number(row.unmatched),
  }));
}

/** Models some listing is matched to that have no body type yet (learned ones), most listed first, for a person. */
export async function unclassifiedModels(
  db: Executor,
  sourceId: string,
): Promise<{ model: string; listings: number }[]> {
  const { rows } = await sql<{ model: string; listings: string }>`
    SELECT m.name_en AS model, count(*) AS listings
    FROM listing l JOIN model m ON m.id = l.model_id
    LEFT JOIN trim t ON t.id = l.trim_id
    WHERE l.source_id = ${sourceId} AND m.body_type IS NULL AND t.body_type IS NULL
    GROUP BY m.name_en
    ORDER BY 2 DESC, 1`.execute(db);
  return rows.map((row) => ({ model: row.model, listings: Number(row.listings) }));
}
