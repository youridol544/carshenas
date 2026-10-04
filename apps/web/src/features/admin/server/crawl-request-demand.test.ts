import { expect, test } from 'vitest';
import { demandOf, DEMAND_LIMIT } from '@/features/admin/server/crawl-request-queries';

// The superadmin's demand list (CS-115): the models buyers asked for, with the links pasted for them, and the models buyers only
// pasted links for; a model that is read in depth already asks for nothing by a pasted link.

const names = (id: number) => ({
  model_id: id,
  model_fa: `مدل ${String(id)}`,
  model_en: `Model ${String(id)}`,
  make_fa: 'برند',
  make_en: 'Make',
});

test('buyers who asked come first, then the links pasted; a model with both shows both', () => {
  const rows = demandOf(
    [
      { ...names(1), buyers: 2, requests: 1 },
      { ...names(2), buyers: 5, requests: 1 },
    ],
    [
      { ...names(1), pasted: 40 },
      { ...names(3), pasted: 90 },
      { ...names(4), pasted: 10 },
    ],
    new Set(),
  );
  expect(rows.map((row) => [row.modelId, row.buyers, row.pasted])).toEqual([
    [2, 5, 0],
    [1, 2, 40],
    [3, 0, 90],
    [4, 0, 10],
  ]);
});

test('a link pasted for a model that is read already asks for nothing, but its requests still show, marked as read', () => {
  const rows = demandOf(
    [{ ...names(1), buyers: 1, requests: 1 }],
    [
      { ...names(1), pasted: 3 },
      { ...names(2), pasted: 50 },
    ],
    new Set([1, 2]),
  );
  expect(rows).toEqual([expect.objectContaining({ modelId: 1, buyers: 1, pasted: 3, read: true })]);
});

test('the list is as long as the screen shows, the most wanted kept', () => {
  const pasted = Array.from({ length: DEMAND_LIMIT + 5 }, (_, index) => ({
    ...names(index + 1),
    pasted: index + 1,
  }));
  const rows = demandOf([], pasted, new Set());
  expect(rows).toHaveLength(DEMAND_LIMIT);
  expect(rows[0]?.pasted).toBe(DEMAND_LIMIT + 5);
});
