import 'server-only';
import { readAdminDatabase } from '@/server/db/admin-database';
import { carNameOf } from '@/lib/crawl-requests-names';
import type { CrawlRequestState } from '@/lib/crawl-requests-rules';

// Which crawl requests each search file depends on (CS-71 #4), for the superadmin's search-files screen. A file of its
// own module, so the search-files queries and the crawl-request queries (which read the files' chips from them) do not
// import each other.

/** The crawl requests of each of these files, for the search-files screen: the state of every request it depends on. */
export async function readRequestsOfFiles(
  fileIds: readonly number[],
): Promise<Map<number, { id: number; carName: string; state: CrawlRequestState }[]>> {
  const byFile = new Map<number, { id: number; carName: string; state: CrawlRequestState }[]>();
  if (fileIds.length === 0) return byFile;
  const rows = await readAdminDatabase()
    .selectFrom('crawl_request_file as l')
    .innerJoin('crawl_request as r', 'r.id', 'l.crawl_request_id')
    .innerJoin('model as m', 'm.id', 'r.model_id')
    .innerJoin('make as k', 'k.id', 'm.make_id')
    .leftJoin('trim as t', 't.id', 'r.trim_id')
    .select([
      'l.search_file_id',
      'r.id',
      'r.state',
      'm.name_fa as model_fa',
      'm.name_en as model_en',
      'k.name_fa as make_fa',
      'k.name_en as make_en',
      't.name_fa as trim_fa',
      't.name_en as trim_en',
    ])
    .where('l.search_file_id', 'in', [...fileIds])
    .orderBy('r.id')
    .execute();
  for (const row of rows) {
    byFile.set(row.search_file_id, [
      ...(byFile.get(row.search_file_id) ?? []),
      {
        id: row.id,
        state: row.state as CrawlRequestState,
        carName: carNameOf({
          makeFa: row.make_fa,
          makeEn: row.make_en,
          modelFa: row.model_fa,
          modelEn: row.model_en,
          trimFa: row.trim_fa,
          trimEn: row.trim_en,
        }),
      },
    ]);
  }
  return byFile;
}
