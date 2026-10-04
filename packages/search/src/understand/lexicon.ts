// What the catalogue and the index know by name (CS-62, S04): makes, models and trims with the Persian, Latin and
// spelled-out ways they are written (CS-50's names and aliases), the cities, districts, colours and body types the
// filters offer, each with how many searchable listings it has. The code pass matches the buyer's words against it,
// longest name first, and the model step is offered its candidates. Built from plain rows, so the web app, the
// evaluation and the tests build the same thing from a database read or from a fixture; this file reads nothing.
import { toPersianDigits } from '@carshenas/locale/digits';
import { COUNTRIES } from '../specs.ts';
import { FILLER_WORDS } from './fillers.ts';
import { indexPhrases, PHRASES, type Phrase, type PhraseIndex } from './phrases.ts';
import { normalisePhrase, tokenize, type Token } from './text.ts';

export type MakeRow = {
  readonly key: string;
  readonly nameFa: string | null;
  readonly nameEn: string;
  readonly aliases: readonly string[];
  readonly listings: number;
};
export type ModelRow = MakeRow & { readonly makeKey: string };
export type TrimRow = MakeRow & { readonly modelKey: string };
export type PlaceRow = { readonly key: string; readonly label: string; readonly listings: number };
export type BodyTypeRow = { readonly code: string; readonly label: string; readonly listings: number };
export type ColourRow = { readonly label: string; readonly family: string };
export type CountryRow = { readonly code: string; readonly listings: number };

export type LexiconRows = {
  readonly makes: readonly MakeRow[];
  readonly models: readonly ModelRow[];
  readonly trims: readonly TrimRow[];
  readonly cities: readonly PlaceRow[];
  readonly districts: readonly PlaceRow[];
  readonly bodyTypes: readonly BodyTypeRow[];
  readonly colours: readonly ColourRow[];
  /** How many searchable listings each country has; absent where the counts were not read (a frozen evaluation set). */
  readonly countries?: readonly CountryRow[];
};

export type EntityLevel = 'make' | 'model' | 'trim';

export type Entity = {
  readonly level: EntityLevel;
  /** `peugeot`, `peugeot.206`, `peugeot.206.2`: what the search filters take (ADR-0027). */
  readonly key: string;
  /** The Persian name, else the Latin one. */
  readonly label: string;
  /** The Latin name, which a transliterated or typed-in-Latin word is matched against. */
  readonly nameEn: string;
  /** Searchable listings; 0 for a catalogue entry the index does not collect. */
  readonly listings: number;
  readonly makeKey: string;
  readonly modelKey: string | null;
};

export type EntityMatch = {
  /** Token range [from, to). */
  readonly from: number;
  readonly to: number;
  /** Every entity the words name; more than one is an ambiguity. */
  readonly entities: readonly Entity[];
};

/** A trim, and what its name adds to its model's («تیپ ۲», «SE», «پلاس»), folded. */
export type TrimRemainder = {
  readonly entity: Entity;
  readonly remainders: readonly string[];
  /** The trim's name without its model's, as a person reads it. */
  readonly shortLabel: string;
};

export type Lexicon = {
  readonly phrases: PhraseIndex;
  /** The longest entity name at token `at` whose tokens are all `free`. */
  entityAt(tokens: readonly Token[], at: number, free: (index: number) => boolean): EntityMatch | undefined;
  /** The entity a single misspelled word most likely means: one word at distance 1 (or 2 for long words). */
  typoOf(word: string): { readonly word: string; readonly entities: readonly Entity[] } | undefined;
  entity(key: string): Entity | undefined;
  /** The trims of a model with the words they add to it. */
  trimsOf(modelKey: string): readonly TrimRemainder[];
  modelsOfMake(makeKey: string): readonly Entity[];
  /** The searchable models, most listed first. */
  searchableModels(): readonly Entity[];
  /** The label a chip shows for a database-backed value. */
  labelOf(filterId: string, value: string): string | undefined;
  /** Whether a district or city value exists (for a value a model proposes). */
  hasValue(filterId: 'city' | 'district' | 'body_type', value: string): boolean;
  /** The values of a database-backed filter that are not catalogue names, as the model is offered them. */
  options(
    filterId: 'city' | 'body_type' | 'country',
  ): readonly { readonly key: string; readonly label: string }[];
  /** Searchable listings of a country; undefined when the counts were not read (nothing is then said about it). */
  countryListings(code: string): number | undefined;
  /** The cities a word may be a slip of (one edit, five letters or more): what the model is offered for a city typo. */
  citiesNear(word: string): readonly { readonly key: string; readonly label: string }[];
  /** Names within edit distance two of a word, nearest first: what a misspelling or a transliteration may mean. */
  near(word: string, limit: number): readonly Entity[];
};

