import 'server-only';
import { POPULAR_MODEL_RANK } from '@carshenas/search/filters';
import { SEARCH_FRESHNESS_HOURS } from '@carshenas/search/freshness';
import { nameOnScreen } from '@carshenas/locale/names';
import { secondsAgo } from '@/server/db/sql-helpers';
import { POPULAR_TILES } from '@/lib/popular-models';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';

// The superadmin's model-photo screen (CS-97, ADR-0038): the models the search calls popular, the first of them on the
// home page's row, each with the photo link set for it, who set it and when. The ranking is the one the tiles use (the
// same cached read), so this list is what a visitor sees; the links and their authors come through the section's own
// role (ADR-0023). It asks for the superadmin itself (ADR-0020 point 10).

export type ModelPhotoRow = {
  modelId: number;
  key: string;
  name: string;
  /** On the home page's popular row, not only on the models index. */
  onHome: boolean;
  photoUrl: string | null;
  setBy: string | null;
  setAt: string | null;
};

export type AdminModelPhotos = { rows: ModelPhotoRow[] };

export async function loadModelPhotos(): Promise<AdminModelPhotos> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  // The models the search calls popular, most listed first, as the tiles rank them (readPopularModels).
  const popular = await database
    .selectFrom('search_document as r')
    .innerJoin('model as m', 'm.id', 'r.model_id')
    .innerJoin('make as k', 'k.id', 'm.make_id')
    .leftJoin('model_photo_link as p', 'p.model_id', 'm.id')
    .leftJoin('account as who', 'who.id', 'p.set_by_account_id')
    .select((eb) => [
      'm.id',
      'm.slug',
      'k.slug as make_slug',
      'm.name_fa',
      'm.name_en',
      'p.url',
      'p.set_at',
      'who.username as set_by',
      eb.fn.countAll<number>().as('count'),
    ])
    .where('r.model_rank', '<=', POPULAR_MODEL_RANK)
    .where('r.last_seen_at', '>=', secondsAgo(SEARCH_FRESHNESS_HOURS * 3_600))
    .groupBy(['m.id', 'm.slug', 'k.slug', 'm.name_fa', 'm.name_en', 'p.url', 'p.set_at', 'who.username'])
    .orderBy('count', 'desc')
    .orderBy('m.slug')
    .execute();
  const rows = popular.map((row, index): ModelPhotoRow => ({
    modelId: row.id,
    key: `${row.make_slug}.${row.slug}`,
    name: nameOnScreen(row.name_fa ?? row.name_en),
    onHome: index < POPULAR_TILES,
    photoUrl: row.url,
    setBy: row.set_by,
    setAt: row.set_at?.toISOString() ?? null,
  }));
  return { rows };
}
