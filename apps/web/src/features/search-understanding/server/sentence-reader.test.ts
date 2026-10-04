// @vitest-environment node
import { fixtureLexicon } from '@carshenas/search/understand/fixture';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  destinationOfSentence,
  readSentence,
  readSentenceView,
} from '@/features/search-understanding/server/sentence-reader';
import type { ModelStep } from '@carshenas/search/understand/understand';

// The sentence flow with its real parts bound (CS-111): the lexicon, the model's cache when the master switch is on and
// the search API's counts. Here the lexicon is the small test catalogue, the counts a stub and the model's cache a stub
// step, so what is under test is the binding: the switch is read for every sentence, the cache is the only model
// the page's reading ever reaches, the address is the settled one, and a failure of the lines about the sentence never
// costs the results.

const settings = vi.hoisted(() => ({ ai: false }));
const parts = vi.hoisted(() => ({
  count: vi.fn<(search: { q?: string }) => number>(() => 5),
  cached: vi.fn<ModelStep>(),
  lexiconFails: false,
}));
const reported = vi.hoisted(() => ({ errors: [] as unknown[] }));

vi.mock('@/server/env', () => ({
  env: {
    get searchUnderstandingAi() {
      return settings.ai;
    },
  },
}));
vi.mock('@/features/search/server/search-queries', () => ({
  searchListings: (input: { search: { q?: string } }) =>
    Promise.resolve({ status: 'ok', page: { total: { count: parts.count(input.search), exact: true } } }),
}));
vi.mock('@/features/search-understanding/server/lexicon', () => {
  const lexicon = fixtureLexicon();
  return {
    currentLexicon: () =>
      parts.lexiconFails ? Promise.reject(new Error('no database')) : Promise.resolve(lexicon),
  };
});
vi.mock('@/features/search-understanding/server/paid-step', () => ({
  cachedModelStep: () => parts.cached,
}));
vi.mock('@/server/observability/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
  captureError: (error: unknown) => {
    reported.errors.push(error);
  },
}));

beforeEach(() => {
  settings.ai = false;
  parts.count.mockReset();
  parts.count.mockReturnValue(5);
  parts.cached.mockReset();
  parts.lexiconFails = false;
  reported.errors.length = 0;
});

describe('reading a sentence', () => {
  test('with the switch off the model’s cache is never looked at', async () => {
    const { understanding } = await readSentence('پژو ۲۰۶ خوشگل');
    expect(understanding.search.filters).toEqual({ model: ['peugeot.206'] });
    expect(understanding.degraded?.reason).toBe('switched_off');
    expect(parts.cached).not.toHaveBeenCalled();
  });

  test('with the switch on, a sentence the code left words of is put to the cache, and an answer there is used', async () => {
    settings.ai = true;
    parts.cached.mockResolvedValue({ status: 'unavailable', reason: 'unavailable' });
    const first = await readSentence('پژو ۲۰۶ خوشگل');
    expect(parts.cached).toHaveBeenCalledTimes(1);
    expect(first.understanding.modelUsed).toBe(false);
    expect(first.trace.asked).toBe('left');
  });

  test('the switch is read for every sentence: turned off, the next one is code alone', async () => {
    settings.ai = true;
    parts.cached.mockResolvedValue({ status: 'unavailable', reason: 'unavailable' });
    await readSentence('پژو ۲۰۶ خوشگل');
    settings.ai = false;
    await readSentence('پژو ۲۰۶ خوشگل');
    expect(parts.cached).toHaveBeenCalledTimes(1);
  });
});

describe('where a sentence leads', () => {
  test('to the settled search, with the sentence kept beside it', async () => {
    parts.count.mockImplementation((search) => (search.q === undefined ? 5 : 0));
    const read = await destinationOfSentence('پژو ۲۰۶ خوشگل');
    const url = new URL(read.href, 'https://x.test');
    expect(url.searchParams.get('model')).toBe('peugeot.206');
    expect(url.searchParams.get('ask')).toBe('پژو ۲۰۶ خوشگل');
    expect(url.searchParams.has('q')).toBe(false);
    expect(read.settled.dropped.map((one) => one.words)).toEqual(['خوشگل']);
  });
});

describe('what the page says about the sentence', () => {
  test('it comes from the same reading, beside the search the page shows', async () => {
    parts.count.mockReturnValue(0);
    const view = await readSentenceView({
      search: { filters: { model: ['peugeot.206'] } },
      sentence: 'پژو ۲۰۶ خوشگل',
    });
    expect(view?.dropped.map((one) => one.words)).toEqual(['خوشگل']);
    expect(view?.refine).toBe(false);
  });

  test('a failure to read it is reported and answers nothing, so the page still shows its results', async () => {
    parts.lexiconFails = true;
    const view = await readSentenceView({ search: { filters: {} }, sentence: 'پراید' });
    expect(view).toBeUndefined();
    expect(reported.errors).toHaveLength(1);
  });
});
