import 'server-only';
import { isAssumedMileage } from '@carshenas/search/mileage-reading';
import { readListingPage } from '@/features/listing/server/listing-page-data';
import type { CheckAnswer } from '@/features/check-link/check-link-types';
import type { SimilarListing } from '@/features/listing/listing-types';
import { searchListings } from '@/features/search/server/search-queries';
import { database, readDatabase } from '@/server/db/database';
import { recordPasteRequest, type PasteAnswer } from '@/server/db/sql-helpers';
import { currentClientAddress } from '@/server/auth/request-address';
import { captureError, logger } from '@/server/observability/logger';
import { takeToken } from '@/server/token-bucket';

// A pasted Divar link, answered from our own data and nothing else (CS-65; ADR-0008; the owner's decision of 2026-10-01
// that the crawl is paused): the token is looked up in `listing`, and what the listing page shows (readListingPage, CS-64,
// which rates a listing the daily run did not rate through the database function paste_rate_listing) is the answer. Nothing
// is fetched from Divar, ever: a token we do not know is kept as a wanted link for the crawler, and the buyer is told so.
// The database decides what the request adds up to (record_paste_request: demand for the listing's model, or a wanted link,
// with its cap), and a failure to record never costs the buyer the answer.

const SOURCE = 'divar';
const SUGGESTION_COUNT = 3;
// A client address may check thirty links at once and one more every two seconds (ADR-0034; per process): a loop over
// tokens would otherwise fill the wanted links and the demand counts, and read the database as fast as it can be asked.
const CHECK_RULE = { capacity: 30, perSecond: 0.5 } as const;

async function findListingId(token: string): Promise<number | undefined> {
  const row = await readDatabase()
    .selectFrom('listing')
    .select('id')
    .where('source_id', '=', SOURCE)
    .where('source_listing_key', '=', token)
    .executeTakeFirst();
  return row?.id;
}

async function record(token: string): Promise<PasteAnswer | null> {
  try {
    const row = await database()
      .selectNoFrom(recordPasteRequest(SOURCE, token).as('answer'))
      .executeTakeFirstOrThrow();
    return row.answer;
  } catch (error) {
    captureError(error, { message: 'recording a pasted link failed', fields: { component: 'check-link' } });
    return null;
  }
}

/** The best-rated listings, of one model when a key is given: what a dead end offers instead. */
async function suggest(modelKey: string | null): Promise<readonly SimilarListing[]> {
  const result = await searchListings({
    search: { filters: modelKey === null ? {} : { model: [modelKey] } },
    limit: SUGGESTION_COUNT,
    quiet: true,
  });
  if (result.status !== 'ok') return [];
  return result.page.results.map((card) => ({
    id: card.id,
    name: card.name,
    modelYearSh: card.modelYearSh,
    mileageKm: card.mileageKm,
    mileageAssumed: isAssumedMileage(card.mileageReading),
    askingPriceToman: card.askingPriceToman,
    dealRating: card.valuation?.dealRating ?? null,
    priceGapPct: card.valuation?.priceGapPct ?? null,
    photoUrl: card.photo?.thumbnailUrl ?? card.photo?.url ?? null,
  }));
}

/** What a Divar token comes to. A database failure throws: the page's error state, with its reference code. */
export async function answerPastedToken(token: string): Promise<CheckAnswer> {
  const started = performance.now();
  if (!takeToken('check-link', await currentClientAddress(), CHECK_RULE)) {
    logger.info('pasted link answered', { outcome: 'limited' });
    return { kind: 'limited' };
  }
  const id = await findListingId(token);
  const [result, recorded] = await Promise.all([
    id === undefined ? ({ status: 'missing' } as const) : readListingPage(id),
    record(token),
  ]);
  let answer: CheckAnswer;
  if (result.status === 'missing') {
    answer = { kind: 'not_found', recorded: recorded === 'wanted', suggestions: await suggest(null) };
  } else if (result.page.listing.status !== 'active') {
    answer = {
      kind: 'off_market',
      page: result.page,
      suggestions: await suggest(result.page.listing.model?.key ?? null),
    };
  } else if (result.page.listing.priceType === null) {
    // Seen on a list page only: its details (and so its price) are not read, and its model is not one we read in depth.
    answer = {
      kind: 'unread',
      listing: result.page.listing,
      counted: recorded === 'counted',
      suggestions: await suggest(result.page.listing.model?.key ?? null),
    };
  } else {
    answer = { kind: 'found', page: result.page };
  }
  logger.info('pasted link answered', {
    outcome: answer.kind,
    recorded,
    rated: answer.kind === 'found' && (answer.page.valuation?.dealRating ?? null) !== null,
    milliseconds: Math.round(performance.now() - started),
  });
  return answer;
}
