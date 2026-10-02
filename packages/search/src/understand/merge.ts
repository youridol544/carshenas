// From claims to what the buyer sees (CS-62, S03 "What is shown"): the code pass's claims and the model's validated
// readings become one search, checked against the same schema the filter sheet uses, with a chip for every applied
// filter (stated or inferred, each removable), the suggestions that are not applied, every word that was not used and
// why, the notices, and one sentence saying what was understood. Everything a buyer reads here is written by code from
// the definitions and the locale's formatters: no model text and no number a model made reaches a page.
import { formatCount } from '@carshenas/locale/format-number';
import { CATALOGUES } from '../catalogues.ts';
import { filterById, type FilterId } from '../filters.ts';
import type { LabelOf, Range } from '../kinds.ts';
import {
  canonical,
  chipsOf,
  isCatalogueUnchanged,
  SearchFiltersSchema,
  type Search,
  type SearchFilters,
} from '../search.ts';
import type { SortId } from '../sorts.ts';
import type { Claim } from './claims.ts';
import {
  adjustmentsOf,
  intentById,
  resolveAdjustments,
  sortOfIntents,
  type Adjustment,
  type IntentId,
} from './intents.ts';
import type { Lexicon } from './lexicon.ts';
import { MAX_UNDERSTOOD_CHARACTERS, wordsOf, type CleanedQuery, type Token } from './text.ts';
import type {
  AppliedIntent,
  Basis,
  DegradedState,
  Note,
  NoteKind,
  Suggestion,
  UnderstoodChip,
  Understanding,
  UnusedReason,
  UnusedWords,
} from './types.ts';

export type MergeInput = {
  readonly cleaned: CleanedQuery;
  /** The code pass's claims and the model's validated ones, over the cleaned query's tokens. */
  readonly claims: readonly Claim[];
  readonly addressed: ReadonlySet<number>;
  readonly filler: ReadonlySet<number>;
  readonly lexicon: Lexicon;
  readonly modelUsed: boolean;
  readonly degraded: DegradedState | null;
};

/** Where an applied filter's value came from, for its chip. */
type Origin = {
  readonly by: 'code' | 'model';
  readonly basis: Basis;
  readonly words: string;
  readonly intent: IntentId | null;
  /** For a choice: the values this origin gave. */
  readonly values: readonly string[] | undefined;
};

type Proposed = Adjustment & { readonly claim: Claim };

type Group = { from: number; to: number; reason: UnusedReason; topic: string | null };

/** Two values of one filter combined: choices are united, ranges tightened, the smaller limit kept, the first rank. */
function combine(filterId: FilterId, first: unknown, second: unknown): unknown {
  const filter = filterById(filterId);
  switch (filter?.kind) {
    case 'choice':
      return [...new Set([...(first as string[]), ...(second as string[])])].sort();
    case 'range': {
      const a = first as Range;
      const b = second as Range;
      const min = a.min === undefined ? b.min : b.min === undefined ? a.min : Math.max(a.min, b.min);
      const max = a.max === undefined ? b.max : b.max === undefined ? a.max : Math.min(a.max, b.max);
      // Two statements that cannot both be true: the first stands.
      if (min !== undefined && max !== undefined && min > max) return first;
      return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
    }
    case 'limit':
      return Math.min(first as number, second as number);
    case 'flag':
    case 'ranked':
    case undefined:
      return first;
  }
}

const ARABIC_SCRIPT = /\p{Script=Arabic}/u;
const ENTITY_LEVEL = { make: 1, model: 2, trim: 3 } as const;

/** The notices, in Farsi, with their numbers through the locale's formatters. */
const NOTE_TEXT = {
  defaultScope: (words: string) => `«${words}» را فیلتر نکردم؛ همه‌ی آگهی‌های کارشناس از بازار تهران است.`,
  outsideMarket: (words: string) => `«${words}» را ندارم؛ فعلاً فقط بازار تهران در کارشناس است.`,
  notTracked: (label: string) => `آگهی‌های «${label}» هنوز در کارشناس جمع‌آوری نمی‌شود؛ نتیجه‌ای نمی‌بینید.`,
  addressed: 'بخشی از جمله خطاب به سیستم بود و نادیده گرفته شد.',
  hidden: 'نویسه‌های نامرئی جمله حذف شد.',
  cut: `فقط ${formatCount(MAX_UNDERSTOOD_CHARACTERS)} نویسه‌ی اول جمله خوانده شد.`,
  typo: (typed: string, meant: string) => `«${typed}» را «${meant}» خواندم.`,
} as const;

