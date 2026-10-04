// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { askSearchAction } from '@/features/search-understanding/search-understanding-actions';
import { ASK_FAILED_MESSAGE, ASK_IDLE, MAX_SENTENCE_CHARACTERS } from '@/lib/search-sentence';
import { recordedLines } from '@/server/observability/recording-logger';

// The action behind the one box (CS-111): who may ask, what it sends the buyer to, and what it says when it cannot read
// the sentence. The reading itself is tested with the real understanding in sentence-search.test.ts; here it is a stub
// that answers with an address, so what is under test is the action's own part: the checks, the links, the cut, the
// two ways of answering (the address for the script, a redirect for a form sent without it) and the one log line.

const reader = vi.hoisted(() => ({ destinationOfSentence: vi.fn() }));
const headerValues = vi.hoisted((): { current: Record<string, string> } => ({ current: {} }));

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers(headerValues.current)),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
vi.mock('@/features/search-understanding/server/sentence-reader', () => ({
  destinationOfSentence: reader.destinationOfSentence,
}));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

const SITE = 'http://127.0.0.1:3000';
const SAME_SITE = { origin: SITE, 'x-forwarded-host': '127.0.0.1:3000' };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

function destination(href: string, extra: object = {}) {
  return {
    href,
    understanding: { chips: [{}, {}], unused: [{}] },
    trace: { asked: null, cached: false },
    settled: { kept: [{}], dropped: [] },
    ...extra,
  };
}

beforeEach(() => {
  reader.destinationOfSentence.mockReset();
  headerValues.current = { ...SAME_SITE };
  recordedLines.length = 0;
});

describe('who may ask', () => {
  test('only a page of this site: a request from elsewhere is refused', async () => {
    headerValues.current = { origin: 'https://example.com', 'sec-fetch-site': 'cross-site' };
    await expect(askSearchAction(ASK_IDLE, form({ ask: 'پراید', by: 'script' }))).rejects.toThrow(
      'outside this site',
    );
    expect(reader.destinationOfSentence).not.toHaveBeenCalled();
  });
});

describe('what a sentence leads to', () => {
  test('the script is answered with the address, and navigates itself', async () => {
    reader.destinationOfSentence.mockResolvedValue(destination('/search?make=pride&ask=x'));
    const answer = await askSearchAction(ASK_IDLE, form({ ask: 'پراید', by: 'script' }));
    expect(answer).toEqual({ status: 'found', href: '/search?make=pride&ask=x' });
    expect(reader.destinationOfSentence).toHaveBeenCalledWith('پراید');
  });

  test('a form sent without the script is redirected by the server, once, to the same address', async () => {
    reader.destinationOfSentence.mockResolvedValue(destination('/search?make=pride&ask=x'));
    await expect(askSearchAction(ASK_IDLE, form({ ask: 'پراید' }))).rejects.toThrow(
      'NEXT_REDIRECT /search?make=pride&ask=x',
    );
  });

  test('an example chip’s sentence wins over what the box held', async () => {
    reader.destinationOfSentence.mockResolvedValue(destination('/search'));
    await askSearchAction(ASK_IDLE, form({ ask: 'سمند', example: 'خانوادگی زیر ۱ میلیارد', by: 'script' }));
    expect(reader.destinationOfSentence).toHaveBeenCalledWith('خانوادگی زیر ۱ میلیارد');
  });

  test('an empty box leads to every listing, and nothing is read', async () => {
    const answer = await askSearchAction(ASK_IDLE, form({ ask: '   ', by: 'script' }));
    expect(answer).toEqual({ status: 'found', href: '/search' });
    expect(reader.destinationOfSentence).not.toHaveBeenCalled();
  });

  test('a Divar link leads to its check in its canonical form, a link of another site as it was pasted', async () => {
    const divar = await askSearchAction(
      ASK_IDLE,
      form({ ask: 'نگاه کن https://divar.ir/v/پژو-۲۰۶/AbCdEf12', by: 'script' }),
    );
    expect(divar).toEqual({
      status: 'found',
      href: `/check?link=${encodeURIComponent('https://divar.ir/v/AbCdEf12')}`,
    });
    const other = await askSearchAction(ASK_IDLE, form({ ask: 'https://bama.ir/car/x', by: 'script' }));
    expect(other).toEqual({
      status: 'found',
      href: `/check?link=${encodeURIComponent('https://bama.ir/car/x')}`,
    });
    expect(reader.destinationOfSentence).not.toHaveBeenCalled();
  });

  test('control characters become spaces and a long text is cut before anything reads it', async () => {
    reader.destinationOfSentence.mockResolvedValue(destination('/search'));
    await askSearchAction(
      ASK_IDLE,
      form({
        ask: `پژو${String.fromCharCode(0)}۲۰۶${'ا'.repeat(MAX_SENTENCE_CHARACTERS * 2)}`,
        by: 'script',
      }),
    );
    const [read] = reader.destinationOfSentence.mock.calls[0] as [string];
    expect(read.startsWith('پژو ۲۰۶')).toBe(true);
    expect(Array.from(read)).toHaveLength(MAX_SENTENCE_CHARACTERS);
    expect(read).not.toContain(String.fromCharCode(0));
  });
});

describe('when the sentence cannot be read', () => {
  test('the buyer is told, the sentence stays theirs, and nothing is redirected', async () => {
    reader.destinationOfSentence.mockRejectedValue(new Error('the database did not answer'));
    const answer = await askSearchAction(ASK_IDLE, form({ ask: 'پراید  ۱۳۱', by: 'script' }));
    expect(answer).toEqual({ status: 'failed', message: ASK_FAILED_MESSAGE, sentence: 'پراید ۱۳۱' });
    // The same for a form sent without the script: a message, not an error screen and not a redirect.
    expect(await askSearchAction(ASK_IDLE, form({ ask: 'پراید' }))).toMatchObject({ status: 'failed' });
  });
});

describe('the log line', () => {
  test('says how the sentence was read in counts, and holds none of its words', async () => {
    reader.destinationOfSentence.mockResolvedValue(destination('/search?make=pride&ask=x'));
    await askSearchAction(ASK_IDLE, form({ ask: 'پراید ۱۳۱ خوشگل', by: 'script' }));
    const lines = recordedLines.filter((line) => line.message === 'sentence searched');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.fields).toMatchObject({
      component: 'search-understanding',
      chips: 2,
      unusedGroups: 1,
      wordsKept: 1,
      wordsDropped: 0,
    });
    const written = JSON.stringify(recordedLines);
    for (const word of ['پراید', '۱۳۱', 'خوشگل']) expect(written).not.toContain(word);
  });
});
