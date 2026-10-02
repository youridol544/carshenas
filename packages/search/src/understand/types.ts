// The vocabulary plain-Farsi search shares between its code, its model step, the API and the interface (CS-62,
// docs/specs/S03-plain-farsi-search.md). Runs in the browser: types and constants only.
import type { FilterId } from '../filters.ts';
import type { Search } from '../search.ts';
import type { IntentId } from './intents.ts';

/** The notices a buyer is told: each has Farsi text built by code (merge.ts), never by a model. */
export const NOTE_KINDS = [
  /** «تهران»: the index is Tehran's market, so naming it adds no filter. */
  'default_scope',
  /** Another city: the index does not cover it. */
  'outside_market',
  /** A make or model the catalogue knows but no searchable listing has. */
  'not_tracked',
  /** Words addressed to the system were left out. */
  'addressed',
  /** Hidden characters were in the query and were dropped. */
  'hidden_characters',
  /** More than 200 characters were typed; only the first words were read. */
  'cut',
  /** A word was read as another («پزو» as «پژو»). */
  'typo',
] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** Why some of the buyer's words are not used. */
export const UNUSED_REASONS = [
  /** No filter or catalogue entry could be matched to them. */
  'unknown',
  /** A wish the data cannot serve (fuel economy, a sunroof, an engine size). */
  'unsupported',
  /** A place the index does not cover. */
  'outside_market',
  /** Text addressed to the system. */
  'addressed',
  /** A value no car has (a price of one toman). */
  'implausible',
] as const;
export type UnusedReason = (typeof UNUSED_REASONS)[number];

/** Why the step answered without the model's help. */
export const DEGRADED_REASONS = [
  /** The master switch (SEARCH_UNDERSTANDING_AI) is off, which is its default: code answers alone. */
  'switched_off',
  /** The model is not configured here (no key) or Metis is unreachable. */
  'unavailable',
  /** This visitor asked too often within the hour. */
  'visitor_limit',
  /** Today's spending cap is reached. */
  'daily_cap',
  /** Too many questions are with the model at once. */
  'busy',
  /** The model did not answer within the deadline. */
  'timeout',
  /** The model answered something that did not pass the checks. */
  'invalid_answer',
] as const;
export type DegradedReason = (typeof DEGRADED_REASONS)[number];

/** How an applied filter came about: the buyer's words name it, or a documented mapping implies it. */
export type Basis = 'stated' | 'inferred';

/** One applied filter, shown as a chip the buyer can remove. */
export type UnderstoodChip = {
  /** Unique in a row of chips: the filter's id, and the value for a choice (chipsOf). */
  readonly key: string;
  readonly filterId: FilterId;
  /** The Farsi text, from the filter's definition and the locale's formatters. */
  readonly text: string;
  /** Stated: the buyer's words name it. Inferred: a documented mapping implies it, and `why` says which words. */
  readonly basis: Basis;
  readonly by: 'code' | 'model';
  /** The buyer's own words it comes from; empty when none. */
  readonly words: string;
  /** For an inferred chip: the sentence that says why it is there. */
  readonly why: string | null;
  /** The bundle it came from, when it came from one. */
  readonly intent: IntentId | null;
  /** The search without this chip, no longer marked as its catalogue. */
  readonly without: Search;
};

/** A filter the step is not sure of: not applied, one tap to add. */
export type Suggestion = {
  readonly key: string;
  /** The filter it would add; null for a whole bundle. */
  readonly filterId: FilterId | null;
  readonly text: string;
  readonly words: string;
  readonly why: string;
  /** The search with the filter added. */
  readonly add: Search;
};

/** Words the step could not use, shown to the buyer, never dropped. */
export type UnusedWords = {
  /** The buyer's own words, as typed. */
  readonly words: string;
  readonly reason: UnusedReason;
  /** For an unsupported wish: its topic in Farsi («مصرف سوخت»). */
  readonly topic: string | null;
  /** The current search with these words added as the text search (one tap to look for them in listings' text); null when that makes no sense (text addressed to the system, a value no car has). */
  readonly asText: Search | null;
};

export type Note = {
  readonly kind: NoteKind;
  /** Farsi, written by code. */
  readonly text: string;
  /** The words it is about, when it is about some. */
  readonly words: string | null;
};

export type AppliedIntent = {
  readonly id: IntentId;
  readonly title: string;
  /** The buyer's words that asked for it. */
  readonly words: string;
  /** The filters it added, after the conflict rules. */
  readonly adds: readonly FilterId[];
};

export type DegradedState = {
  readonly reason: DegradedReason;
  /** Farsi, written by code: what the buyer is told. */
  readonly message: string;
};

/** What the step understood of a buyer's words: the search, and everything the buyer needs to check and change it. */
export type Understanding = {
  /** The words as read: cleaned and cut. */
  readonly query: string;
  /** Validated against the search schema, the same one the filter sheet and the URL use. */
  readonly search: Search;
  readonly chips: readonly UnderstoodChip[];
  readonly intents: readonly AppliedIntent[];
  readonly suggestions: readonly Suggestion[];
  readonly unused: readonly UnusedWords[];
  readonly notes: readonly Note[];
  /** One Farsi sentence: what was understood. Numbers come from the chips, never from a model. */
  readonly explanation: string;
  /** Nothing was understood, so the words became the text search. */
  readonly textSearch: boolean;
  /** A model's reading shaped the answer (a fresh call or a cached one). */
  readonly modelUsed: boolean;
  /** Set when the step answered without the model it wanted: what the buyer sees and why. */
  readonly degraded: DegradedState | null;
};

export type { IntentId, Search };
