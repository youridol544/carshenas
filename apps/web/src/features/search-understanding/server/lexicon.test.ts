// @vitest-environment node
import { FIXTURE_ROWS } from '@carshenas/search/understand/fixture';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  currentLexicon,
  forgetLexicon,
  LEXICON_TTL_MS,
} from '@/features/search-understanding/server/lexicon';

// The lexicon the sentence reading matches names against (CS-62, CS-111): read once, kept five minutes, and never waited
// for again once a process has one: a lexicon past its time is served while the next read runs in the background, and a
// read that fails keeps the one that is kept.

const reads = vi.hoisted(() => ({ rows: vi.fn(), reported: vi.fn() }));

vi.mock('@carshenas/search/understand/lexicon-queries', () => ({
  readLexiconRows: reads.rows,
}));
vi.mock('@/server/db/database', () => ({ readDatabase: () => ({}) }));
vi.mock('@/server/observability/logger', () => ({ captureError: reads.reported }));

beforeEach(() => {
  forgetLexicon();
  reads.rows.mockReset();
  reads.reported.mockReset();
  reads.rows.mockResolvedValue(FIXTURE_ROWS);
});

afterEach(() => {
  forgetLexicon();
});

test('the first question reads the lexicon and waits for it; the next ones within the time do not read again', async () => {
  const first = await currentLexicon(1_000);
  expect(first.entity('peugeot.206')?.label).toBeDefined();
  expect(await currentLexicon(2_000)).toBe(first);
  expect(await currentLexicon(1_000 + LEXICON_TTL_MS - 1)).toBe(first);
  expect(reads.rows).toHaveBeenCalledTimes(1);
});

test('past its time the kept lexicon answers at once while one read runs in the background', async () => {
  const first = await currentLexicon(1_000);
  let finish: (rows: typeof FIXTURE_ROWS) => void = () => undefined;
  reads.rows.mockReturnValue(
    new Promise<typeof FIXTURE_ROWS>((resolve) => {
      finish = resolve;
    }),
  );
  const later = 1_000 + LEXICON_TTL_MS;
  // A read that has not finished does not hold the answer.
  expect(await currentLexicon(later)).toBe(first);
  expect(await currentLexicon(later + 1)).toBe(first);
  expect(reads.rows).toHaveBeenCalledTimes(2);
  finish(FIXTURE_ROWS);
  await vi.waitFor(async () => {
    expect(await currentLexicon(later + 2)).not.toBe(first);
  });
  expect(reads.rows).toHaveBeenCalledTimes(2);
});

test('a refresh that fails is reported and the kept lexicon keeps answering, not tried again at once', async () => {
  const first = await currentLexicon(1_000);
  reads.rows.mockRejectedValue(new Error('no database'));
  const later = 1_000 + LEXICON_TTL_MS;
  expect(await currentLexicon(later)).toBe(first);
  await vi.waitFor(() => {
    expect(reads.reported).toHaveBeenCalledTimes(1);
  });
  expect(await currentLexicon(later + 1)).toBe(first);
  expect(reads.rows).toHaveBeenCalledTimes(2);
});

test('a process that has never read a lexicon fails the question when the first read fails', async () => {
  reads.rows.mockRejectedValue(new Error('no database'));
  await expect(currentLexicon(1_000)).rejects.toThrow('no database');
  // The next question tries again.
  reads.rows.mockResolvedValue(FIXTURE_ROWS);
  expect((await currentLexicon(2_000)).entity('peugeot.206')).toBeDefined();
});
