// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  leftOut,
  MAX_TEXT_GROUPS,
  sentenceAddress,
  sentenceView,
  settleReading,
  type Counter,
} from '@/features/search-understanding/server/sentence-search';
import { SENTENCE_PARAM } from '@/lib/search-sentence';
import { canonical, fromSearchParams, type Search } from '@carshenas/search/search';
import { fixtureLexicon } from '@carshenas/search/understand/fixture';
import { NOTE_TEXT } from '@carshenas/search/understand/merge';
import { understandQuery, type ModelStep } from '@carshenas/search/understand/understand';

// A sentence as one search (CS-111, ADR-0043): the unread words are looked for in the listings' text and dropped, step by
// step, when that would leave nothing; the filters never are. The count is a function the test gives, so each rule is
// shown on its own, and the sentences are read by the real understanding over the test catalogue.

const lexicon = fixtureLexicon();

async function read(sentence: string, model?: ModelStep) {
  return understandQuery(sentence, {
    lexicon,
    solarYear: 1405,
    ...(model === undefined ? { withoutModel: 'switched_off' as const } : { model }),
  });
}

/** A count that answers from a table of what each search would find, and remembers what it was asked. */
function counting(find: (search: Search) => number) {
  const asked: Search[] = [];
  const count: Counter = (search) => {
    asked.push(search);
    return Promise.resolve(find(search));
  };
  return { count, asked };
}

/** Counts by the words looked for: `byWords` lists them, `base` is what the filters alone find. */
function byWords(base: number, byText: Readonly<Record<string, number>>) {
  return counting((search) => (search.q === undefined ? base : (byText[search.q] ?? 0)));
}

describe('the search a reading settles to', () => {
  test('a sentence with no unread words is its filters, and nothing is counted', async () => {
    const { understanding } = await read('پژو ۲۰۶ زیر ۷۰۰ میلیون');
    const { count, asked } = counting(() => 5);
    const settled = await settleReading(understanding, count);
    expect(settled.search).toEqual({
      filters: { model: ['peugeot.206'], price: { max: 700_000_000 } },
    });
    expect(settled.kept).toEqual([]);
    expect(settled.dropped).toEqual([]);
    expect(asked).toEqual([]);
  });

  test('an unread word that finds listings is looked for in their text and kept', async () => {
    const { understanding } = await read('پژو ۲۰۶ خوشگل');
    const { count } = byWords(10, { خوشگل: 3 });
    const settled = await settleReading(understanding, count);
    expect(settled.search).toEqual({ filters: { model: ['peugeot.206'] }, q: 'خوشگل' });
    expect(settled.dropped).toEqual([]);
  });

  test('an unread word that would leave nothing is dropped, and the filters stay', async () => {
    const { understanding } = await read('پژو ۲۰۶ خوشگل');
    const { count } = byWords(10, { خوشگل: 0 });
    const settled = await settleReading(understanding, count);
    expect(settled.search).toEqual({ filters: { model: ['peugeot.206'] } });
    expect(settled.dropped.map((group) => group.words)).toEqual(['خوشگل']);
    expect(settled.kept).toEqual([]);
  });

  test('of two unread groups the one whose going leaves more listings goes first, and the other is kept', async () => {
    const { understanding } = await read('خوشگل پژو ۲۰۶ عالی');
    const { count } = byWords(10, { 'خوشگل عالی': 0, خوشگل: 2, عالی: 5 });
    const settled = await settleReading(understanding, count);
    expect(settled.search.q).toBe('عالی');
    expect(settled.dropped.map((group) => group.words)).toEqual(['خوشگل']);
  });

  test('on a tie the group written later goes', async () => {
    const { understanding } = await read('خوشگل پژو ۲۰۶ عالی');
    const { count } = byWords(10, { 'خوشگل عالی': 0, خوشگل: 3, عالی: 3 });
    const settled = await settleReading(understanding, count);
    expect(settled.search.q).toBe('خوشگل');
    expect(settled.dropped.map((group) => group.words)).toEqual(['عالی']);
  });

  test('when no single drop helps the group written last goes and the rest is tried again', async () => {
    const { understanding } = await read('خوشگل پژو ۲۰۶ عالی زیر ۱ میلیارد شیک');
    const { count } = byWords(10, { خوشگل: 4 });
    const settled = await settleReading(understanding, count);
    expect(settled.kept.map((group) => group.words)).toEqual(['خوشگل']);
    expect(settled.dropped.map((group) => group.words)).toEqual(['عالی', 'شیک']);
    expect(settled.search.q).toBe('خوشگل');
    expect(settled.search.filters).toEqual({ model: ['peugeot.206'], price: { max: 1_000_000_000 } });
  });

  test('every group dropped is still a search that finds listings: the filters', async () => {
    const { understanding } = await read('خوشگل پژو ۲۰۶ عالی');
    const { count } = byWords(10, {});
    const settled = await settleReading(understanding, count);
    expect(settled.search).toEqual({ filters: { model: ['peugeot.206'] } });
    expect(settled.kept).toEqual([]);
    expect(settled.dropped).toHaveLength(2);
  });

  test('when the filters alone find nothing the words are kept as written, and nothing is dropped', async () => {
    const { understanding } = await read('پژو ۲۰۶ خوشگل');
    const { count, asked } = byWords(0, {});
    const settled = await settleReading(understanding, count);
    expect(settled.search).toEqual({ filters: { model: ['peugeot.206'] }, q: 'خوشگل' });
    expect(settled.dropped).toEqual([]);
    // One count told it: the filters are not touched, so there is nothing more to ask.
    expect(asked).toHaveLength(1);
  });

  test('a sentence that read nothing is looked for as text, and with no listings found shows everything', async () => {
    const { understanding } = await read('asdfgh');
    expect(understanding.search.q).toBe('asdfgh');
    const { count } = byWords(10, { asdfgh: 0 });
    const settled = await settleReading(understanding, count);
    expect(settled.search).toEqual({ filters: {} });
    expect(settled.dropped.map((group) => group.words)).toEqual(['asdfgh']);
  });

  test('a wish no filter serves is looked for in the text like an unread word', async () => {
    const { understanding } = await read('ماشین کم مصرف');
    const { count } = byWords(10, { 'کم مصرف': 2 });
    const settled = await settleReading(understanding, count);
    expect(settled.search).toEqual({ filters: {}, q: 'کم مصرف' });
  });

  test('a city outside the market and a number no car has are not looked for', async () => {
    const { count, asked } = counting(() => 5);
    for (const sentence of ['پژو ۲۰۶ اصفهان', 'پژو ۲۰۶ قیمت ۱ تومان']) {
      const { understanding } = await read(sentence);
      const settled = await settleReading(understanding, count);
      expect(settled.search).toEqual({ filters: { model: ['peugeot.206'] } });
    }
    expect(asked).toEqual([]);
  });

  test('no more than the first groups are put to the count', async () => {
    const { understanding } = await read('الف پژو ۲۰۶ ب زیر ۱ میلیارد ج بدون رنگ د سفید ه');
    expect(understanding.unused).toHaveLength(MAX_TEXT_GROUPS + 1);
    const { count } = byWords(10, {});
    const settled = await settleReading(understanding, count);
    expect([...settled.kept, ...settled.dropped]).toHaveLength(MAX_TEXT_GROUPS);
  });

  test('the address holds the filters, the words that were kept and the sentence', async () => {
    const sentence = 'پژو ۲۰۶ خوشگل';
    const { understanding } = await read(sentence);
    const { count } = byWords(10, { خوشگل: 3 });
    const settled = await settleReading(understanding, count);
    const address = sentenceAddress(settled, sentence);
    const params = new URL(address, 'https://x.test').searchParams;
    expect(params.get(SENTENCE_PARAM)).toBe(sentence);
    expect(fromSearchParams(params).search).toEqual(settled.search);
  });
});

