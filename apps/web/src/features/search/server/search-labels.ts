import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { readDatabase } from '@/server/db/database';

// The Farsi names of the body types, all of them: a catalogue's explanation names body types the index may not hold
// right now (the family catalogue lists a wagon), and the filter options only list the types that have listings. They
// are a small table that changes with the catalogue, so they are read at most once an hour per server.

export type BodyTypeLabel = { readonly code: string; readonly label: string };

export async function readBodyTypeLabels(): Promise<BodyTypeLabel[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('body-type-labels');
  const rows = await readDatabase()
    .selectFrom('body_type')
    .select(['code', 'label_fa'])
    .orderBy('position')
    .execute();
  return rows.map((row) => ({ code: row.code, label: row.label_fa }));
}
