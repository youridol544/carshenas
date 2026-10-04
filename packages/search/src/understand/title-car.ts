// What car an ad's title names (CS-115, ADR-0046), read with the catalogue's own names and aliases and nothing else: the
// buyer of a pasted Divar link wants to know whether Carshenas reads that car, and the link carries the ad's title
// (`https://divar.ir/v/<title with dashes>/<token>`), so the car is read from the title in code, with no request to
// Divar and no model. The names come from the lexicon (lexicon.ts), the same matcher the plain-Farsi search reads a
// sentence with. A title is not a sentence, though: sellers glue words and digits («۲۰۶sdمدل۹۳», «دناپلاس»), write the
// year as its last three digits («صفر ۴۰۵» is a zero-km car of 1405, not a Peugeot 405) and name the car they want in
// exchange after the one they sell. The result is never a guess: one model, or only a make, or an ambiguity, or nothing;
// the caller treats everything but a model (or a make that settles the question by itself) as «the car cannot be told
// from the link». Pure and client-safe: no Node or DOM API.
import type { Entity, Lexicon } from './lexicon.ts';
import { cleanQuery, type Token } from './text.ts';

export type TitleCar =
  /** Exactly one model is named (by its own name, or by a trim's, which names its model). */
  | { readonly kind: 'model'; readonly model: Entity }
  /** No model, but exactly one make: «هیوندای النترا» when «النترا» has no Persian name in the catalogue. */
  | { readonly kind: 'make'; readonly make: Entity }
  /** More than one model (or make) is named: the title does not say which car it is about. */
  | { readonly kind: 'ambiguous'; readonly entities: readonly Entity[] }
  /** Nothing the catalogue knows. */
  | { readonly kind: 'none' };

// Words that make a number a distance, a price or a count: the number before or after them is no model's.
const QUANTITY_AFTER: ReadonlySet<string> = new Set([
  'هزار',
  'میلیون',
  'میلیارد',
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
  'تا',
  'گانه',
]);
const QUANTITY_BEFORE: ReadonlySet<string> = new Set([
  'کارکرد',
  'کارکرده',
  'قیمت',
  'بودجه',
  'مبلغ',
  'بیمه',
  'تیپ',
  'ارتقا',
  'استاندارد',
  'دوربین',
]);
// Words a seller writes a year after: «مدل ۴۰۵», «صفر ۴۰۵» (a zero-km car of 1405).
const YEAR_BEFORE: ReadonlySet<string> = new Set([
  'مدل',
  'سال',
  'ساخت',
  'محصول',
  'تولید',
  'صفر',
  'خشک',
  'مدلهای',
]);
// A title that offers a delivery order (حواله) is about the paper, not about a car: the car is not told from it.
const ORDER_WORDS: ReadonlySet<string> = new Set(['حواله']);
// The companies that build many brands: beside a brand's own name they say nothing more about the car.
const MAKER_MAKES: ReadonlySet<string> = new Set(['iran-khodro', 'saipa', 'pars-khodro', 'irankhodro-van']);
// Words after which a car's name is the car the seller wants in exchange, or the engine it carries: not the car for sale.
const EXCHANGE = new Set(['معاوضه', 'تعویض', 'مبادله']);
const ENGINE = new Set(['موتور', 'موتوری']);

/** A three-digit number a seller writes for a year: 1400 to 1410 as «۴۰۰» to «۴۱۰» (a Peugeot 405 is written the same). */
function looksLikeShortYear(norm: string): boolean {
  return /^4(?:0\d|10)$/.test(norm);
}

/** A four-digit number a seller may mean as a year: Solar Hijri (1300 to 1499) or Gregorian (1980 to 2040). */
function looksLikeYear(norm: string): boolean {
  if (!/^\d{4}$/.test(norm)) return false;
  const value = Number(norm);
  return (value >= 1300 && value <= 1499) || (value >= 1980 && value <= 2040);
}

/**
 * The title of an ad as the catalogue's names should read it: a link's dashes (and the underscores and pluses that stand
 * for a space in some addresses) are spaces. Everything else is left to the cleaning every search sentence goes through.
 */
