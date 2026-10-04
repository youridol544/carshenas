import 'server-only';
import { isAssumedMileage } from '@carshenas/search/mileage-reading';
import type { Lexicon } from '@carshenas/search/understand/lexicon';
import { nameOnScreen } from '@carshenas/locale/names';
import { coverageOf, readCarOfLink, type CarOfLink } from '@/features/check-link/car-reading';
import type {
  AskedModel,
  CarName,
  CheckAnswer,
  ChoosableModel,
  CoveredCars,
  ModelRequest,
} from '@/features/check-link/check-link-types';
import type { SimilarListing } from '@/features/listing/listing-types';
import { readListingPage } from '@/features/listing/server/listing-page-data';
import { searchListings } from '@/features/search/server/search-queries';
import { currentLexicon } from '@/features/search-understanding/server/lexicon';
import { canonicalDivarAddress } from '@/lib/pasted-link';
import { modelHref } from '@/lib/model-address';
import { currentAccount } from '@/server/auth/current-account';
import { currentClientAddress } from '@/server/auth/request-address';
import {
  readCatalogueModel,
  readCoveredModels,
  readMakeModels,
  readModelRequest,
  readModelRequests,
  type CatalogueModel,
} from '@/server/db/coverage-reads';
import { readCrawlPaused } from '@/server/db/crawl-request-reads';
import { database, readDatabase } from '@/server/db/database';
import { recordPasteRequest, type PasteAnswer } from '@/server/db/sql-helpers';
import { captureError, logger } from '@/server/observability/logger';
import { takeToken } from '@/server/token-bucket';

// A pasted Divar link, answered from our own data and nothing else (CS-65, CS-115; ADR-0008; ADR-0034; ADR-0046): the token
// is looked up in `listing`, and what the listing page shows (readListingPage, CS-64, which rates a listing the daily run
// did not rate through the database function paste_rate_listing) is the answer. Nothing is fetched from Divar, ever. For
// an ad we have not read, the car is the listing's own model when we know the listing, else the one the catalogue's names
// read in the title of the link (car-reading.ts, in code, never asking Divar), and the answer says whether Carshenas reads
// that car: queued when it does, outside (the limit, the cars it reads, one way forward) when it does not, unreadable when
// the link does not say which car it is. The database decides what the request adds up to (record_paste_request: demand for
// a model, or a wanted link, with its cap), and a failure to record never costs the buyer the answer.

const SOURCE = 'divar';
const SUGGESTION_COUNT = 3;
// A client address may check thirty links at once and one more every two seconds (ADR-0034; per process): a loop over
// tokens would otherwise fill the wanted links and the demand counts, and read the database as fast as it can be asked.
const CHECK_RULE = { capacity: 30, perSecond: 0.5 } as const;

export type PastedListing = { readonly token: string; readonly slug: string | null };

async function findListingId(token: string): Promise<number | undefined> {
  const row = await readDatabase()
    .selectFrom('listing')
    .select('id')
    .where('source_id', '=', SOURCE)
    .where('source_listing_key', '=', token)
    .executeTakeFirst();
  return row?.id;
}

