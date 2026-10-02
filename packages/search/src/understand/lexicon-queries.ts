// The rows the lexicon is built from (CS-62, S03): the catalogue's makes, models and trims with their aliases (CS-50),
// the cities, body types and colours the filters offer, and how many searchable listings each name has (CS-59's
// search_facet_count, which the worker recounts after every build). Reads only; every table is the web role's to read.
// Node only (Kysely), like options-queries.ts.
import { sql } from 'kysely';
import type { ReadonlyKysely } from 'kysely/readonly';
import type { DB } from '@carshenas/db/db-types';
import type { LexiconRows, MakeRow, ModelRow, TrimRow } from './lexicon.ts';

/** Every name the understanding can match, as plain rows (so a test or an evaluation can freeze them). */
export async function readLexiconRows(db: ReadonlyKysely<DB>): Promise<LexiconRows> {
  const [makes, models, trims, aliases, counted, cities, bodyTypes, colours] = await Promise.all([
    db.selectFrom('make').select(['slug', 'name_fa', 'name_en']).orderBy('slug').execute(),
    db
      .selectFrom('model as m')
      .innerJoin('make as k', 'k.id', 'm.make_id')
      .select(['m.slug', 'k.slug as make_slug', 'm.name_fa', 'm.name_en'])
      .orderBy('k.slug')
      .orderBy('m.slug')
      .execute(),
    db
      .selectFrom('trim as t')
      .innerJoin('model as m', 'm.id', 't.model_id')
      .innerJoin('make as k', 'k.id', 'm.make_id')
      .select(['t.slug', 'm.slug as model_slug', 'k.slug as make_slug', 't.name_fa', 't.name_en'])
      .orderBy('k.slug')
      .orderBy('m.slug')
      .orderBy('t.slug')
      .execute(),
    db
      .selectFrom('catalogue_alias as a')
      .leftJoin('make as mk', 'mk.id', 'a.make_id')
      .leftJoin('model as m', 'm.id', 'a.model_id')
      .leftJoin('make as mmk', 'mmk.id', 'm.make_id')
      .leftJoin('trim as t', 't.id', 'a.trim_id')
      .leftJoin('model as tm', 'tm.id', 't.model_id')
      .leftJoin('make as tmk', 'tmk.id', 'tm.make_id')
      .select([
        'a.alias',
        sql<string>`COALESCE(mk.slug, mmk.slug || '.' || m.slug, tmk.slug || '.' || tm.slug || '.' || t.slug)`.as(
          'key',
        ),
      ])
      .where('a.status', '<>', 'rejected')
      .orderBy('a.alias')
      .execute(),
    db
      .selectFrom('search_facet_count')
      .select(['facet', 'value', 'label_fa', 'listing_count'])
      .where('facet', 'in', ['make', 'model', 'trim', 'city', 'district', 'body_type'])
      .orderBy('facet')
      .orderBy('value')
      .execute(),
    db.selectFrom('city').select(['slug', 'name_fa']).orderBy('slug').execute(),
    db.selectFrom('body_type').select(['code', 'label_fa']).orderBy('position').execute(),
    db.selectFrom('colour').select(['label_fa', 'family']).orderBy('label_fa').execute(),
  ]);

  const aliasesOf = new Map<string, string[]>();
  for (const row of aliases) aliasesOf.set(row.key, [...(aliasesOf.get(row.key) ?? []), row.alias]);
  const listings = new Map<string, number>();
  for (const row of counted) listings.set(`${row.facet}:${row.value}`, row.listing_count);
  const count = (facet: string, key: string) => listings.get(`${facet}:${key}`) ?? 0;

  const makeRows: MakeRow[] = makes.map((row) => ({
    key: row.slug,
    nameFa: row.name_fa,
    nameEn: row.name_en,
    aliases: aliasesOf.get(row.slug) ?? [],
    listings: count('make', row.slug),
  }));
  const modelRows: ModelRow[] = models.map((row) => {
    const key = `${row.make_slug}.${row.slug}`;
    return {
      key,
      makeKey: row.make_slug,
      nameFa: row.name_fa,
      nameEn: row.name_en,
      aliases: aliasesOf.get(key) ?? [],
      listings: count('model', key),
    };
  });
  const trimRows: TrimRow[] = trims.map((row) => {
    const key = `${row.make_slug}.${row.model_slug}.${row.slug}`;
    return {
      key,
      modelKey: `${row.make_slug}.${row.model_slug}`,
      nameFa: row.name_fa,
      nameEn: row.name_en,
      aliases: aliasesOf.get(key) ?? [],
      listings: count('trim', key),
    };
  });
  return {
    makes: makeRows,
    models: modelRows,
    trims: trimRows,
    cities: cities.map((row) => ({ key: row.slug, label: row.name_fa, listings: count('city', row.slug) })),
    districts: counted
      .filter((row) => row.facet === 'district' && row.listing_count > 0)
      .map((row) => ({ key: row.value, label: row.label_fa, listings: row.listing_count })),
    bodyTypes: bodyTypes.map((row) => ({
      code: row.code,
      label: row.label_fa,
      listings: count('body_type', row.code),
    })),
    colours: colours.map((row) => ({ label: row.label_fa, family: row.family })),
  };
}