/** Runs of tokens that satisfy `member`; filler inside a run is allowed, a sentence's end or any other token closes it. */
function runs(
  tokens: readonly Token[],
  member: (token: Token) => boolean,
  passes: (token: Token) => boolean,
): { from: number; to: number }[] {
  const found: { from: number; to: number }[] = [];
  let open: { from: number; last: number } | undefined;
  for (const token of tokens) {
    const closes = open !== undefined && (token.breakBefore === 2 || !(member(token) || passes(token)));
    if (open !== undefined && closes) {
      found.push({ from: open.from, to: open.last + 1 });
      open = undefined;
    }
    if (member(token))
      open = open === undefined ? { from: token.index, last: token.index } : { ...open, last: token.index };
  }
  if (open !== undefined) found.push({ from: open.from, to: open.last + 1 });
  return found;
}

export function buildUnderstanding(input: MergeInput): Understanding {
  const { cleaned, lexicon } = input;
  const { text, tokens } = cleaned;
  const strong = input.claims.filter((claim) => claim.weak !== true);
  const weak = input.claims.filter((claim) => claim.weak === true);
  const words = (claim: Pick<Claim, 'from' | 'to'>) => wordsOf(text, tokens, claim.from, claim.to);

  // 1. What the buyer stated, combined per filter, and what the words only imply.
  const stated = new Map<FilterId, unknown>();
  const origins = new Map<FilterId, Origin[]>();
  const remember = (filterId: FilterId, origin: Origin) => {
    origins.set(filterId, [...(origins.get(filterId) ?? []), origin]);
  };
  const proposed: Proposed[] = [];
  for (const claim of strong) {
    for (const { filterId, value } of claim.filters) {
      if (claim.basis === 'inferred') {
        proposed.push({ filterId, value, intent: undefined, claim });
        continue;
      }
      stated.set(filterId, stated.has(filterId) ? combine(filterId, stated.get(filterId), value) : value);
      remember(filterId, {
        by: claim.by,
        basis: 'stated',
        words: words(claim),
        intent: null,
        values: Array.isArray(value) ? (value as string[]) : undefined,
      });
    }
  }
  const intentClaims = new Map<IntentId, Claim>();
  for (const claim of strong) {
    if (claim.intent !== undefined && !intentClaims.has(claim.intent)) intentClaims.set(claim.intent, claim);
  }
  const intentIds = [...intentClaims.keys()];
  for (const [id, claim] of intentClaims) {
    for (const adjustment of adjustmentsOf([id])) proposed.push({ ...adjustment, claim });
  }
  // A model implies its make: a make beside a model of it (read by code, and the model by the model step) is one name.
  const makes = stated.get('make');
  const models = stated.get('model');
  if (Array.isArray(makes) && Array.isArray(models)) {
    const implied = new Set((models as string[]).map((key) => key.split('.')[0]));
    const left = (makes as string[]).filter((key) => !implied.has(key));
    if (left.length > 0) stated.set('make', left);
    else stated.delete('make');
  }
  const statedFilters = Object.fromEntries(stated) as SearchFilters;
  const { applied } = resolveAdjustments(proposed, statedFilters);
  const claimOfAdjustment = new Map<Adjustment, Claim>(proposed.map((one) => [one, one.claim]));
  const filters: Record<string, unknown> = { ...statedFilters };
  for (const adjustment of applied) {
    const claim = claimOfAdjustment.get(adjustment);
    filters[adjustment.filterId] = adjustment.value;
    if (claim === undefined) continue;
    remember(adjustment.filterId, {
      by: claim.by,
      basis: 'inferred',
      words: words(claim),
      intent: adjustment.intent ?? null,
      values: Array.isArray(adjustment.value) ? (adjustment.value as string[]) : undefined,
    });
  }

  // 2. The order: the buyer's own, else the first bundle's.
  const sort: SortId | undefined = sortOfIntents(
    intentIds,
    strong.find((claim) => claim.sort !== undefined)?.sort,
  );

  // 3. The same schema the filter sheet and the URL use: a value it refuses is not applied, and its words stay unused.
  const dropped = new Set<string>();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const checked = SearchFiltersSchema.safeParse(filters);
    if (checked.success) break;
    const bad = new Set(checked.error.issues.map((issue) => String(issue.path[0] ?? '')));
    for (const id of bad) {
      Reflect.deleteProperty(filters, id);
      dropped.add(id);
    }
    if (bad.has('')) break;
  }
  let search: Search = canonical({
    filters,
    ...(sort === undefined ? {} : { sort }),
  });
  // A search with no filter is no catalogue: canonical() would expand any marker on it into that catalogue's filters.
  const bundle =
    Object.keys(search.filters).length === 0
      ? undefined
      : CATALOGUES.find((catalogue) => isCatalogueUnchanged({ ...search, catalogue: catalogue.id }));
  if (bundle !== undefined) search = { ...search, catalogue: bundle.id };

  // 4. Which words stay unused, and why: a wish the data cannot serve, a value no car has, a city the index lacks, text
  // addressed to the system, and every other word nobody read.
  const covered = new Set<number>();
  for (const claim of input.claims)
    for (let index = claim.from; index < claim.to; index += 1) covered.add(index);
  const groups: Group[] = [];
  for (const claim of input.claims) {
    const { from, to } = claim;
    if (claim.unsupported !== undefined)
      groups.push({ from, to, reason: 'unsupported', topic: claim.unsupported });
    else if (claim.implausible !== undefined)
      groups.push({ from, to, reason: 'implausible', topic: claim.implausible });
    else if (claim.scope === 'outside_market')
      groups.push({ from, to, reason: 'outside_market', topic: null });
    else if (claim.filters.some((one) => dropped.has(one.filterId)))
      groups.push({ from, to, reason: 'unknown', topic: null });
  }
  for (const run of runs(
    tokens,
    (token) =>
      !covered.has(token.index) && !input.filler.has(token.index) && !input.addressed.has(token.index),
    (token) => input.filler.has(token.index),
  )) {
    groups.push({ ...run, reason: 'unknown', topic: null });
  }
  for (const run of runs(
    tokens,
    (token) => input.addressed.has(token.index),
    () => false,
  )) {
    groups.push({ ...run, reason: 'addressed', topic: null });
  }
  groups.sort((a, b) => a.from - b.from);

  // 5. Nothing understood at all: the words become the text search.
  const understood =
    Object.keys(search.filters).length > 0 || search.sort !== undefined || intentIds.length > 0;
  const looseWords = groups
    .filter((group) => group.reason !== 'addressed' && group.reason !== 'implausible')
    .map((group) => words(group))
    .join(' ')
    .trim();
  const textSearch = !understood && looseWords !== '';
  if (textSearch) search = canonical({ ...search, q: looseWords.slice(0, MAX_UNDERSTOOD_CHARACTERS) });
  const unused: UnusedWords[] = groups.map((group) => ({
    words: words(group),
    reason: group.reason,
    topic: group.topic,
    asText:
      textSearch || group.reason === 'addressed' || group.reason === 'implausible'
        ? null
        : canonical({ ...search, q: words(group).slice(0, MAX_UNDERSTOOD_CHARACTERS) }),
  }));

  // 6. A chip for every applied filter, with the words it came from.
  const labelOf: LabelOf = (filterId, value) => lexicon.labelOf(filterId, value);
  const chips: UnderstoodChip[] = chipsOf(search, labelOf).map((chip) => {
    const own = origins.get(chip.filterId) ?? [];
    const value = chip.key.includes(':') ? chip.key.slice(chip.key.indexOf(':') + 1) : undefined;
    const origin = own.find((one) => value !== undefined && one.values?.includes(value) === true) ?? own[0];
    const basis: Basis = origin?.basis ?? 'stated';
    return {
      key: chip.key,
      filterId: chip.filterId,
      text: chip.text,
      basis,
      by: origin?.by ?? 'code',
      words: origin?.words ?? '',
      why:
        basis === 'inferred' && origin !== undefined && origin.words !== ''
          ? `چون نوشتید «${origin.words}»`
          : null,
      intent: origin?.intent ?? null,
      without: chip.without,
    };
  });
  // The buyer's own words first, then what the words only imply, each in the filters' order.
  chips.sort((a, b) => Number(a.basis === 'inferred') - Number(b.basis === 'inferred'));
  const appliedIntents: AppliedIntent[] = intentIds.map((id) => {
    const claim = intentClaims.get(id);
    return {
      id,
      title: intentById(id).title,
      words: claim === undefined ? '' : words(claim),
      adds: applied.filter((one) => one.intent === id).map((one) => one.filterId),
    };
  });

  // 7. Suggestions: weak readings, not applied, one tap to add.
  const suggestions: Suggestion[] = [];
  for (const claim of weak) {
    for (const { filterId, value } of claim.filters) {
      if ((search.filters as Record<string, unknown>)[filterId] !== undefined) continue;
      const only = { filters: { [filterId]: value } as SearchFilters };
      const [shown] = chipsOf(only, labelOf);
      if (shown === undefined) continue;
      suggestions.push({
        key: shown.key,
        filterId,
        text: shown.text,
        words: words(claim),
        why: `«${words(claim)}» شاید یعنی همین`,
        add: canonical({ ...search, filters: { ...search.filters, [filterId]: value } }),
      });
    }
  }

  // 8. The notices.
  const notes: Note[] = [];
  const note = (kind: NoteKind, noteText: string, about: string | null) => {
    if (!notes.some((one) => one.kind === kind && one.text === noteText))
      notes.push({ kind, text: noteText, words: about });
  };
  for (const claim of input.claims) {
    if (claim.scope === 'default_scope')
      note('default_scope', NOTE_TEXT.defaultScope(words(claim)), words(claim));
    if (claim.scope === 'outside_market')
      note('outside_market', NOTE_TEXT.outsideMarket(words(claim)), words(claim));
    if (claim.typo !== undefined)
      note('typo', NOTE_TEXT.typo(claim.typo.typed, claim.typo.meant), words(claim));
  }
  // One notice for each make that is not collected, however many of its names the buyer used («تیبا ۲» is a make and a
  // model): the most specific name that has a Farsi spelling, else the most specific name.
  const untracked = new Map<string, { label: string; farsi: boolean; level: number; words: string }>();
  for (const claim of input.claims) {
    if (claim.notTracked !== true) continue;
    const own = claim.filters.find((one) => one.filterId === 'trim') ?? claim.filters[0];
    const key = Array.isArray(own?.value) ? (own.value as string[])[0] : undefined;
    const entity = key === undefined ? undefined : lexicon.entity(key);
    const label = entity?.label ?? words(claim);
    const found = {
      label,
      farsi: ARABIC_SCRIPT.test(label),
      level: entity === undefined ? 0 : ENTITY_LEVEL[entity.level],
      words: words(claim),
    };
    const group = entity?.makeKey ?? key ?? words(claim);
    const kept = untracked.get(group);
    if (
      kept === undefined ||
      (found.farsi && !kept.farsi) ||
      (found.farsi === kept.farsi && found.level > kept.level)
    )
      untracked.set(group, found);
  }
  for (const one of untracked.values()) note('not_tracked', NOTE_TEXT.notTracked(one.label), one.words);
  if (input.addressed.size > 0) note('addressed', NOTE_TEXT.addressed, null);
  if (cleaned.hidden) note('hidden_characters', NOTE_TEXT.hidden, null);
  if (cleaned.cut) note('cut', NOTE_TEXT.cut, null);

  return {
    query: text,
    search,
    chips,
    intents: appliedIntents,
    suggestions,
    unused,
    notes,
    explanation: explain(chips, textSearch),
    textSearch,
    modelUsed: input.modelUsed,
    degraded: input.degraded,
  };
}

/** One Farsi sentence: the stated chips, then each bundle's words with what they added. */
function explain(chips: readonly UnderstoodChip[], textSearch: boolean): string {
  const stated = chips.filter((chip) => chip.basis === 'stated').map((chip) => chip.text);
  const inferred = new Map<string, string[]>();
  for (const chip of chips) {
    if (chip.basis === 'inferred') inferred.set(chip.words, [...(inferred.get(chip.words) ?? []), chip.text]);
  }
  const parts: string[] = [];
  if (stated.length > 0) parts.push(`فهمیدم: ${stated.join('، ')}.`);
  for (const [wordsOfChips, texts] of inferred) {
    parts.push(
      wordsOfChips === ''
        ? `این‌ها را هم گذاشتم: ${texts.join('، ')}.`
        : `برای «${wordsOfChips}» این‌ها را هم گذاشتم: ${texts.join('، ')}.`,
    );
  }
  if (parts.length > 0) return parts.join(' ');
  return textSearch
    ? 'فیلتری از این جمله نساختم؛ آن را در متن آگهی‌ها جست‌وجو می‌کنم.'
    : 'فیلتر خاصی از این جمله نساختم.';
}
