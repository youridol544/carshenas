import 'server-only';
import { POPULAR_TILES } from '@/features/home/server/home-queries';
import { readPopularModels } from '@/features/model/server/model-queries';
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
  const popular = await readPopularModels();
  if (popular.length === 0) return { rows: [] };
  const database = readAdminDatabase();
  const found = await database
    .selectFrom('model as m')
    .innerJoin('make as k', 'k.id', 'm.make_id')
    .leftJoin('model_photo_link as p', 'p.model_id', 'm.id')
    .leftJoin('account as who', 'who.id', 'p.set_by_account_id')
    .select(['m.id', 'm.slug', 'k.slug as make_slug', 'p.url', 'p.set_at', 'who.username as set_by'])
    .where(
      'k.slug',
      'in',
      popular.map((model) => model.makeSlug),
    )
    .where(
      'm.slug',
      'in',
      popular.map((model) => model.slug),
    )
    .execute();
  const rows = popular.flatMap((model, index): ModelPhotoRow[] => {
    const row = found.find(
      (candidate) => candidate.make_slug === model.makeSlug && candidate.slug === model.slug,
    );
    if (row === undefined) return [];
    return [
      {
        modelId: row.id,
        key: `${model.makeSlug}.${model.slug}`,
        name: model.name,
        onHome: index < POPULAR_TILES,
        photoUrl: row.url,
        setBy: row.set_by,
        setAt: row.set_at?.toISOString() ?? null,
      },
    ];
  });
  return { rows };
}
