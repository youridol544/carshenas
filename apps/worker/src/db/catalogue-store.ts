import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { TRACKED_MODEL_ALIASES } from '../catalogue/aliases.ts';
import { placeDivarKey, slugOf } from '../catalogue/catalogue.ts';
import { BODY_TYPES, COLOURS } from '../catalogue/codes.ts';
import { DIVAR_MAKES, TRIM_BODY_TYPES } from '../catalogue/divar-catalogue.ts';

// The catalogue in the database (CS-50; docs/design/data-model.md, section 3): upserted from the curated files on its
// natural keys with a change guard, grown by what the listings' keys name, named in Persian by what the posts say, and
// matched to every listing. Every write is idempotent, so the job and the command run as often as they like.

type Executor = Kysely<DB>;

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

/** Slugs for names under one parent, in key order: a name that folds to a slug already taken gets -2, -3 … */
function slugsFor(keys: readonly string[], fallbackPrefix: string): Map<string, string> {
  const taken = new Set<string>();
  const slugs = new Map<string, string>();
  for (const [index, key] of [...keys].sort().entries()) {
    const base = slugOf(key, `${fallbackPrefix}-${String(index + 1)}`);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${String(n)}`;
    taken.add(slug);
    slugs.set(key, slug);
  }
  return slugs;
}

async function upsertMake(db: Executor, key: string, slug: string, nameFa: string | null): Promise<number> {
  const { rows } = await sql<{ id: number }>`
    INSERT INTO make (slug, name_fa, name_en) VALUES (${slug}, ${nameFa}, ${key})
    ON CONFLICT ON CONSTRAINT make_slug_unique DO UPDATE
      SET name_fa = coalesce(excluded.name_fa, make.name_fa), name_en = excluded.name_en
      WHERE (make.name_fa, make.name_en) IS DISTINCT FROM (coalesce(excluded.name_fa, make.name_fa), excluded.name_en)
    RETURNING id`.execute(db);
  if (rows[0]) return rows[0].id;
  const found = await db.selectFrom('make').select('id').where('slug', '=', slug).executeTakeFirstOrThrow();
  return found.id;
}

async function upsertModel(
  db: Executor,
  makeId: number,
  key: string,
  slug: string,
  bodyType: string | null,
): Promise<number> {
  // A curated body type wins; null (unclassified) leaves a person's later choice alone.
  const { rows } = await sql<{ id: number }>`
    INSERT INTO model (make_id, slug, name_en, body_type) VALUES (${makeId}, ${slug}, ${key}, ${bodyType})
    ON CONFLICT ON CONSTRAINT model_slug_unique DO UPDATE
      SET name_en = excluded.name_en, body_type = coalesce(excluded.body_type, model.body_type)
      WHERE (model.name_en, model.body_type) IS DISTINCT FROM (excluded.name_en, coalesce(excluded.body_type, model.body_type))
    RETURNING id`.execute(db);
  if (rows[0]) return rows[0].id;
  const found = await db
    .selectFrom('model')
    .select('id')
    .where('make_id', '=', makeId)
    .where('slug', '=', slug)
    .executeTakeFirstOrThrow();
  return found.id;
}

async function upsertTrim(db: Executor, modelId: number, key: string, slug: string): Promise<number> {
  const { rows } = await sql<{ id: number }>`
    INSERT INTO trim (model_id, slug, name_en) VALUES (${modelId}, ${slug}, ${key})
    ON CONFLICT ON CONSTRAINT trim_slug_unique DO NOTHING
    RETURNING id`.execute(db);
  if (rows[0]) return rows[0].id;
  const found = await db
    .selectFrom('trim')
    .select('id')
    .where('model_id', '=', modelId)
    .where('slug', '=', slug)
    .executeTakeFirstOrThrow();
  return found.id;
}

type Level =
  | { level: 'make'; makeId: number }
  | { level: 'model'; makeId: number; modelId: number }
  | {
      level: 'trim';
      makeId: number;
      modelId: number;
      trimId: number;
    };

async function upsertSourceKey(db: Executor, sourceId: string, key: string, target: Level): Promise<void> {
  const modelId = target.level === 'make' ? null : target.modelId;
  const trimId = target.level === 'trim' ? target.trimId : null;
  await sql`
    INSERT INTO catalogue_source_key (source_id, source_model_key, level, make_id, model_id, trim_id)
    VALUES (${sourceId}, ${key}, ${target.level}, ${target.makeId}, ${modelId}, ${trimId})
    ON CONFLICT ON CONSTRAINT catalogue_source_key_pkey DO UPDATE
      SET level = excluded.level, make_id = excluded.make_id, model_id = excluded.model_id, trim_id = excluded.trim_id
      WHERE (catalogue_source_key.level, catalogue_source_key.make_id, catalogue_source_key.model_id,
             catalogue_source_key.trim_id)
            IS DISTINCT FROM (excluded.level, excluded.make_id, excluded.model_id, excluded.trim_id)`.execute(
    db,
  );
}

type AliasTarget = { makeId?: number; modelId?: number; trimId?: number };

async function addAlias(
  db: Executor,
  target: AliasTarget,
  alias: string,
  script: 'fa' | 'latin' | 'spelled',
  status: 'curated' | 'suggested',
  sourceId: string | null,
): Promise<boolean> {
  const { rows } = await sql<{ id: number }>`
    INSERT INTO catalogue_alias (make_id, model_id, trim_id, alias, script, status, source_id)
    VALUES (${target.makeId ?? null}, ${target.modelId ?? null}, ${target.trimId ?? null}, ${alias}, ${script},
            ${status}, ${sourceId})
    ON CONFLICT ON CONSTRAINT catalogue_alias_unique DO NOTHING
    RETURNING id`.execute(db);
  return rows.length > 0;
}

export type CatalogueCounts = { makes: number; models: number; trimsLearned: number; modelsLearned: number };

/**
 * Upserts Divar's curated makes and models with their source keys, Persian names and curated aliases (criterion 3), then
 * places every key the source's listings carry that the catalogue does not know yet: a trim under its model, or a
 * model of its own under its make (learned: its body type waits for a person).
 */
export async function syncDivarCatalogue(db: Executor, sourceId: string): Promise<CatalogueCounts> {
  const makeSlugs = slugsFor(Object.keys(DIVAR_MAKES), 'make');
  const makeIds = new Map<string, number>();
  const modelIds = new Map<string, { makeId: number; modelId: number }>();
  let models = 0;
  for (const [makeKey, make] of Object.entries(DIVAR_MAKES)) {
    const makeId = await upsertMake(db, makeKey, makeSlugs.get(makeKey) ?? makeKey, make.nameFa);
    makeIds.set(makeKey, makeId);
    await upsertSourceKey(db, sourceId, makeKey, { level: 'make', makeId });
    await addAlias(db, { makeId }, makeKey, 'latin', 'curated', null);
    if (make.nameFa !== null) await addAlias(db, { makeId }, make.nameFa, 'fa', 'curated', null);
    const modelSlugs = slugsFor(Object.keys(make.models), 'model');
    for (const [rest, bodyType] of Object.entries(make.models)) {
      const key = `${makeKey} ${rest}`;
      const modelId = await upsertModel(db, makeId, key, modelSlugs.get(rest) ?? rest, bodyType);
      modelIds.set(key, { makeId, modelId });
      await upsertSourceKey(db, sourceId, key, { level: 'model', makeId, modelId });
      models += 1;
    }
  }
  for (const [key, aliases] of Object.entries(TRACKED_MODEL_ALIASES)) {
    const known = modelIds.get(key);
    if (!known) throw new Error(`a tracked model's aliases name ${key}, which the catalogue does not have`);
    for (const alias of aliases)
      await addAlias(db, { modelId: known.modelId }, alias.alias, alias.script, 'curated', null);
  }
  const learned = await learnDivarKeys(db, sourceId, makeIds);
  await applyTrimBodyTypes(db, sourceId);
  return { makes: makeIds.size, models, ...learned };
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
  db: Executor,
  sourceId: string,
  makeIds: ReadonlyMap<string, number>,
): Promise<{ trimsLearned: number; modelsLearned: number }> {
  const keys = await unknownKeys(db, sourceId);
  if (keys.length === 0) return { trimsLearned: 0, modelsLearned: 0 };
  const { rows: known } = await sql<{
    make_key: string;
    model_key: string;
    model_id: number;
    make_id: number;
  }>`
    SELECT mk.source_model_key AS make_key, k.source_model_key AS model_key, k.model_id, k.make_id
    FROM catalogue_source_key k
    JOIN catalogue_source_key mk ON mk.source_id = k.source_id AND mk.make_id = k.make_id AND mk.level = 'make'
    WHERE k.source_id = ${sourceId} AND k.level = 'model'`.execute(db);
  const modelsByMake = new Map<string, string[]>();
  const modelIdByKey = new Map<string, { makeId: number; modelId: number }>();
  for (const row of known) {
    modelsByMake.set(row.make_key, [...(modelsByMake.get(row.make_key) ?? []), row.model_key]);
    modelIdByKey.set(row.model_key, { makeId: row.make_id, modelId: row.model_id });
  }
  let trimsLearned = 0;
  let modelsLearned = 0;
  // Models first, so a trim whose model is learned in the same run finds it.
  const placed = keys.map((key) => placeDivarKey(key, modelsByMake)).filter((key) => key !== undefined);
  for (const key of placed.filter((candidate) => candidate.level === 'model')) {
    const makeId = makeIds.get(key.make);
    if (makeId === undefined) continue;
    const rest = key.model.slice(key.make.length + 1);
    const slug = await freeSlug(db, 'model', makeId, slugOf(rest, 'model'));
    const modelId = await upsertModel(db, makeId, key.model, slug, null);
    await upsertSourceKey(db, sourceId, key.model, { level: 'model', makeId, modelId });
    modelIdByKey.set(key.model, { makeId, modelId });
    modelsByMake.set(key.make, [...(modelsByMake.get(key.make) ?? []), key.model]);
    modelsLearned += 1;
  }
  for (const key of keys) {
    const place = placeDivarKey(key, modelsByMake);
    if (place?.level !== 'trim') continue;
    const model = modelIdByKey.get(place.model);
    if (!model) continue;
    const rest = place.trim.slice(place.model.length + 1);
    const slug = await freeSlug(db, 'trim', model.modelId, slugOf(rest, 'trim'));
    const trimId = await upsertTrim(db, model.modelId, place.trim, slug);
    await upsertSourceKey(db, sourceId, key, { level: 'trim', ...model, trimId });
    trimsLearned += 1;
  }
  return { trimsLearned, modelsLearned };
}

