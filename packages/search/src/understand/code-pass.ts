// The first pass, in code (CS-62 decision 2, S04 "Code first"): what a source already structures is parsed by code and
// the model reads only free text. This pass reads the buyer's words without a model: makes, models and trims through the
// catalogue's names and aliases, numbers with their units, the documented phrases, bundles and orders, typos of a
// catalogue name, and the filler. Every word it uses is claimed; the words nobody claims are the unused words, and when
// any are left, or a reading is doubtful, the model is asked about them. A reading is only kept when it is certain: a
// negation beside it («نباشه», «بدون» before a word no phrase knows) and code leaves the words to the model rather than
// apply the opposite of what the buyer wrote.
import { claimOf, type Claim } from './claims.ts';
import { addressedTokens, isFiller } from './fillers.ts';
import { editDistance, type Entity, type Lexicon } from './lexicon.ts';
import type { Phrase, PhraseEffect } from './phrases.ts';
import { readQuantities } from './quantities.ts';
import { cleanQuery, type CleanedQuery, type Token } from './text.ts';

/** More content words than this and the model is asked too, whatever code read (S04). */
export const LONG_QUERY_CONTENT_TOKENS = 20;

// Words that turn a wish around: a reading beside one is not kept by code.
const NEGATIONS: ReadonlySet<string> = new Set([
  'نه',
  'نباشه',
  'نباشد',
  'نباشن',
  'نباشند',
  'نباید',
  'نمی',
  'نداشته',
  'نداره',
  'ندارد',
  'نیست',
  'نبوده',
  'نکرده',
  'نشده',
  'نخورده',
  'غیر',
  'بجز',
  'جز',
  'بغیر',
  'نخوام',
  'نخواهم',
]);

// The words that make a number a quantity when they follow it: a model's number is not one of them.
const QUANTITY_AFTER: ReadonlySet<string> = new Set([
  'هزار',
  'میلیون',
  'میلیارد',
  'بیلیون',
  'تومان',
  'تومن',
  'تومانی',
  'ریال',
  'کیلومتر',
  'کیلو',
  'کیلومتری',
  'km',
  'cc',
  'سیسی',
  'لیتر',
  'ماه',
  'روز',
  'ساعت',
]);
const QUANTITY_BEFORE: ReadonlySet<string> = new Set([
  'کارکرد',
  'کارکرده',
  'قیمت',
  'بودجه',
  'مبلغ',
  'بیمه',
  'تیپ',
]);
const QUANTITY_SOURCES: ReadonlySet<string> = new Set([
  'price',
  'mileage',
  'year',
  'age',
  'insurance',
  'posted',
  'engine',
]);

export type Span = { readonly from: number; readonly to: number };

export type CodeReading = {
  readonly cleaned: CleanedQuery;
  readonly claims: readonly Claim[];
  /** Tokens addressed to the system: never read by code or by a model, shown as such. */
  readonly addressed: ReadonlySet<number>;
  /** Filler tokens: not read, not shown. */
  readonly filler: ReadonlySet<number>;
  /** Groups of neighbouring tokens nobody claimed and that are not filler: the words left to read. */
  readonly leftover: readonly Span[];
  /** Why code could not settle what it read (negation, an ambiguous name, a trim with several candidates). */
  readonly doubts: readonly string[];
  /** Whether the model is asked: words are left, a reading is doubtful, or the query is long. */
  readonly needsModel: 'left' | 'doubt' | 'long' | null;
};

export type CodeOptions = {
  readonly lexicon: Lexicon;
  /** The current Solar Hijri year (a two-digit model year, a car's age). */
  readonly solarYear: number;
  /**
   * Code only cleans and removes what is addressed to the system, and reads nothing: every word is left for the model.
   * For the evaluation's comparison of the model alone with code first, never the product.
   */
  readonly readsNothing?: boolean;
};

function entityClaim(from: number, to: number, entity: Entity, source: string): Claim {
  const own = { value: [entity.key] };
  const filters =
    entity.level === 'make'
      ? [{ filterId: 'make' as const, ...own }]
      : entity.level === 'model'
        ? [{ filterId: 'model' as const, ...own }]
        : [
            { filterId: 'model' as const, value: [entity.modelKey ?? ''] },
            { filterId: 'trim' as const, ...own },
          ];
  return claimOf(from, to, source, { filters, ...(entity.listings === 0 ? { notTracked: true } : {}) });
}

