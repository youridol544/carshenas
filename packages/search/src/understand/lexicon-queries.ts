// The rows the lexicon is built from (CS-62, S03): the catalogue's makes, models and trims with their aliases (CS-50),
// the cities, body types and colours the filters offer, and how many searchable listings each name has (CS-59's
// search_facet_count, which the worker recounts after every build). Reads only; every table is the web role's to read.
// Node only (Kysely), like options-queries.ts.
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { LexiconRows, MakeRow, ModelRow, TrimRow } from './lexicon.ts';

type Counted = { facet: string; value: string; label_fa: string; listing_count: number };

/** Every name the understanding can match, as plain rows (so a test or an evaluation can freeze them). */
export async function readLexiconRows(db: Kysely<DB>): Promise<LexiconRows> {
  const [makes, models, trims, aliases, counted, cities, bodyTypes, colours] = await Promise.all([
    db.selectFrom('make').select(['slug', 'name_fa', 'name_en']).execute(),
    db
      .selectFrom('model as m')
      .innerJoin('make as k', 'k.id', 'm.make_id')
      .select(['m.slug', 'k.slug as make_slug', 'm.name_fa', 'm.name_en'])
      .execute(),
    db
      .selectFrom('trim as t')
      .innerJoin('model as m', 'm.id', 't.model_id')
      .innerJoin('make as k', 'k.id', 'm.make_id')
      .select(['t.slug', 'm.slug as model_slug', 'k.slug as make_slug', 't.name_fa', 't.name_en'])
      .execute(),
    sql<{ alias: string; key: string }>`
      SELECT a.alias,
             COALESCE(mk.slug, mmk.slug || '.' || m.slug, tmk.slug || '.' || tm.slug || '.' || t.slug) AS key
      FROM catalogue_alias a
      LEFT JOIN make mk ON mk.id = a.make_id
      LEFT JOIN model m ON m.id = a.model_id
      LEFT JOIN make mmk ON mmk.id = m.make_id
      LEFT JOIN trim t ON t.id = a.trim_id
      LEFT JOIN model tm ON tm.id = t.model_id
      LEFT JOIN make tmk ON tmk.id = tm.make_id
      WHERE a.status <> 'rejected'`
      .execute(db)
      .then((result) => result.rows),
    sql<Counted>`
      SELECT facet, value, label_fa, listing_count
      FROM search_facet_count
      WHERE facet IN ('make', 'model', 'trim', 'city', 'district', 'body_type')`
      .execute(db)
      .then((result) => result.rows),
    db.selectFrom('city').select(['slug', 'name_fa']).execute(),
    db.selectFrom('body_type').select(['code', 'label_fa']).orderBy('position').execute(),
    db.selectFrom('colour').select(['label_fa', 'family']).execute(),
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