describe('what the page says about the words that are not in its search', () => {
  const onPage: Search = { filters: { model: ['peugeot.206'] } };

  test('words that would empty the results are said, each with the search that puts it back', async () => {
    const { understanding } = await read('پژو ۲۰۶ خوشگل');
    const { count } = byWords(10, { خوشگل: 0 });
    const said = await leftOut(onPage, understanding, count);
    expect(said).toEqual([{ words: 'خوشگل', put: canonical({ ...onPage, q: 'خوشگل' }) }]);
  });

  test('a word the buyer took off themselves, which would find listings, is not said', async () => {
    const { understanding } = await read('پژو ۲۰۶ خوشگل');
    const { count } = byWords(10, { خوشگل: 3 });
    expect(await leftOut(onPage, understanding, count)).toEqual([]);
  });

  test('a word the search already looks for is not said, and nothing is counted for it', async () => {
    const { understanding } = await read('پژو ۲۰۶ خوشگل');
    const { count, asked } = byWords(10, { خوشگل: 0 });
    expect(await leftOut({ ...onPage, q: 'خوشگل' }, understanding, count)).toEqual([]);
    expect(asked).toEqual([]);
  });

  test('a word added to words already looked for is put after them', async () => {
    const { understanding } = await read('خوشگل پژو ۲۰۶ عالی');
    const { count } = byWords(10, { 'خوشگل عالی': 0 });
    const said = await leftOut({ ...onPage, q: 'خوشگل' }, understanding, count);
    expect(said.map((one) => one.put.q)).toEqual(['خوشگل عالی']);
  });
});

