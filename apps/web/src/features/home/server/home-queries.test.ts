// @vitest-environment node
import { expect, test } from 'vitest';
import type { ListingCard } from '@/features/search/search-types';
import { ROW_CARDS, withoutRepeats, type HomeRow } from '@/features/home/server/home-queries';

const card = (id: number) => ({ id }) as ListingCard;
const row = (id: HomeRow['id'], ids: number[]): HomeRow => ({ id, count: ids.length, cards: ids.map(card) });

test('a card shown in an earlier row is skipped in the later ones, and each row keeps its own order', () => {
  const rows = withoutRepeats([
    row('karshenas-pick', [1, 2, 3]),
    row('great-deals-under-1b', [1, 4, 2, 5]),
    row('clean-and-easy', [1, 6, 3, 4]),
  ]);
  expect(rows.map((entry) => entry.cards.map((item) => item.id))).toEqual([[1, 2, 3], [4, 5], [6]]);
});

test('a row holds at most the cards a row shows', () => {
  const [first] = withoutRepeats([
    row(
      'karshenas-pick',
      Array.from({ length: ROW_CARDS + 4 }, (_, index) => index + 1),
    ),
  ]);
  expect(first?.cards).toHaveLength(ROW_CARDS);
});