function effectClaim(from: number, to: number, effect: PhraseEffect): Claim {
  switch (effect.kind) {
    case 'filters':
      return claimOf(from, to, 'phrase', { filters: effect.filters, basis: effect.basis });
    case 'intent':
      return claimOf(from, to, 'phrase', { intent: effect.intent });
    case 'sort':
      return claimOf(from, to, 'phrase', { sort: effect.sort });
    case 'scope':
      return claimOf(from, to, 'phrase', { scope: effect.scope });
    case 'unsupported':
      return claimOf(from, to, 'phrase', { unsupported: effect.topic });
  }
}

/** The longest phrase of the index that starts at token `at` with every token free. */
function phraseAt(
  lexicon: Lexicon,
  tokens: readonly Token[],
  at: number,
  free: (index: number) => boolean,
  soft: boolean,
): { phrase: Phrase; to: number } | undefined {
  const candidates = lexicon.phrases.byFirst.get(tokens[at]?.norm ?? '');
  if (candidates === undefined) return undefined;
  for (const phrase of candidates) {
    if (phrase.soft !== soft) continue;
    const words = phrase.phrase.split(' ');
    if (at + words.length > tokens.length) continue;
    if (words.every((word, offset) => tokens[at + offset]?.norm === word && free(at + offset))) {
      return { phrase, to: at + words.length };
    }
  }
  return undefined;
}

function keyOf(claim: Claim, filterId: 'make' | 'model'): string | undefined {
  const found = claim.filters.find((one) => one.filterId === filterId);
  const [key] = (found?.value ?? []) as string[];
  return key;
}

/**
 * Groups of neighbouring tokens that are left: filler may lie between them, and anything that is not left (a claim, a
 * sentence addressed to the system) or the end of a sentence closes a group.
 */
function leftoverSpans(
  tokens: readonly Token[],
  isLeft: (index: number) => boolean,
  isOpen: (index: number) => boolean,
): Span[] {
  const spans: Span[] = [];
  let open: { from: number; last: number } | undefined;
  for (const token of tokens) {
    const closes =
      !isOpen(token.index) || (token.breakBefore === 2 && open !== undefined && token.index > open.from);
    if (open !== undefined && closes) {
      spans.push({ from: open.from, to: open.last + 1 });
      open = undefined;
    }
    if (isLeft(token.index)) {
      open = open === undefined ? { from: token.index, last: token.index } : { ...open, last: token.index };
    }
  }
  if (open !== undefined) spans.push({ from: open.from, to: open.last + 1 });
  return spans;
}

