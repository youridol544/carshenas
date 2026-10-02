import type { ModelStep } from '@carshenas/search/understand/understand';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { answerUnderstand } from '@/features/search-understanding/server/understand-route';
import type { UnderstandResponse } from '@/features/search-understanding/understanding-types';
import { recordedLines } from '@/server/observability/recording-logger';

// POST /api/search/understand without a database or a network: the lexicon is the small fixture catalogue, the
// master switch and the model's step are replaced. What is under test is the route: who may ask, what it refuses, what
// it answers with the switch off (the default) and on, and that its one log line carries no sentence.

const settings = vi.hoisted(() => ({ ai: false }));
const paid = vi.hoisted(() => ({ step: vi.fn<ModelStep>() }));

vi.mock('@/server/env', () => ({
  env: {
    get searchUnderstandingAi() {
      return settings.ai;
    },
  },
}));
vi.mock('@/features/search-understanding/server/lexicon', async () => {
  const { fixtureLexicon: build } = await import('@carshenas/search/understand/fixture');
  const lexicon = build();
  return { currentLexicon: () => Promise.resolve(lexicon) };
});
vi.mock('@/features/search-understanding/server/paid-step', () => ({
  paidModelStep: () => paid.step,
}));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

const SITE = 'http://127.0.0.1:3000';

function ask(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return answerUnderstand(
    new Request(`${SITE}/api/search/understand`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: SITE,
        'x-forwarded-host': '127.0.0.1:3000',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

async function understood(q: string): Promise<UnderstandResponse> {
  const response = await ask({ q });
  expect(response.status).toBe(200);
  return (await response.json()) as UnderstandResponse;
}

beforeEach(() => {
  settings.ai = false;
  paid.step.mockReset();
  recordedLines.length = 0;
});

describe('who may ask and what is refused', () => {
  test('only a page of this site: a request from elsewhere is refused with no body', async () => {
    const response = await ask(
      { q: 'پژو ۲۰۶' },
      { origin: 'https://example.com', 'sec-fetch-site': 'cross-site' },
    );
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('');
  });

  test('a request with no origin at all is refused too', async () => {
    const response = await answerUnderstand(
      new Request(`${SITE}/api/search/understand`, {
        method: 'POST',
        body: JSON.stringify({ q: 'پژو ۲۰۶' }),
      }),
    );
    expect(response.status).toBe(403);
  });

  test.each([
    ['not JSON', 'not json'],
    ['no sentence', {}],
    ['an empty sentence', { q: '   ' }],
    ['a sentence that is not text', { q: 5 }],
    ['a field that is not known', { q: 'پژو', extra: 1 }],
    ['a sentence over 1,000 characters', { q: 'پژو '.repeat(300) }],
  ])('%s is 400 with a Farsi message and nothing cached', async (_name, body) => {
    const response = await ask(body);
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()) as { message: string }).toEqual({ message: 'جمله‌ی جست‌وجو را بنویسید.' });
  });

  test('a body of more than 4,096 characters is 413 before it is read as JSON', async () => {
    const response = await ask(JSON.stringify({ q: 'پژو', padding: 'x'.repeat(5_000) }));
    expect(response.status).toBe(413);
  });
});

describe('with the master switch off, which is its default', () => {
  test('code alone answers, says so, and the sentence is understood without any model', async () => {
    const { mode, understanding } = await understood('پژو ۲۰۶ زیر ۵۰۰ میلیون');
    expect(mode).toBe('code_only');
    expect(understanding.search.filters).toEqual({ model: ['peugeot.206'], price: { max: 500_000_000 } });
    expect(understanding.modelUsed).toBe(false);
    expect(understanding.degraded).toBeNull();
    expect(paid.step).not.toHaveBeenCalled();
  });

  test('a sentence code cannot settle keeps its unread words and says the model is off', async () => {
    const { mode, understanding } = await understood('پژو ۲۰۶ خوشگل');
    expect(mode).toBe('code_only');
    expect(understanding.search.filters).toEqual({ model: ['peugeot.206'] });
    expect(understanding.unused.map((group) => group.words)).toEqual(['خوشگل']);
    expect(understanding.degraded?.reason).toBe('switched_off');
    expect(paid.step).not.toHaveBeenCalled();
  });

  test('the answer is never cached by a browser or a proxy', async () => {
    const response = await ask({ q: 'پژو ۲۰۶' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('with the master switch on', () => {
  test('a sentence code settles never reaches the model', async () => {
    settings.ai = true;
    const { mode, understanding } = await understood('پژو ۲۰۶ زیر ۵۰۰ میلیون');
    expect(mode).toBe('with_model');
    expect(understanding.modelUsed).toBe(false);
    expect(paid.step).not.toHaveBeenCalled();
  });

  test('a sentence code cannot settle is put to the model, and its reading is applied', async () => {
    settings.ai = true;
    paid.step.mockResolvedValue({
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
            strength: 'inferred',
          },
        ],
        instructions_to_ai_evidence: '',
        instructions_to_ai: false,
      },
    });
    const { mode, understanding } = await understood('پژو ۲۰۶ خوشگل');
    expect(mode).toBe('with_model');
    expect(paid.step).toHaveBeenCalledTimes(1);
    expect(understanding.modelUsed).toBe(true);
    expect(understanding.search.filters).toEqual({ model: ['peugeot.206'], paint_free: true });
    expect(understanding.unused).toEqual([]);
  });

  test.each(['visitor_limit', 'daily_cap', 'busy', 'timeout', 'unavailable'] as const)(
    'a model that is held back for %s leaves code’s own answer and says why',
    async (reason) => {
      settings.ai = true;
      paid.step.mockResolvedValue({ status: 'unavailable', reason });
      const { mode, understanding } = await understood('پژو ۲۰۶ خوشگل');
      expect(mode).toBe('with_model');
      expect(understanding.degraded?.reason).toBe(reason);
      expect(understanding.search.filters).toEqual({ model: ['peugeot.206'] });
      expect(understanding.unused.map((group) => group.words)).toEqual(['خوشگل']);
    },
  );

  test('the switch is read for every question: turned off, the next one is code alone', async () => {
    settings.ai = true;
    paid.step.mockResolvedValue({ status: 'unavailable', reason: 'timeout' });
    expect((await understood('پژو ۲۰۶ خوشگل')).mode).toBe('with_model');
    settings.ai = false;
    expect((await understood('پژو ۲۰۶ خوشگل')).mode).toBe('code_only');
    expect(paid.step).toHaveBeenCalledTimes(1);
  });
});

describe('the log line', () => {
  test('says how the sentence was read in counts and reasons, and holds none of its words', async () => {
    const sentence = 'پژو ۲۰۶ خوشگل زیر ۴۱۷ میلیون';
    await understood(sentence);
    const lines = recordedLines.filter((line) => line.message === 'sentence understood');
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(line?.level).toBe('info');
    expect(line?.fields).toMatchObject({
      component: 'search-understanding',
      mode: 'code_only',
      askedModel: 'left',
      answered: 'switched_off',
      cached: false,
      textSearch: false,
    });
    const written = JSON.stringify(recordedLines);
    for (const word of ['خوشگل', '۲۰۶', '417', '۴۱۷', 'پژو']) expect(written).not.toContain(word);
  });
});
