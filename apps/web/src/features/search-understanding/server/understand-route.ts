import 'server-only';
import { currentLexicon } from '@/features/search-understanding/server/lexicon';
import { paidModelStep } from '@/features/search-understanding/server/paid-step';
import { understandSentence } from '@/features/search-understanding/server/understand-search';
import { understandRequestSchema } from '@/features/search-understanding/understanding-schemas';
import type { UnderstandError } from '@/features/search-understanding/understanding-types';
import { clientAddress } from '@/server/auth/client-address';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { env } from '@/server/env';
import { logger } from '@/server/observability/logger';

// POST /api/search/understand with {"q": "<the sentence as typed>"}: plain-Farsi search's answer, the search the words
// mean and everything a buyer needs to check and change it (chips, suggestions, the words nobody read, notices). A POST
// with a JSON body, never a query string, so what was typed never lands in a request log line; answered only to pages
// of this site, never cached. With the master switch off (SEARCH_UNDERSTANDING_AI, its default) code alone answers: no
// key, no network, no cost; with it on, a model reads only what code could not settle, held to the visitor limit, the
// day's cap, the answer cache and a deadline, and the answer says `mode`. The one log line has counts and reasons,
// never the sentence, an address or an answer.

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_CHARACTERS = 4_096;

const EMPTY = 'جمله‌ی جست‌وجو را بنویسید.';
const TOO_LONG = 'این جمله خیلی بلند است؛ کوتاه‌ترش کنید.';

const log = logger.child({ component: 'search-understanding' });

function refuse(status: number, message?: string): Response {
  return message === undefined
    ? new Response(null, { status, headers: NO_STORE })
    : Response.json({ message } satisfies UnderstandError, { status, headers: NO_STORE });
}

export async function answerUnderstand(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request.headers)) return refuse(403);
  const text = await request.text();
  if (text.length > MAX_BODY_CHARACTERS) return refuse(413, TOO_LONG);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return refuse(400, EMPTY);
  }
  const parsed = understandRequestSchema.safeParse(body);
  if (!parsed.success) return refuse(400, EMPTY);

  const started = performance.now();
  // The switch is read for every question, so turning it off stops the next one, with no restart.
  const { response, trace } = await understandSentence(parsed.data.q, {
    lexicon: currentLexicon,
    ...(env.searchUnderstandingAi
      ? { model: paidModelStep({ address: clientAddress(request.headers) }) }
      : {}),
  });
  const { understanding } = response;
  log.info('sentence understood', {
    mode: response.mode,
    askedModel: trace.asked,
    answered: trace.answered,
    cached: trace.cached,
    chips: understanding.chips.length,
    suggestions: understanding.suggestions.length,
    unusedGroups: understanding.unused.length,
    textSearch: understanding.textSearch,
    durationMs: Math.round(performance.now() - started),
  });
  return Response.json(response, { headers: NO_STORE });
}