async function record(token: string, titledModelId: number | null): Promise<PasteAnswer | null> {
  try {
    const row = await database()
      .selectNoFrom(recordPasteRequest(SOURCE, token, titledModelId).as('answer'))
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

function carNameOf(model: CatalogueModel): CarName {
  return {
    key: model.key,
    name: model.name,
    href: modelHref({ makeSlug: model.makeKey, slug: model.modelSlug }),
  };
}

function coveredCars(models: readonly CatalogueModel[]): CoveredCars {
  return models.map(carNameOf);
}

/**
 * The cars Carshenas reads in depth, for the page that asks for a link (the limit stated before a buyer pastes). A read that
 * fails leaves the list out and reports: the instructions on that page must never depend on the database answering.
 */
export async function readCoveredCars(): Promise<CoveredCars> {
  try {
    return coveredCars(await readCoveredModels(readDatabase()));
  } catch (error) {
    captureError(error, { message: 'reading the covered cars failed', fields: { component: 'check-link' } });
    return [];
  }
}

/** What the viewer's request for the model comes to: the state, whether they asked, and what they may do. */
async function requestOf(accountId: number | null, modelId: number): Promise<ModelRequest> {
  const row = await readModelRequest(readDatabase(), accountId, modelId);
  return {
    status: row.status,
    mine: row.fileId !== null,
    reason: row.reason,
    fileId: row.fileId,
  };
}

/** What the catalogue says of a link's listing when we have it: its own model and its address on the source. */
export type KnownListing = { readonly modelKey: string | null; readonly url: string };

/** The listing of a token, with its catalogue model, without reading its page (what the ask needs). */
export async function findKnownListing(token: string): Promise<KnownListing | null> {
  const row = await readDatabase()
    .selectFrom('listing as l')
    .leftJoin('model as m', 'm.id', 'l.model_id')
    .leftJoin('make as k', 'k.id', 'm.make_id')
    .select(['l.url', 'k.slug as make_slug', 'm.slug as model_slug'])
    .where('l.source_id', '=', SOURCE)
    .where('l.source_listing_key', '=', token)
    .executeTakeFirst();
  if (row === undefined) return null;
  return {
    modelKey: row.make_slug === null || row.model_slug === null ? null : `${row.make_slug}.${row.model_slug}`,
    url: row.url ?? '',
  };
}

export type LinkCar = {
  readonly car: CarOfLink;
  /** The models read in depth now, most listed first. */
  readonly covered: readonly CatalogueModel[];
  /** The catalogue's names, read only when the car was told from a title. */
  readonly lexicon: Lexicon | null;
};

/** The car a link is about: a known listing's own model, else the one its title names, and the cars Carshenas reads. */
export async function readLinkCar(listing: PastedListing, known: KnownListing | null): Promise<LinkCar> {
  const covered = await readCoveredModels(readDatabase());
  const coverage = coverageOf(covered.map((model) => model.key));
  if (known?.modelKey != null) {
    return {
      car: { kind: 'model', modelKey: known.modelKey, covered: coverage.modelKeys.has(known.modelKey) },
      covered,
      lexicon: null,
    };
  }
  // The short form of the link has no title: nothing to read, so the catalogue's names are not even loaded.
  if (listing.slug === null) {
    return { car: { kind: 'unreadable', reason: 'no_title', makeKey: null }, covered, lexicon: null };
  }
  const lexicon = await currentLexicon();
  return { car: readCarOfLink(listing.slug, lexicon, coverage), covered, lexicon };
}

type Decision = { readonly answer: CheckAnswer; readonly titledModelId: number | null };

/** The answer for an ad we have not read: the car is told, and Carshenas reads it or does not. */
async function decide(listing: PastedListing, known: KnownListing | null): Promise<Decision> {
  const db = readDatabase();
  const accountId = (await currentAccount())?.id ?? null;
  const { car, covered, lexicon } = await readLinkCar(listing, known);
  const everyCovered = coveredCars(covered);

  if (car.kind === 'model') {
    const model = await readCatalogueModel(db, car.modelKey);
    if (model === undefined) {
      return {
        answer: {
          kind: 'unreadable',
          reason: 'no_car',
          make: null,
          coveredOfMake: [],
          covered: everyCovered,
        },
        titledModelId: null,
      };
    }
    const request = await requestOf(accountId, model.id);
    if (car.covered) {
      const [suggestions, paused] = await Promise.all([suggest(model.key), readCrawlPaused(db)]);
      return {
        answer: {
          kind: 'queued',
          car: carNameOf(model),
          crawlPaused: paused,
          grantedToViewer: request.mine && (request.status === 'approved' || request.status === 'fulfilled'),
          seen: known !== null,
          sourceUrl: known?.url ?? null,
          suggestions,
        },
        titledModelId: model.id,
      };
    }
    return {
      answer: {
        kind: 'outside',
        target: { kind: 'model', model: carNameOf(model), request },
        covered: everyCovered,
        signedIn: accountId !== null,
        link: canonicalDivarAddress(listing),
      },
      titledModelId: model.id,
    };
  }

  if (car.kind === 'make_outside') {
    const make = await readMakeModels(db, car.makeKey);
    if (make !== undefined && make.models.length > 0) {
      // The models the viewer already asked for, or that were declined, are shown with their state and not offered again.
      const requests = await readModelRequests(
        db,
        accountId,
        make.models.map((model) => model.id),
      );
      const asked: AskedModel[] = [];
      const models: ChoosableModel[] = [];
      for (const model of make.models) {
        const row = requests.get(model.id);
        if (row !== undefined && (row.fileId !== null || row.status === 'declined')) {
          asked.push({
            key: model.key,
            name: model.name,
            request: {
              status: row.status,
              mine: row.fileId !== null,
              reason: row.reason,
              fileId: row.fileId,
            },
          });
        } else {
          models.push({ key: model.key, name: model.name });
        }
      }
      return {
        answer: {
          kind: 'outside',
          target: { kind: 'make', name: make.name, models, asked },
          covered: everyCovered,
          signedIn: accountId !== null,
          link: canonicalDivarAddress(listing),
        },
        titledModelId: null,
      };
    }
    return {
      answer: { kind: 'unreadable', reason: 'no_car', make: null, coveredOfMake: [], covered: everyCovered },
      titledModelId: null,
    };
  }

  const make = car.makeKey === null ? undefined : lexicon?.entity(car.makeKey);
  return {
    answer: {
      kind: 'unreadable',
      reason: car.reason,
      make: make === undefined ? null : nameOnScreen(make.label),
      coveredOfMake: coveredCars(covered.filter((model) => model.makeKey === car.makeKey)),
      covered: everyCovered,
    },
    titledModelId: null,
  };
}

/** What a Divar link comes to. A database failure throws: the page's error state, with its reference code. */
export async function answerPastedLink(listing: PastedListing): Promise<CheckAnswer> {
  const started = performance.now();
  if (!takeToken('check-link', await currentClientAddress(), CHECK_RULE)) {
    logger.info('pasted link answered', { outcome: 'limited' });
    return { kind: 'limited' };
  }
  const id = await findListingId(listing.token);
  const result = id === undefined ? ({ status: 'missing' } as const) : await readListingPage(id);
  let answer: CheckAnswer;
  let titledModelId: number | null = null;
  if (result.status !== 'missing' && result.page.listing.status !== 'active') {
    answer = {
      kind: 'off_market',
      page: result.page,
      suggestions: await suggest(result.page.listing.model?.key ?? null),
    };
  } else if (result.status !== 'missing' && result.page.listing.priceType !== null) {
    answer = { kind: 'found', page: result.page };
  } else {
    // Not read yet: seen on a list page only, or never seen. The car decides what is said.
    const known: KnownListing | null =
      result.status === 'missing'
        ? null
        : { modelKey: result.page.listing.model?.key ?? null, url: result.page.listing.url };
    const decision = await decide(listing, known);
    answer = decision.answer;
    titledModelId = decision.titledModelId;
  }
  const recorded = await record(listing.token, titledModelId);
  logger.info('pasted link answered', {
    outcome: answer.kind,
    recorded,
    rated: answer.kind === 'found' && (answer.page.valuation?.dealRating ?? null) !== null,
    titled: listing.slug !== null,
    milliseconds: Math.round(performance.now() - started),
  });
  return answer;
}
