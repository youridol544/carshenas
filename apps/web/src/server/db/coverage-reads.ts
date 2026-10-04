import 'server-only';
import { sql } from 'kysely';
import type { ReadonlyKysely } from 'kysely/readonly';
import type { DB } from '@carshenas/db/db-types';
import { nameOnScreen } from '@carshenas/locale/names';
import { carNameOf } from '@/lib/crawl-requests-names';

// What the pasted-link answer asks the catalogue (CS-115, ADR-0046): which cars Carshenas reads in depth now, a model by
// its key, the models of a make, and where the request for a model stands. «Covered» is a model with a row in
// tracked_model_scope (state tracking) for the whole model (trim NULL): the models whose ads are discovered, read and
// rated, which on 2026-10-04 were exactly the models with rated listings. The handle is the caller's (the web role); every
// table here is the web role's to read. Plans are in docs/evidence/paste-link-coverage/.

export type CatalogueModel = {
  readonly id: number;
  /** `make.model`: what a search and the lexicon call the model. */
  readonly key: string;
  readonly makeKey: string;
  readonly modelSlug: string;
  /** The car as the catalogue names it («پژو ۲۰۶»), in the digits the screen uses. */
  readonly name: string;
};

/** The models read in depth now, the most listed first (the cars the limit is stated with). */
export async function readCoveredModels(db: ReadonlyKysely<DB>): Promise<CatalogueModel[]> {
  const rows = await db
    .selectFrom('tracked_model_scope as s')
    .innerJoin('model as m', 'm.id', 's.model_id')
    .innerJoin('make as k', 'k.id', 'm.make_id')
    .leftJoin('search_facet_count as f', (join) =>
      join.on('f.facet', '=', 'model').on(sql<boolean>`f.value = k.slug || '.' || m.slug`),
    )
    .select([
      'm.id',
      'm.slug',
      'm.name_fa',
      'm.name_en',
      'k.slug as make_slug',
      'k.name_fa as make_fa',
      'k.name_en as make_en',
      'f.listing_count',
    ])
    .where('s.trim_id', 'is', null)
    .orderBy(sql`coalesce(f.listing_count, 0)`, 'desc')
    .orderBy('m.name_en')
    .orderBy('m.id')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    key: `${row.make_slug}.${row.slug}`,
    makeKey: row.make_slug,
    modelSlug: row.slug,
    name: carNameOf({
      makeFa: row.make_fa,
      makeEn: row.make_en,
      modelFa: row.name_fa,
      modelEn: row.name_en,
    }),
  }));
}

/** A model by its key (`make.model`), or undefined when the catalogue has none. */
export async function readCatalogueModel(
  db: ReadonlyKysely<DB>,
  key: string,
): Promise<CatalogueModel | undefined> {
  const [makeSlug, modelSlug, ...rest] = key.split('.');
  if (makeSlug === undefined || modelSlug === undefined || rest.length > 0) return undefined;
  const row = await db
    .selectFrom('model as m')
    .innerJoin('make as k', 'k.id', 'm.make_id')
    .select(['m.id', 'm.name_fa', 'm.name_en', 'k.name_fa as make_fa', 'k.name_en as make_en'])
    .where('k.slug', '=', makeSlug)
    .where('m.slug', '=', modelSlug)
    .executeTakeFirst();
  if (row === undefined) return undefined;
  return {
    id: row.id,
    key,
    makeKey: makeSlug,
    modelSlug,
    name: carNameOf({ makeFa: row.make_fa, makeEn: row.make_en, modelFa: row.name_fa, modelEn: row.name_en }),
  };
}

/** A make's Persian name (else its Latin one) and its models, for a buyer to pick the one a link is about. */
export async function readMakeModels(
  db: ReadonlyKysely<DB>,
  makeSlug: string,
): Promise<{ readonly name: string; readonly models: readonly CatalogueModel[] } | undefined> {
  const rows = await db
    .selectFrom('model as m')
    .innerJoin('make as k', 'k.id', 'm.make_id')
    .select(['m.id', 'm.slug', 'm.name_fa', 'm.name_en', 'k.name_fa as make_fa', 'k.name_en as make_en'])
    .where('k.slug', '=', makeSlug)
    .orderBy('m.name_en')
    .orderBy('m.id')
    .execute();
  const [first] = rows;
  if (first === undefined) return undefined;
  return {
    name: nameOnScreen(first.make_fa ?? first.make_en),
    models: rows.map((row) => ({
      id: row.id,
      key: `${makeSlug}.${row.slug}`,
      makeKey: makeSlug,
      modelSlug: row.slug,
      name: carNameOf({
        makeFa: row.make_fa,
        makeEn: row.make_en,
        modelFa: row.name_fa,
        modelEn: row.name_en,
      }),
    })),
  };
}

export type ModelRequestRow = {
  readonly status: 'none' | 'pending' | 'approved' | 'declined' | 'fulfilled';
  readonly reason: string | null;
  /** The viewer's own file that depends on the request (the first one), when they asked. */
  readonly fileId: number | null;
};

/**
 * Where the whole-model request for a model stands (CS-71), and the viewer's own file that depends on it. One row by the
 * request's unique key (crawl_request_once_per_scope_unique), one probe of the links by the request's id.
 */
export async function readModelRequest(
  db: ReadonlyKysely<DB>,
  accountId: number | null,
  modelId: number,
): Promise<ModelRequestRow> {
  const row = await db
    .selectFrom('crawl_request as r')
    .select((eb) => [
      'r.state',
      'r.decline_reason',
      eb
        .selectFrom('crawl_request_file as l')
        .innerJoin('search_file as f', 'f.id', 'l.search_file_id')
        .select('f.id')
        .whereRef('l.crawl_request_id', '=', 'r.id')
        .where('f.account_id', '=', accountId ?? -1)
        .orderBy('f.id')
        .limit(1)
        .as('file_id'),
    ])
    .where('r.model_id', '=', modelId)
    .where('r.trim_id', 'is', null)
    .executeTakeFirst();
  if (row === undefined) return { status: 'none', reason: null, fileId: null };
  return { status: row.state, reason: row.decline_reason, fileId: row.file_id };
}

/**
 * Where the whole-model requests of several models stand, with the viewer's own file on each (the models of one make, for the
 * buyer who picks among them): one read by the requests' unique key for the models' ids, one probe of the links per request.
 */
export async function readModelRequests(
  db: ReadonlyKysely<DB>,
  accountId: number | null,
  modelIds: readonly number[],
): Promise<Map<number, ModelRequestRow>> {
  const found = new Map<number, ModelRequestRow>();
  if (modelIds.length === 0) return found;
  const rows = await db
    .selectFrom('crawl_request as r')
    .select((eb) => [
      'r.model_id',
      'r.state',
      'r.decline_reason',
      eb
        .selectFrom('crawl_request_file as l')
        .innerJoin('search_file as f', 'f.id', 'l.search_file_id')
        .select('f.id')
        .whereRef('l.crawl_request_id', '=', 'r.id')
        .where('f.account_id', '=', accountId ?? -1)
        .orderBy('f.id')
        .limit(1)
        .as('file_id'),
    ])
    .where('r.model_id', 'in', modelIds)
    .where('r.trim_id', 'is', null)
    .execute();
  for (const row of rows) {
    found.set(row.model_id, { status: row.state, reason: row.decline_reason, fileId: row.file_id });
  }
  return found;
}
