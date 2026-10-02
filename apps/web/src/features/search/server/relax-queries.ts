import 'server-only';
import { searchHref, type Search } from '@carshenas/search/search';
import type { Relaxation } from '@/features/search/components/no-results';
import { searchListings } from '@/features/search/server/search-queries';

// When a search finds nothing: how many listings it would find without each of its filters (and without its words),
// counted by the database for this very search, so the page can name the filters worth removing with their counts
// (ui-design craft.md, V-12). One small count per applied filter; only the ones that would bring results back are
// suggested, the one with the most first.

const SUGGESTIONS = 3;

export type RelaxationCandidate = {
  readonly key: string;
  readonly text: string;
  readonly without: Search;
};

export async function readRelaxations(candidates: readonly RelaxationCandidate[]): Promise<Relaxation[]> {
  const counted = await Promise.all(
    candidates.map(async (candidate) => {
      const result = await searchListings({ search: candidate.without, limit: 1 });
      return result.status === 'ok'
        ? [
            {
              key: candidate.key,
              text: candidate.text,
              href: searchHref(candidate.without),
              total: result.page.total,
            },
          ]
        : [];
    }),
  );
  return counted
    .flat()
    .filter((relaxation) => relaxation.total.count > 0)
    .sort((a, b) => b.total.count - a.total.count)
    .slice(0, SUGGESTIONS);
}
