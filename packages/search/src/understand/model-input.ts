// What the model is asked (CS-62, S03 "The model step"): not the whole search, only the words code could not read,
// with what code already settled for context and the catalogue entries those words may name. The query is untrusted
// text: the sentences code found addressed to the system are replaced by an ellipsis before the model ever sees them,
// and a long digit run (a phone number someone pasted) by «#». The input is plain data, so the answer cache hashes
// exactly what the model reads (the prompt is rendered from it in packages/ai/src/tasks/query-filters.ts).
import { maskPhoneLike, phoneLikeRanges } from './privacy.ts';
import type { Claim } from './claims.ts';
import type { CodeReading } from './code-pass.ts';
import type { Entity, Lexicon } from './lexicon.ts';
import { wordsOf } from './text.ts';

export type Candidate = {
  /** What a filter takes: `peugeot`, `peugeot.206`, `peugeot.206.2`, `karaj`, `suv`. */
  readonly key: string;
  readonly label: string;
  /** The Latin name, for a word typed in Latin letters; empty when it is the label. */
  readonly latin: string;
};

export type QueryFiltersInput = {
  /**
   * The current Solar Hijri year, which code needs to read a two-digit year and to refuse a year no car has. Not part
   * of what the model reads: the prompt does not print it, so an answer cached last year is checked with this year's.
   */
  readonly solarYear: number;
  /** The buyer's words, cleaned, addressed sentences and long digit runs replaced. The only text the model reads. */
  readonly text: string;
  /** What code already settled, in order: the words and what they became. The model does not repeat these. */
  readonly settled: readonly { readonly words: string; readonly means: string }[];
  /** The groups of words code could not read. */
  readonly left: readonly string[];
  /** Why the model is asked at all. */
  readonly why: 'left' | 'doubt' | 'long';
  readonly makes: readonly Candidate[];
  readonly models: readonly Candidate[];
  readonly trims: readonly Candidate[];
  readonly cities: readonly Candidate[];
  readonly bodyTypes: readonly Candidate[];
};

const MAX_MODELS = 90;
const MAX_TRIMS = 40;
const SEARCHABLE_MODELS = 12;
const MODELS_PER_MAKE = 70;

/** A value as the settled lines say it: choices joined, a range as «min … max …», a flag as nothing. */
function valueText(value: unknown): string {
  if (Array.isArray(value)) return (value as unknown[]).map(String).join(', ');
  if (typeof value === 'object' && value !== null) {
    const range = value as { min?: number; max?: number };
    return [
      range.min === undefined ? '' : `min ${String(range.min)}`,
      range.max === undefined ? '' : `max ${String(range.max)}`,
    ]
      .filter((part) => part !== '')
      .join(' ');
  }
  return typeof value === 'boolean' ? '' : String(value);
}

/** What a claim became, in the vocabulary the model's answer uses (filter ids, intent ids, sort ids). */
export function describeClaim(claim: Claim): string {
  const parts = claim.filters.map(({ filterId, value }) => `${filterId} ${valueText(value)}`.trim());
  if (claim.intent !== undefined) parts.push(`intent ${claim.intent}`);
  if (claim.sort !== undefined) parts.push(`sort ${claim.sort}`);
  if (claim.scope === 'default_scope') parts.push('Tehran, the whole market: no filter');
  if (claim.scope === 'outside_market') parts.push('a city the index does not cover: no filter');
  if (claim.unsupported !== undefined)
    parts.push(`a wish the data cannot serve (${claim.unsupported}): no filter`);
  if (claim.implausible !== undefined) parts.push(`not a plausible ${claim.implausible}: no filter`);
  if (claim.typo !== undefined) parts.push(`the buyer's misspelling of «${claim.typo.meant}»`);
  return parts.join('; ');
}

function candidateOf(entity: Entity): Candidate {
  return { key: entity.key, label: entity.label, latin: entity.nameEn === entity.label ? '' : entity.nameEn };
}

/** The text as the model reads it: addressed sentences as «…», long unclaimed digit runs as «#». */
function textForModel(code: CodeReading): string {
  const { text, tokens } = code.cleaned;
  const claimedNumbers = new Set<number>();
  for (const claim of code.claims) {
    if (claim.filters.length === 0) continue;
    for (let index = claim.from; index < claim.to; index += 1) claimedNumbers.add(index);
  }
  let out = '';
  let at = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    out += text.slice(at, token.start);
    if (code.addressed.has(index)) {
      let last = index;
      while (code.addressed.has(last + 1)) last += 1;
      out += '…';
      at = tokens[last]?.end ?? token.end;
      index = last;
      continue;
    }
    const longDigits = token.kind === 'number' && token.norm.replace('.', '').length >= 10;
    out += longDigits && !claimedNumbers.has(index) ? '#' : token.raw;
    at = token.end;
  }
  return out + text.slice(at);
}

