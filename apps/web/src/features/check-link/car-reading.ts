import type { Lexicon } from '@carshenas/search/understand/lexicon';
import { readCarFromTitle, titleOfSlug } from '@carshenas/search/understand/title-car';
import type { UnreadableReason } from '@/features/check-link/check-link-types';

// The car a pasted link is about, and whether Carshenas reads it (CS-115, ADR-0046). A listing we know has its own,
// structured model (Divar filed it there); for any other link the car is read from the title in the link's address with
// the catalogue's names (packages/search, title-car.ts), in code, never asking Divar. «Covered» is the model being read in
// depth now: a tracked model in the state tracking (ADR-0037), for the whole model. A title that names no model settles
// nothing about coverage unless it names a make none of whose models is covered: then whatever the model is, it is not
// read. A title that names no car, two cars, or a make some of whose models are covered, is not told: never «unsupported».

export type Coverage = {
  /** The `make.model` keys of the models read in depth now. */
  readonly modelKeys: ReadonlySet<string>;
  /** The makes that have at least one of them. */
  readonly makeKeys: ReadonlySet<string>;
};

export function coverageOf(modelKeys: readonly string[]): Coverage {
  return {
    modelKeys: new Set(modelKeys),
    makeKeys: new Set(modelKeys.map((key) => key.split('.')[0] ?? key)),
  };
}

export type CarOfLink =
  /** One model, and whether it is read in depth. */
  | { readonly kind: 'model'; readonly modelKey: string; readonly covered: boolean }
  /** Only a make, none of whose models is read: whatever the model is, Carshenas does not read it. */
  | { readonly kind: 'make_outside'; readonly makeKey: string }
  | { readonly kind: 'unreadable'; readonly reason: UnreadableReason; readonly makeKey: string | null };

/** The car a link's title names, or why it cannot be told. The model of a known listing never comes here. */
export function readCarOfLink(slug: string | null, lexicon: Lexicon, coverage: Coverage): CarOfLink {
  if (slug === null) return { kind: 'unreadable', reason: 'no_title', makeKey: null };
  const car = readCarFromTitle(titleOfSlug(slug), lexicon);
  switch (car.kind) {
    case 'model':
      return { kind: 'model', modelKey: car.model.key, covered: coverage.modelKeys.has(car.model.key) };
    case 'make':
      return coverage.makeKeys.has(car.make.key)
        ? { kind: 'unreadable', reason: 'make_only', makeKey: car.make.key }
        : { kind: 'make_outside', makeKey: car.make.key };
    case 'ambiguous':
      return { kind: 'unreadable', reason: 'two_cars', makeKey: null };
    case 'none':
      return { kind: 'unreadable', reason: 'no_car', makeKey: null };
  }
}
