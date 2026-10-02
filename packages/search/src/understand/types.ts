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

export type FilterRef = { readonly filterId: FilterId };

export type { IntentId, Search };