export function titleOfSlug(slug: string): string {
  return slug
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Where one kind of character meets another a seller left no space: Persian digits, Latin digits, Latin letters and the
// letters of the Arabic script each start a new word («۲۰۶sdمدل۹۳» is «۲۰۶ sd مدل ۹۳»). A half-space stays where it is.
const CLASS: readonly [string, RegExp][] = [
  ['digit-fa', /[۰-۹٠-٩]/u],
  ['digit', /[0-9]/u],
  ['latin', /\p{Script=Latin}/u],
  ['arabic', /(?=\p{L})\p{Script=Arabic}|\p{M}/u],
];

function classOf(letter: string): string | undefined {
  return CLASS.find(([, pattern]) => pattern.test(letter))?.[0];
}

function separateScripts(text: string): string {
  let out = '';
  let before: string | undefined;
  for (const letter of text) {
    const current = classOf(letter);
    if (before !== undefined && current !== undefined && current !== before) out += ' ';
    out += letter;
    before = current;
  }
  return out;
}

function distinct(entities: readonly Entity[]): Entity[] {
  const byKey = new Map<string, Entity>();
  for (const entity of entities) if (!byKey.has(entity.key)) byKey.set(entity.key, entity);
  return [...byKey.values()];
}

type Candidate = {
  readonly entity: Entity;
  readonly from: number;
  /** A model written as a bare number («۲۰۶», «۴۰۵»), which is also what years and codes look like. */
  readonly bare: boolean;
};

function synthetic(norm: string, index: number): Token {
  return { index, raw: norm, norm, kind: 'word', start: 0, end: 0, joined: false, breakBefore: 0 };
}

/** The names a word of two names written together («دناپلاس») may be: the lexicon's phrase of two words, split anywhere. */
function joinedNames(word: string, lexicon: Lexicon): readonly Entity[] {
  if (word.length < 5 || /[\d\s]/.test(word)) return [];
  for (let at = 2; at <= word.length - 2; at += 1) {
    const pair = [synthetic(word.slice(0, at), 0), synthetic(word.slice(at), 1)];
    const match = lexicon.entityAt(pair, 0, () => true);
    if (match?.to === 2) return match.entities;
  }
  return [];
}

/** The car a title names: the lexicon's longest names, left to right, with the numbers of a year, a price or a distance left out. */
export function readCarFromTitle(title: string, lexicon: Lexicon): TitleCar {
  const { tokens } = cleanQuery(separateScripts(title));
  if (tokens.some((token) => ORDER_WORDS.has(token.norm))) return { kind: 'none' };
  const taken = new Array<boolean>(tokens.length).fill(false);
  const free = (index: number) => index >= 0 && index < tokens.length && !taken[index];
  const candidates: Candidate[] = [];
  const add = (entities: readonly Entity[], from: number, bare: boolean) => {
    // A name that two catalogue entries share is read as the one the index collects, never as both.
    const searchable = entities.filter((entity) => entity.listings > 0);
    for (const entity of distinct(searchable.length > 0 ? searchable : entities)) {
      candidates.push({ entity, from, bare });
    }
  };
  for (let at = 0; at < tokens.length; at += 1) {
    if (!free(at)) continue;
    const token = tokens[at];
    if (token === undefined) continue;
    const match = lexicon.entityAt(tokens, at, free);
    if (match === undefined) {
      const joined = token.kind === 'word' ? joinedNames(token.norm, lexicon) : [];
      if (joined.length > 0) {
        taken[at] = true;
        add(joined, at, false);
      }
      continue;
    }
    const single = match.to - match.from === 1;
    const bareNumber = single && token.kind === 'number';
    const before = tokens[match.from - 1]?.norm ?? '';
    const after = tokens[match.to]?.norm ?? '';
    if (bareNumber && (QUANTITY_AFTER.has(after) || QUANTITY_BEFORE.has(before))) continue;
    if (bareNumber && looksLikeYear(token.norm)) continue;
    if (bareNumber && looksLikeShortYear(token.norm) && YEAR_BEFORE.has(before)) continue;
    // One or two Latin letters name nothing: «S», «R», «Rs» are trims and options a seller lists after the car.
    if (single && token.kind === 'word' && /^[a-z]{1,2}$/.test(token.norm)) continue;
    for (let index = match.from; index < match.to; index += 1) taken[index] = true;
    at = match.to - 1;
    add(match.entities, match.from, bareNumber);
  }

  // What follows an exchange or an engine is another car's name: only what came before it is the car for sale.
  const cut = tokens.findIndex(
    (token, index) => (EXCHANGE.has(token.norm) || ENGINE.has(token.norm)) && index > 0,
  );
  const kept = cut === -1 ? candidates : candidates.filter((one) => one.from < cut);
  const forSale = kept.length > 0 ? kept : candidates;

  // A trim names its model; a make that is not a model's is only a make.
  const modelOf = (entity: Entity): Entity | undefined =>
    entity.level === 'make'
      ? undefined
      : entity.level === 'trim'
        ? lexicon.entity(entity.modelKey ?? '')
        : entity;
  const named = forSale.flatMap((one) => {
    const model = modelOf(one.entity);
    return model === undefined ? [] : [{ ...one, model }];
  });
  const everyMake = distinct(forSale.filter((one) => one.entity.level === 'make').map((one) => one.entity));
  const brands = everyMake.filter((make) => !MAKER_MAKES.has(make.key));
  const makes = brands.length > 0 ? brands : everyMake;
  // «۴۰۵» beside another car, or another make, is a year written short («دنا اتومات صفر ۴۰۵»), not a Peugeot 405.
  const models = named.filter(
    (one) =>
      !(
        one.bare &&
        looksLikeShortYear(one.entity.key.split('.')[1] ?? '') &&
        (named.some((other) => other.model.key !== one.model.key) ||
          brands.some((make) => make.key !== one.model.makeKey))
      ),
  );
  const distinctModels = distinct(models.map((one) => one.model));
  const [onlyModel] = distinctModels;
  // A make that is not the model's own («کوییک … پارس خودرویی») says the title is about another car than the one named.
  const crossed = onlyModel !== undefined && brands.some((make) => make.key !== onlyModel.makeKey);
  if (distinctModels.length === 1 && onlyModel !== undefined && !crossed)
    return { kind: 'model', model: onlyModel };
  if (distinctModels.length > 1 || crossed)
    return { kind: 'ambiguous', entities: [...distinctModels, ...makes] };
  const [onlyMake] = makes;
  if (makes.length === 1 && onlyMake !== undefined) return { kind: 'make', make: onlyMake };
  if (makes.length > 1) return { kind: 'ambiguous', entities: makes };
  return { kind: 'none' };
}