/** A slug not yet taken under the parent: the base, or the base with -2, -3 … */
async function freeSlug(
  db: Executor,
  table: 'model' | 'trim',
  parentId: number,
  base: string,
): Promise<string> {
  const rows =
    table === 'model'
      ? await db.selectFrom('model').select('slug').where('make_id', '=', parentId).execute()
      : await db.selectFrom('trim').select('slug').where('model_id', '=', parentId).execute();
  const taken = new Set(rows.map((row) => row.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${String(n)}`;
  return slug;
}

/**
 * Persian names from what the source's own posts call each key (Divar's «برند و مدل» row), the most common wording per
 * key: set on a trim or a learned model that has none yet, and kept as a suggested alias (the owner's decision of
 * 2026-09-30). Returns how many names were set.
 */
export async function suggestDivarNames(db: Executor, sourceId: string): Promise<number> {
  const { rows } = await sql<{ key: string; name: string }>`
    SELECT DISTINCT ON (key) key, name
    FROM (
      SELECT l.source_model_key AS key, btrim(w -> 'data' ->> 'value') AS name, count(*) AS n
      FROM listing l
      JOIN LATERAL (
        SELECT s.payload FROM snapshot s WHERE s.listing_id = l.id ORDER BY s.first_fetched_at DESC LIMIT 1
      ) latest ON true
      CROSS JOIN LATERAL jsonb_array_elements(latest.payload -> 'sections') sec
      CROSS JOIN LATERAL jsonb_array_elements(sec -> 'widgets') w
      WHERE l.source_id = ${sourceId} AND l.source_model_key IS NOT NULL
        AND w -> 'data' ->> 'title' = 'برند و مدل' AND btrim(w -> 'data' ->> 'value') <> ''
      GROUP BY 1, 2
    ) named
    ORDER BY key, n DESC, name`.execute(db);
  let named = 0;
  for (const row of rows) {
    const target = await db
      .selectFrom('catalogue_source_key')
      .select(['level', 'model_id', 'trim_id'])
      .where('source_id', '=', sourceId)
      .where('source_model_key', '=', row.key)
      .executeTakeFirst();
    if (!target || target.level === 'make') continue;
    if (target.level === 'trim' && target.trim_id !== null) {
      const set = await db
        .updateTable('trim')
        .set({ name_fa: row.name })
        .where('id', '=', target.trim_id)
        .where('name_fa', 'is', null)
        .executeTakeFirst();
      named += Number(set.numUpdatedRows);
      await addAlias(db, { trimId: target.trim_id }, row.name, 'fa', 'suggested', sourceId);
    } else if (target.level === 'model' && target.model_id !== null) {
      const set = await db
        .updateTable('model')
        .set({ name_fa: row.name })
        .where('id', '=', target.model_id)
        .where('name_fa', 'is', null)
        .executeTakeFirst();
      named += Number(set.numUpdatedRows);
      await addAlias(db, { modelId: target.model_id }, row.name, 'fa', 'suggested', sourceId);
    }
  }
  return named;
}

/**
 * Sets every listing's make, model, trim and catalogue_match from its source_model_key (criterion 1): trim or model
 * when its key names one, unmatched otherwise (no key, a key the catalogue does not know, or one that names only a
 * make); never a guess. Only listings whose match changes are written. Returns how many.
 */
export async function matchListings(db: Executor): Promise<number> {
  const result = await sql`
    UPDATE listing l
    SET catalogue_match = t.match, make_id = t.make_id, model_id = t.model_id, trim_id = t.trim_id
    FROM (
      SELECT l2.id,
             CASE k.level WHEN 'trim' THEN 'trim' WHEN 'model' THEN 'model' ELSE 'unmatched' END AS match,
             CASE WHEN k.level IN ('trim', 'model') THEN k.make_id END AS make_id,
             CASE WHEN k.level IN ('trim', 'model') THEN k.model_id END AS model_id,
             CASE WHEN k.level = 'trim' THEN k.trim_id END AS trim_id
      FROM listing l2
      LEFT JOIN catalogue_source_key k
        ON k.source_id = l2.source_id AND k.source_model_key = l2.source_model_key
    ) t
    WHERE l.id = t.id
      AND (l.catalogue_match, l.make_id, l.model_id, l.trim_id)
          IS DISTINCT FROM (t.match, t.make_id, t.model_id, t.trim_id)`.execute(db);
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

/** Sets the curated body type of every trim that differs from its model (TRIM_BODY_TYPES); a person's choice stays. */
async function applyTrimBodyTypes(db: Executor, sourceId: string): Promise<void> {
  for (const rule of TRIM_BODY_TYPES) {
    const trims = await db
      .selectFrom('catalogue_source_key as k')
      .innerJoin('catalogue_source_key as mk', (join) =>
        join.onRef('mk.source_id', '=', 'k.source_id').onRef('mk.model_id', '=', 'k.model_id'),
      )
      .select(['k.trim_id', 'k.source_model_key'])
      .where('k.source_id', '=', sourceId)
      .where('k.level', '=', 'trim')
      .where('mk.level', '=', 'model')
      .where('mk.source_model_key', '=', rule.model)
      .execute();
    for (const trim of trims) {
      const rest = trim.source_model_key.slice(rule.model.length + 1);
      if (trim.trim_id === null || !rule.trimWord.test(rest)) continue;
      await db
        .updateTable('trim')
        .set({ body_type: rule.bodyType })
        .where('id', '=', trim.trim_id)
        .where('body_type', 'is', null)
        .execute();
    }
  }
}
