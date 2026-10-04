'use server';

import type { Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { destinationOfSentence } from '@/features/search-understanding/server/sentence-reader';
import { askFormSchema } from '@/features/search-understanding/understanding-schemas';
import { canonicalDivarAddress, readPastedLink } from '@/lib/pasted-link';
import { SEARCH_PATH } from '@/lib/return-path';
import { ASK_FAILED_MESSAGE, tidySentence, type AskState } from '@/lib/search-sentence';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// The one step of the smart search (CS-111, ADR-0043): the box's sentence in, the results out. The action reads the
// sentence by code on the server, settles the words no filter could name against the live counts, and answers with the
// canonical address of the search with the sentence kept in it; the buyer lands on the results with the filters applied
// and shown, with nothing to confirm. The page's script navigates there itself (a client navigation keeps the page it
// leaves, with what was typed in it, for the back button, and keeps focus in the box on the search page); a form sent
// before the script has loaded is answered with a redirect instead, so the box works with no script at all. It is a
// public POST endpoint like every action: it checks that the request came from a page of this site, parses everything
// it is given, and writes one log line of counts and reasons, never the sentence. A redirect comes last, outside any
// try; a sentence that could not be read comes back as a message and stays in the box. A pasted link goes to its check.

const log = logger.child({ component: 'search-understanding' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that searches by sentence came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

function failed(sentence: string): AskState {
  return { status: 'failed', message: ASK_FAILED_MESSAGE, sentence };
}

export async function askSearchAction(_previous: AskState, formData: FormData): Promise<AskState> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const parsed = askFormSchema.safeParse({
    ask: formData.get('ask') ?? undefined,
    example: formData.get('example') ?? undefined,
    by: formData.get('by') ?? undefined,
  });
  const typed = parsed.success ? tidySentence(parsed.data.example ?? parsed.data.ask ?? '') : '';
  if (!parsed.success) return failed(typed);

  let destination: string;
  const link = readPastedLink(typed);
  if (typed === '') {
    destination = SEARCH_PATH;
  } else if (link.kind === 'divar_listing') {
    destination = `/check?link=${encodeURIComponent(canonicalDivarAddress(link.token))}`;
  } else if (link.kind === 'other_site' || link.kind === 'divar_other') {
    destination = `/check?link=${encodeURIComponent(typed)}`;
  } else {
    const started = performance.now();
    try {
      const read = await destinationOfSentence(typed);
      log.info('sentence searched', {
        askedModel: read.trace.asked,
        cached: read.trace.cached,
        chips: read.understanding.chips.length,
        unusedGroups: read.understanding.unused.length,
        wordsKept: read.settled.kept.length,
        wordsDropped: read.settled.dropped.length,
        textSearch: read.understanding.textSearch,
        durationMs: Math.round(performance.now() - started),
      });
      destination = read.href;
    } catch (error) {
      captureError(error, { message: 'reading a sentence for the search failed' });
      return failed(typed);
    }
  }
  if (parsed.data.by === 'script') return { status: 'found', href: destination };
  redirect(destination as Route);
}
