// What a group of the buyer's words was read as (CS-62, S03): the one record the code pass, the model's readings and
// the merge all speak. A claim covers tokens [from, to); the words nobody claims are the unused words.
import type { FilterId } from '../filters.ts';
import type { SortId } from '../sorts.ts';
import type { IntentId } from './intents.ts';
import type { Basis } from './types.ts';

export type FilterValue = { readonly filterId: FilterId; readonly value: unknown };

export type Claim = {
  /** Tokens [from, to) of the cleaned query. */
  readonly from: number;
  readonly to: number;
  readonly by: 'code' | 'model';
  /** Stated: the words name it. Inferred: the words imply it by a documented mapping. */
  readonly basis: Basis;
  readonly filters: readonly FilterValue[];
  readonly intent?: IntentId;
  readonly sort?: SortId;
  /** Tehran, which adds no filter, or a city the index does not cover. */
  readonly scope?: 'default_scope' | 'outside_market';
  /** A wish the data cannot serve, as the topic's Farsi name. */
  readonly unsupported?: string;
  /** A value no car has (a price of one toman); the topic's Farsi name. The words are shown, not applied. */
  readonly implausible?: string;
  /** A catalogue entry no searchable listing has. */
  readonly notTracked?: boolean;
  /** A word read as another: what the buyer typed, and the name it was read as. */
  readonly typo?: { readonly typed: string; readonly meant: string };
  /** A weak reading from the model: offered as a suggestion, never applied. */
  readonly weak?: boolean;
  /** Where in the pipeline it came from, for tests and the log: `entity`, `phrase`, `price`, `year`, `model`. */
  readonly source: string;
};

export function claimOf(
  from: number,
  to: number,
  source: string,
  rest: Partial<Omit<Claim, 'from' | 'to' | 'source'>> = {},
): Claim {
  return { from, to, by: 'code', basis: 'stated', filters: [], source, ...rest };
}