// Names that are also everyday words: a buyer writing them means the word.
const NOT_NAMES: ReadonlySet<string> = new Set(['گاز', 'فردا']);
// Words that end a model's name without naming it («Peugeot 405 GLX-normal»): never a name on their own.
const GENERIC = new Set([
  'normal',
  'plus',
  'pro',
  'max',
  'sedan',
  'hatchback',
  'manual',
  'automatic',
  'basic',
  'sport',
  'turbo',
  'van',
  'hybrid',
  'pickup',
  'ir',
  'new',
  'old',
  'lux',
  'gl',
  'gls',
  'gt',
  'se',
  'le',
  'ex',
  'sx',
  'sl',
  'tl',
  'cross',
]);

function words(phrase: string): string[] {
  const folded = normalisePhrase(phrase);
  return folded === '' ? [] : folded.split(' ');
}

function startsWith(list: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length > 0 && prefix.every((word, at) => list[at] === word);
}

/** The Damerau–Levenshtein distance (adjacent swaps count one), or more than `limit` once it is surely above it. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i += 1)
    rows.push(Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    const row = rows[i];
    const above = rows[i - 1];
    if (row === undefined || above === undefined) continue;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min((above[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (above[j - 1] ?? 0) + cost);
      const twoAbove = rows[i - 2];
      if (twoAbove !== undefined && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (twoAbove[j - 2] ?? 0) + 1);
      }
      row[j] = best;
    }
  }
  return rows[a.length]?.[b.length] ?? limit + 1;
}

export function buildLexicon(rows: LexiconRows): Lexicon {
  const entities = new Map<string, Entity>();
  const byPhrase = new Map<string, Entity[]>();
  let maxWords = 1;
  const addPhrase = (phrase: string, entity: Entity) => {
    const folded = normalisePhrase(phrase);
    if (folded === '' || NOT_NAMES.has(folded)) return;
    const list = byPhrase.get(folded) ?? [];
    if (!list.some((one) => one.key === entity.key)) list.push(entity);
    byPhrase.set(folded, list);
    maxWords = Math.max(maxWords, folded.split(' ').length);
  };
  const nameOf = (row: MakeRow) => row.nameFa ?? row.nameEn;

  const makeNames = new Map<string, string[]>();
  for (const make of rows.makes) {
    const entity: Entity = {
      level: 'make',
      key: make.key,
      label: nameOf(make),
      nameEn: make.nameEn,
      listings: make.listings,
      makeKey: make.key,
      modelKey: null,
    };
    entities.set(entity.key, entity);
    const phrases = [make.nameFa, make.nameEn, make.key.replaceAll('-', ' '), ...make.aliases];
    makeNames.set(
      make.key,
      phrases.filter((one): one is string => one !== null),
    );
    for (const phrase of phrases) if (phrase !== null) addPhrase(phrase, entity);
  }

  const modelNames = new Map<string, string[]>();
  for (const model of rows.models) {
    const entity: Entity = {
      level: 'model',
      key: model.key,
      label: nameOf(model),
      nameEn: model.nameEn,
      listings: model.listings,
      makeKey: model.makeKey,
      modelKey: model.key,
    };
    entities.set(entity.key, entity);
    const [, slug = ''] = model.key.split('.');
    const phrases = [
      model.nameFa,
      model.nameEn,
      `${model.makeKey.replaceAll('-', ' ')} ${slug.replaceAll('-', ' ')}`,
      ...model.aliases,
    ].filter((one): one is string => one !== null);
    modelNames.set(model.key, phrases);
    for (const phrase of phrases) addPhrase(phrase, entity);
    // The Latin name without its make («Hyundai Elantra» → «elantra», «Peugeot 206» → «206»): a name, unless it is a
    // generic word or a number too short to mean a model.
    for (const makePhrase of makeNames.get(model.makeKey) ?? []) {
      const rest = words(model.nameEn).slice(words(makePhrase).length);
      if (!startsWith(words(model.nameEn), words(makePhrase)) || rest.length === 0) continue;
      const text = rest.join(' ');
      if (rest.length === 1 && (GENERIC.has(text) || /^\d{1,2}$/.test(text))) continue;
      if (/^(?:normal|plus|pro)\b/.test(text)) continue;
      addPhrase(text, entity);
    }
  }

  const trimsByModel = new Map<string, TrimRemainder[]>();
  for (const trim of rows.trims) {
    const model = entities.get(trim.modelKey);
    const entity: Entity = {
      level: 'trim',
      key: trim.key,
      label: nameOf(trim),
      nameEn: trim.nameEn,
      listings: trim.listings,
      makeKey: model?.makeKey ?? trim.key.split('.')[0] ?? '',
      modelKey: trim.modelKey,
    };
    entities.set(entity.key, entity);
    // A trim is not matched by its full name: that would take «اتوماتیک» in «دنا پلاس اتوماتیک» from the gearbox filter.
    // It is matched after its model, by what its name adds (code-pass.ts), once the filters' own words are read.
    const ownNames = [trim.nameFa, trim.nameEn, ...trim.aliases].filter((one): one is string => one !== null);
    const parents = (modelNames.get(trim.modelKey) ?? []).map(words);
    const remainders = new Set<string>();
    let shortLabel = entity.label;
    for (const phrase of ownNames) {
      const list = words(phrase);
      for (const parent of parents) {
        if (startsWith(list, parent) && list.length > parent.length) {
          remainders.add(list.slice(parent.length).join(' '));
          if (phrase === (trim.nameFa ?? trim.nameEn)) {
            const raw = tokenize(phrase);
            shortLabel = raw
              .slice(parent.length)
              .map((token) => token.raw)
              .join(' ');
          }
        }
      }
    }
    trimsByModel.set(trim.modelKey, [
      ...(trimsByModel.get(trim.modelKey) ?? []),
      { entity, remainders: [...remainders], shortLabel: toPersianDigits(shortLabel) },
    ]);
  }

  // The rows the filters offer as values: cities, districts, colours and body types are phrases too.
  const dynamic: Phrase[] = [];
  for (const body of rows.bodyTypes) {
    dynamic.push({
      phrase: normalisePhrase(body.label),
      effect: { kind: 'filters', filters: [{ filterId: 'body_type', value: [body.code] }], basis: 'stated' },
      soft: false,
    });
  }
  for (const colour of rows.colours) {
    if (colour.family === 'other') continue;
    dynamic.push({
      phrase: normalisePhrase(colour.label),
      effect: { kind: 'filters', filters: [{ filterId: 'colour', value: [colour.family] }], basis: 'stated' },
      soft: false,
    });
  }
  for (const city of rows.cities) {
    dynamic.push({
      phrase: normalisePhrase(city.label),
      effect: { kind: 'filters', filters: [{ filterId: 'city', value: [city.key] }], basis: 'stated' },
      soft: false,
    });
  }
  for (const district of rows.districts) {
    dynamic.push({
      phrase: normalisePhrase(district.label),
      effect: {
        kind: 'filters',
        filters: [{ filterId: 'district', value: [district.key] }],
        basis: 'stated',
      },
      soft: false,
    });
  }
  // A district called «کن» is not read where the buyer wrote «پیدا کن»: no row's name that is a filler word or two letters.
  const usable = (phrase: Phrase) =>
    phrase.phrase.length > 2 && !phrase.phrase.split(' ').every((word) => FILLER_WORDS.has(word));
  const phrases = indexPhrases([...PHRASES, ...dynamic.filter(usable)]);

  // Single-word names for typo matching: only names long enough to tell a slip from another word.
  const typoWords = new Map<string, Entity[]>();
  for (const [phrase, list] of byPhrase) {
    if (phrase.includes(' ') || phrase.length < 4 || /\d/.test(phrase)) continue;
    typoWords.set(phrase, list);
  }

  const sortedModels = [...entities.values()]
    .filter((one) => one.level === 'model')
    .sort((a, b) => b.listings - a.listings || a.key.localeCompare(b.key));
  const labels = new Map<string, string>();
  for (const [key, one] of entities) labels.set(key, one.label);
  for (const list of trimsByModel.values())
    for (const trim of list) labels.set(trim.entity.key, trim.shortLabel);
  const places = new Map<string, string>();
  for (const city of rows.cities) places.set(`city:${city.key}`, city.label);
  for (const district of rows.districts) places.set(`district:${district.key}`, district.label);
  for (const body of rows.bodyTypes) places.set(`body_type:${body.code}`, body.label);
  for (const country of COUNTRIES) places.set(`country:${country.code}`, country.label);
  const countryCounts =
    rows.countries === undefined ? undefined : new Map(rows.countries.map((one) => [one.code, one.listings]));

  return {
    phrases,
    entityAt(tokens, at, free) {
      const longest = Math.min(maxWords, tokens.length - at);
      for (let length = longest; length >= 1; length -= 1) {
        if (!Array.from({ length }, (_, offset) => at + offset).every(free)) continue;
        const phrase = tokens
          .slice(at, at + length)
          .map((token) => token.norm)
          .join(' ');
        const found = byPhrase.get(phrase);
        if (found !== undefined && found.length > 0) return { from: at, to: at + length, entities: found };
      }
      return undefined;
    },
    typoOf(word) {
      // Five letters at least: a four-letter word has too many neighbours («پارس» and «پارک»).
      if (word.length < 5 || /\d/.test(word)) return undefined;
      const limit = word.length >= 9 ? 2 : 1;
      let best = limit + 1;
      let chosen: { word: string; entities: readonly Entity[] }[] = [];
      for (const [candidate, list] of typoWords) {
        if (candidate === word) return undefined;
        const distance = editDistance(word, candidate, limit);
        if (distance > limit) continue;
        if (distance < best) {
          best = distance;
          chosen = [{ word: candidate, entities: list }];
        } else if (distance === best) chosen.push({ word: candidate, entities: list });
      }
      const [only] = chosen;
      if (chosen.length !== 1 || only === undefined) return undefined;
      return only;
    },
    entity: (key) => entities.get(key),
    trimsOf: (modelKey) => trimsByModel.get(modelKey) ?? [],
    modelsOfMake: (makeKey) => sortedModels.filter((one) => one.makeKey === makeKey),
    searchableModels: () => sortedModels.filter((one) => one.listings > 0),
    labelOf(filterId, value) {
      if (filterId === 'make' || filterId === 'model' || filterId === 'trim') return labels.get(value);
      return places.get(`${filterId}:${value}`);
    },
    hasValue: (filterId, value) => places.has(`${filterId}:${value}`),
    options: (filterId) =>
      filterId === 'city'
        ? rows.cities.map((city) => ({ key: city.key, label: city.label }))
        : filterId === 'country'
          ? COUNTRIES.filter((country) => country.words.length > 0).map((country) => ({
              key: country.code,
              label: country.label,
            }))
          : rows.bodyTypes.map((body) => ({ key: body.code, label: body.label })),
    countryListings: (code) => countryCounts?.get(code),
    citiesNear(word) {
      if (word.length < 4) return [];
      return rows.cities
        .filter((city) => {
          const name = normalisePhrase(city.label);
          return name !== word && editDistance(word, name, 1) <= 1;
        })
        .map((city) => ({ key: city.key, label: city.label }));
    },
    near(word, limit) {
      if (word.length < 4 || /\d/.test(word)) return [];
      // A short word has too many neighbours at two edits: one slip for a word of five letters or fewer.
      const reach = word.length <= 5 ? 1 : 2;
      const found: { distance: number; entity: Entity }[] = [];
      for (const [candidate, list] of typoWords) {
        const distance = editDistance(word, candidate, reach);
        if (distance > reach) continue;
        for (const entity of list) found.push({ distance, entity });
      }
      return found
        .sort((a, b) => a.distance - b.distance || b.entity.listings - a.entity.listings)
        .slice(0, limit)
        .map((one) => one.entity);
    },
  };
}