export function readByCode(typed: string, options: CodeOptions): CodeReading {
  const { lexicon, solarYear } = options;
  const cleaned = cleanQuery(typed);
  const tokens = cleaned.tokens;
  const addressed = addressedTokens(tokens);
  if (options.readsNothing === true) {
    const open = (index: number) => !addressed.has(index);
    const isLeft = (index: number) => {
      const token = tokens[index];
      return token !== undefined && open(index) && !isFiller(token);
    };
    const leftover = leftoverSpans(tokens, isLeft, open);
    const filler = new Set(
      tokens.filter((token) => open(token.index) && isFiller(token)).map((token) => token.index),
    );
    return {
      cleaned,
      claims: [],
      addressed,
      filler,
      leftover,
      doubts: [],
      needsModel: leftover.length > 0 ? 'left' : null,
    };
  }
  const taken = new Array<boolean>(tokens.length).fill(false);
  let claims: Claim[] = [];
  const doubts: string[] = [];
  const free = (index: number) =>
    index >= 0 && index < tokens.length && !taken[index] && !addressed.has(index);
  const take = (claim: Claim) => {
    claims.push(claim);
    for (let index = claim.from; index < claim.to; index += 1) taken[index] = true;
  };
  const release = (claim: Claim) => {
    claims = claims.filter((one) => one !== claim);
    for (let index = claim.from; index < claim.to; index += 1) taken[index] = false;
  };

  // 1. Makes, models and trims by name.
  for (let at = 0; at < tokens.length; at += 1) {
    if (!free(at)) continue;
    const match = lexicon.entityAt(tokens, at, free);
    if (match === undefined) continue;
    // A model's number is not a quantity's: «۲۰۶» is a model, «۲۰۶ هزار» is not.
    const numeric = match.to - match.from === 1 && /^\d+$/.test(tokens[match.from]?.norm ?? '');
    if (
      numeric &&
      (QUANTITY_AFTER.has(tokens[match.to]?.norm ?? '') ||
        QUANTITY_BEFORE.has(tokens[match.from - 1]?.norm ?? ''))
    ) {
      continue;
    }
    at = match.to - 1;
    const searchable = match.entities.filter((entity) => entity.listings > 0);
    const chosen = searchable.length > 0 ? searchable : match.entities;
    const [entity] = chosen;
    if (chosen.length !== 1 || entity === undefined) {
      doubts.push('ambiguous name');
      continue;
    }
    // «مدل ۲۰۶»: the word «مدل» before a model's number says nothing more.
    const model = numeric && tokens[match.from - 1]?.norm === 'مدل' && free(match.from - 1);
    take(entityClaim(model ? match.from - 1 : match.from, match.to, entity, 'entity'));
  }

  // 2. Numbers with their units.
  for (const claim of readQuantities(tokens, free, solarYear)) take(claim);

  // 3. Phrases: the documented table and the filters' own values (cities, districts, colours, body types).
  for (let at = 0; at < tokens.length; at += 1) {
    if (!free(at)) continue;
    const found = phraseAt(lexicon, tokens, at, free, false);
    if (found === undefined) continue;
    take(effectClaim(at, found.to, found.phrase.effect));
    at = found.to - 1;
  }

  // 3b. Negation: a word that turns a wish around, beside a reading, takes the reading back. «بدون» that no phrase of
  // the table took counts as one («بدون اسنپ»). The words go to the model, which cannot be handed the opposite either.
  const sentenceOf: number[] = [];
  let sentence = 0;
  for (const token of tokens) {
    if (token.breakBefore === 2) sentence += 1;
    sentenceOf[token.index] = sentence;
  }
  const turning = tokens
    .filter((token) => free(token.index) && NEGATIONS.has(token.norm))
    .map((token) => token.index);
  const without = tokens
    .filter((token) => free(token.index) && token.norm === 'بدون')
    .map((token) => token.index);
  for (const claim of [...claims]) {
    if (QUANTITY_SOURCES.has(claim.source)) continue;
    const sentenceId = sentenceOf[claim.from];
    const near = turning.some(
      (index) =>
        sentenceOf[index] === sentenceId &&
        ((index >= claim.to && index < claim.to + 3) || (index < claim.from && index >= claim.from - 2)),
    );
    if (near || without.includes(claim.from - 1)) {
      release(claim);
      doubts.push('negation');
    }
  }

  // 3c. A word beside a model's name that is its make misspelled: «پزو ۲۰۶».
  for (const claim of [...claims]) {
    const modelKey = claim.source === 'entity' ? keyOf(claim, 'model') : undefined;
    const make = modelKey === undefined ? undefined : lexicon.entity(modelKey.split('.')[0] ?? '');
    if (modelKey === undefined || make === undefined) continue;
    for (const index of [claim.from - 1, claim.to]) {
      const token = tokens[index];
      if (token?.kind !== 'word' || !free(index) || token.norm.length < 3) continue;
      if (isFiller(token) || lexicon.phrases.byFirst.has(token.norm)) continue;
      const limit = token.norm.length >= 8 ? 2 : 1;
      const names = [...make.label.split(' '), make.key].map((name) => name.toLowerCase());
      const meant = names.find(
        (name) => name.length >= 3 && name !== token.norm && editDistance(token.norm, name, limit) <= limit,
      );
      if (meant !== undefined) take(claimOf(index, index + 1, 'typo', { typo: { typed: token.raw, meant } }));
    }
  }

  // 4. Trims: what a model's name leaves out, written right after it («تیپ ۲», «SE», «پلاس»), exactly.
  for (const claim of [...claims]) {
    const modelKey = claim.source === 'entity' || claim.source === 'typo' ? keyOf(claim, 'model') : undefined;
    if (modelKey === undefined || claim.filters.some((one) => one.filterId === 'trim')) continue;
    const trims = lexicon.trimsOf(modelKey);
    if (trims.length === 0) continue;
    let run = 0;
    for (; run < 5; run += 1) {
      const token = tokens[claim.to + run];
      if (token === undefined || !free(claim.to + run) || isFiller(token)) break;
    }
    for (let length = run; length >= 1; length -= 1) {
      const wanted = tokens
        .slice(claim.to, claim.to + length)
        .map((token) => token.norm)
        .join(' ');
      const exact = trims.filter((trim) => trim.remainders.includes(wanted));
      const [only] = exact;
      if (exact.length === 1 && only !== undefined) {
        take(
          claimOf(claim.to, claim.to + length, 'trim', {
            filters: [{ filterId: 'trim', value: [only.entity.key] }],
            ...(only.entity.listings === 0 ? { notTracked: true } : {}),
          }),
        );
        break;
      }
      if (exact.length > 1) {
        doubts.push('ambiguous trim');
        break;
      }
    }
  }

  // 5. A word that is a catalogue name misspelled.
  for (let at = 0; at < tokens.length; at += 1) {
    const token = tokens[at];
    if (token?.kind !== 'word' || !free(at) || isFiller(token) || lexicon.phrases.byFirst.has(token.norm))
      continue;
    const typo = lexicon.typoOf(token.norm);
    if (typo === undefined) continue;
    const searchable = typo.entities.filter((entity) => entity.listings > 0);
    const chosen = searchable.length > 0 ? searchable : typo.entities;
    const [entity] = chosen;
    if (chosen.length !== 1 || entity === undefined) {
      doubts.push('ambiguous name');
      continue;
    }
    take({ ...entityClaim(at, at + 1, entity, 'typo'), typo: { typed: token.raw, meant: typo.word } });
  }

  // 5b. A make beside a model of that make is part of the model's name, written twice («پژو» and «۲۰۶»).
  for (const claim of [...claims]) {
    const makeKey = claim.filters.length === 1 ? keyOf(claim, 'make') : undefined;
    if (makeKey === undefined) continue;
    const neighbour = claims.find((other) => {
      const modelKey = keyOf(other, 'model');
      return (
        modelKey !== undefined &&
        modelKey.startsWith(`${makeKey}.`) &&
        (other.to === claim.from || other.from === claim.to)
      );
    });
    if (neighbour === undefined) continue;
    claims = claims.map((one) =>
      one === neighbour
        ? { ...one, from: Math.min(one.from, claim.from), to: Math.max(one.to, claim.to) }
        : one,
    );
    claims = claims.filter((one) => one !== claim);
  }

  // 6. Soft phrases («ماشین تمیز»): read only when nothing but filler and soft phrases is left of the query.
  const isLeft = (index: number) => {
    const token = tokens[index];
    return token !== undefined && free(index) && !isFiller(token);
  };
  const unread = tokens.filter((token) => isLeft(token.index));
  if (unread.length > 0) {
    const soft: { at: number; found: { phrase: Phrase; to: number } }[] = [];
    const covered = new Set<number>();
    for (let at = 0; at < tokens.length; at += 1) {
      if (!free(at) || covered.has(at)) continue;
      const found = phraseAt(lexicon, tokens, at, (index) => free(index) && !covered.has(index), true);
      if (found === undefined) continue;
      soft.push({ at, found });
      for (let index = at; index < found.to; index += 1) covered.add(index);
    }
    if (soft.length > 0 && unread.every((token) => covered.has(token.index))) {
      for (const { at, found } of soft) take(effectClaim(at, found.to, found.phrase.effect));
    }
  }

  // 7. What is left: a group is the neighbouring tokens nobody claimed, filler allowed between them and a sentence's
  // end closing it.
  const filler = new Set<number>(
    tokens.filter((token) => free(token.index) && isFiller(token)).map((t) => t.index),
  );
  const leftover = leftoverSpans(tokens, isLeft, free);

  const content = tokens.filter((token) => !filler.has(token.index) && !addressed.has(token.index)).length;
  const needsModel: CodeReading['needsModel'] =
    leftover.length > 0
      ? 'left'
      : doubts.length > 0
        ? 'doubt'
        : content > LONG_QUERY_CONTENT_TOKENS
          ? 'long'
          : null;
  return { cleaned, claims, addressed, filler, leftover, doubts, needsModel };
}