export function modelInputOf(code: CodeReading, lexicon: Lexicon, solarYear: number): QueryFiltersInput {
  const { text, tokens } = code.cleaned;
  // Tokens inside a phone-like run never reach the model, however the run was split into spans (a number typed with
  // hyphens is read by code as a range): they are «#» in every piece of text below, and a settled line about them is dropped.
  const ranges = phoneLikeRanges(text);
  const isPrivate = (index: number): boolean => {
    const token = tokens[index];
    return token !== undefined && ranges.some((range) => token.start < range.end && token.end > range.start);
  };
  const safeWords = (from: number, to: number): string => {
    let out = '';
    let at = tokens[from]?.start ?? 0;
    let hidden = false;
    for (let index = from; index < to; index += 1) {
      const token = tokens[index];
      if (token === undefined) continue;
      if (isPrivate(index)) {
        if (!hidden) out += `${text.slice(at, token.start)}#`;
        hidden = true;
      } else {
        out += `${hidden ? text.slice(tokens[index - 1]?.end ?? at, token.start) : text.slice(at, token.start)}${token.raw}`;
        hidden = false;
      }
      at = token.end;
    }
    return out;
  };
  const overlapsPrivate = (from: number, to: number): boolean =>
    Array.from({ length: Math.max(0, to - from) }, (_, offset) => from + offset).some(isPrivate);
  const settled = [...code.claims]
    .filter((claim) => !overlapsPrivate(claim.from, claim.to))
    .sort((a, b) => a.from - b.from)
    .map((claim) => ({ words: safeWords(claim.from, claim.to), means: describeClaim(claim) }))
    .filter((line) => line.means !== '');
  const left = code.leftover.map((span) => safeWords(span.from, span.to));

  // The catalogue entries the words may name: the searchable models, the models of a make that was named, the trims
  // of a model that was named, and whatever is a misspelling or a transliteration away from a word left unread.
  const namedMakes = new Set<string>();
  const namedModels = new Set<string>();
  for (const claim of code.claims) {
    for (const { filterId, value } of claim.filters) {
      const [key] = Array.isArray(value) ? (value as string[]) : [];
      if (key === undefined) continue;
      if (filterId === 'make') namedMakes.add(key);
      if (filterId === 'model') {
        namedModels.add(key);
        namedMakes.add(key.split('.')[0] ?? key);
      }
    }
  }
  const models = new Map<string, Entity>();
  const addModel = (entity: Entity | undefined) => {
    if (entity?.level === 'model' && models.size < MAX_MODELS) models.set(entity.key, entity);
  };
  for (const entity of lexicon.searchableModels().slice(0, SEARCHABLE_MODELS)) addModel(entity);
  for (const make of namedMakes)
    for (const entity of lexicon.modelsOfMake(make).slice(0, MODELS_PER_MAKE)) addModel(entity);
  const makes = new Set<string>(namedMakes);
  for (const span of code.leftover) {
    for (const token of tokens.slice(span.from, span.to)) {
      for (const near of lexicon.near(token.norm, 3)) {
        if (near.level === 'make') makes.add(near.key);
        else addModel(lexicon.entity(near.modelKey ?? near.key));
      }
    }
  }
  for (const model of models.values()) makes.add(model.makeKey);
  const trims = [...namedModels].flatMap((key) =>
    lexicon.trimsOf(key).map((trim) => ({ key: trim.entity.key, label: trim.shortLabel, latin: '' })),
  );
  return {
    solarYear,
    text: maskPhoneLike(textForModel(code)),
    settled: settled.map((line) => ({ ...line, words: maskPhoneLike(line.words) })),
    left: left.map((words) => maskPhoneLike(words)),
    why: code.needsModel ?? 'left',
    makes: [...makes].flatMap((key) => {
      const entity = lexicon.entity(key);
      return entity === undefined ? [] : [candidateOf(entity)];
    }),
    models: [...models.values()].map(candidateOf),
    trims: trims.slice(0, MAX_TRIMS),
    cities: [
      ...new Map(
        code.leftover
          .flatMap((span) =>
            tokens.slice(span.from, span.to).flatMap((token) => lexicon.citiesNear(token.norm)),
          )
          .map((city) => [city.key, { key: city.key, label: city.label, latin: '' }]),
      ).values(),
    ],
    bodyTypes: lexicon.options('body_type').map((body) => ({ key: body.key, label: body.label, latin: '' })),
  };
}