const WEAK_READING: ModelStep = () =>
  Promise.resolve({
    status: 'ok',
    cached: false,
    reading: {
      readings: [
        {
          phrase: 'خوشگل',
          target: 'filter:paint_free',
          values: [],
          number_text: '',
          number_text_to: '',
          relation: 'not_applicable',
          strength: 'weak',
        },
      ],
      instructions_to_ai_evidence: '',
      instructions_to_ai: false,
    },
  });

describe('the lines under the box', () => {
  test('the notes are the understanding’s own, and a number no car has is said once', async () => {
    const outside = await read('پژو ۲۰۶ اصفهان');
    const view = await sentenceView({
      search: { filters: { model: ['peugeot.206'] } },
      ...outside,
      modelAvailable: false,
      count: () => Promise.resolve(5),
    });
    expect(view.notes).toEqual(outside.understanding.notes.map((note) => note.text));
    expect(view.notes[0]).toContain('اصفهان');

    const absurd = await read('پژو ۲۰۶ قیمت ۱ تومان');
    const second = await sentenceView({
      search: { filters: { model: ['peugeot.206'] } },
      ...absurd,
      modelAvailable: false,
      count: () => Promise.resolve(5),
    });
    expect(second.notes).toHaveLength(1);
    expect(second.notes[0]).toContain('قیمت ۱ تومان');
  });

  test('groups beyond the ones looked for are named in one line', async () => {
    const many = await read('الف پژو ۲۰۶ ب زیر ۱ میلیارد ج بدون رنگ د سفید ه');
    const view = await sentenceView({
      search: many.understanding.search,
      ...many,
      modelAvailable: false,
      count: () => Promise.resolve(5),
    });
    expect(view.notes.at(-1)).toContain('«ه»');
  });

  test('a make nobody collects keeps its Persian name for the page, which has no listings to name it from', async () => {
    const reading = await read('مزدا ۳');
    const view = await sentenceView({
      search: { filters: { make: ['mazda'] } },
      ...reading,
      modelAvailable: false,
      count: () => Promise.resolve(0),
    });
    expect(view.labels['make:mazda']).toBe('مزدا');
    // What the note says after the name, read from the constant: the name is the lexicon's to choose.
    expect(view.notes[0]).toContain(NOTE_TEXT.notTracked('').split('»')[1] ?? '');
  });

  test('a model is asked in the background only while the address is what the code read', async () => {
    const reading = await read('پژو ۲۰۶ خوشگل');
    const { count } = byWords(10, { خوشگل: 0 });
    const common = { ...reading, modelAvailable: true, count };
    // What the action would have sent the buyer to: the filters, the word dropped.
    const landed: Search = { filters: { model: ['peugeot.206'] } };
    expect((await sentenceView({ ...common, search: landed })).refine).toBe(true);
    // The buyer took the model off, or added a filter: their choices stand.
    expect((await sentenceView({ ...common, search: { filters: {} } })).refine).toBe(false);
    expect(
      (await sentenceView({ ...common, search: { filters: { model: ['peugeot.206'], deal: 'good' } } }))
        .refine,
    ).toBe(false);
    // The switch is off: nothing is asked, whatever the address.
    expect((await sentenceView({ ...common, modelAvailable: false, search: landed })).refine).toBe(false);
  });

  test('a sentence the code settled, or a model has already read, is not asked about again', async () => {
    const settled = await read('پژو ۲۰۶ زیر ۷۰۰ میلیون');
    const search: Search = { filters: { model: ['peugeot.206'], price: { max: 700_000_000 } } };
    const count: Counter = () => Promise.resolve(5);
    expect((await sentenceView({ ...settled, search, modelAvailable: true, count })).refine).toBe(false);
    const modelRead = await read('پژو ۲۰۶ خوشگل', WEAK_READING);
    expect(modelRead.understanding.modelUsed).toBe(true);
    expect(
      (
        await sentenceView({
          ...modelRead,
          search: { filters: { model: ['peugeot.206'] } },
          modelAvailable: true,
          count,
        })
      ).refine,
    ).toBe(false);
  });

  test('a weak reading is a suggestion that adds its filter to the search the page shows, never applied', async () => {
    const reading = await read('پژو ۲۰۶ خوشگل', WEAK_READING);
    expect(reading.understanding.suggestions).toHaveLength(1);
    const search: Search = { filters: { model: ['peugeot.206'], deal: 'good' } };
    const view = await sentenceView({
      ...reading,
      search,
      modelAvailable: true,
      count: () => Promise.resolve(5),
    });
    expect(view.suggestions).toHaveLength(1);
    expect(view.suggestions[0]?.add).toEqual(
      canonical({ ...search, filters: { ...search.filters, paint_free: true } }),
    );
    const already = await sentenceView({
      ...reading,
      search: { filters: { model: ['peugeot.206'], paint_free: true } },
      modelAvailable: true,
      count: () => Promise.resolve(5),
    });
    expect(already.suggestions).toEqual([]);
  });
});
