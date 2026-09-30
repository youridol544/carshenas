// What happens to a listing.facts answer after the layer validated it (CS-52): each fact's confidence, computed in
// code from signals outside the model, never a confidence the model states (the owner's decision of 2026-09-30;
// ai-features references/structured-output.md, "Confidence and review thresholds"), and the call site's next step.
// A fact below its threshold waits in the review queue and is not used; the whole extraction waits for a person when
// the listing addressed the model or hides tag characters.
import type { AiResult } from '../ai.ts';
import type { Outcome } from '../call.ts';
import type { Problem } from '../task.ts';
import {
  FACTS,
  GLOSSARY,
  textRead,
  type Fact,
  type ListingFacts,
  type ListingFactsInput,
  type Term,
  type WORDED_FACTS,
} from './listing-facts.ts';
import { addressedSpans, hasTagCharacters, wordStarts } from './listing-text.ts';

/**
 * What CS-34 parsed from the site's own fields for the same listing, in the listing table's values. Null where the
 * site did not say. The model never sees these; they only raise or lower confidence.
 */
export type ParsedFields = {
  readonly priceType: 'asking' | 'negotiable' | 'installment' | 'placeholder' | null;
  readonly acceptsInstallments: boolean | null;
  readonly acceptsSwap: boolean | null;
  readonly bodyCondition: string | null;
  readonly frontChassisCondition: string | null;
  readonly rearChassisCondition: string | null;
};

export const NOTHING_PARSED: ParsedFields = {
  priceType: null,
  acceptsInstallments: null,
  acceptsSwap: null,
  bodyCondition: null,
  frontChassisCondition: null,
  rearChassisCondition: null,
};

/** The signals behind one fact's confidence. Null means the signal says nothing either way. */
export type Signals = {
  /** The evidence was copied verbatim from the text, from a word's start (always true for an ok answer). */
  readonly grounded: boolean;
  /** Whether the value is among those whose glossary words the text writes; null when it writes none. */
  readonly glossaryAgrees: boolean | null;
  /** Answered right the first time, without the re-ask. */
  readonly firstAnswer: boolean;
  /** Whether the value agrees with what CS-34 parsed from the site's fields; null when the site says nothing on it. */
  readonly parsedAgrees: boolean | null;
};

/**
 * How much each signal lowers confidence from 1: one disagreement alone falls below the default threshold, a re-ask
 * alone does not. Weights of the first version, to be set again from the development split's errors.
 */
export const PENALTY = { glossary: 0.4, parsed: 0.4, reask: 0.15 } as const;

/** Each fact's review threshold; extraction_field_def stores the same numbers. */
export const THRESHOLD: Readonly<Record<Fact, number>> = Object.fromEntries(
  FACTS.map((fact) => [fact, 0.75]),
) as Record<Fact, number>;

/**
 * The values of a fact whose glossary words the text writes where a word starts, outside any note to an AI. A word
 * inside a longer word of another value is that value's («معاوضه» inside «معاوضه ندارم» is a refusal, not an offer).
 */
export function valuesTheWordsState(fact: (typeof WORDED_FACTS)[number], text: string): string[] {
  const terms: Readonly<Record<string, Term>> = GLOSSARY[fact].terms;
  const found = Object.entries(terms).flatMap(([value, term]) =>
    term.words.flatMap((word) =>
      wordStarts(text, word).map((at) => ({ value, from: at, to: at + word.length })),
    ),
  );
  const stated = found.filter(
    (match) =>
      !found.some(
        (other) =>
          other.value !== match.value &&
          other.from <= match.from &&
          other.to >= match.to &&
          other.to - other.from > match.to - match.from,
      ),
  );
  return [...new Set(stated.map((match) => match.value))];
}

const PAINT_OF_BODY: Readonly<Record<string, readonly string[]>> = {
  intact: ['none'],
  paintless_dent_repair: ['none', 'spots'],
  minor_scratches: ['none', 'spots'],
  partly_repainted: ['partial', 'spots'],
  repainted_around: ['around', 'full', 'partial'],
  fully_repainted: ['full', 'around'],
};

/** Whether a stated value agrees with the site's parsed field; null when the site says nothing about the fact. */
export function agreesWithParsed(fact: Fact, value: string, parsed: ParsedFields): boolean | null {
  if (value === 'not_stated') return null;
  switch (fact) {
    case 'negotiable':
      return parsed.priceType === 'negotiable' ? value === 'yes' : null;
    case 'installment':
      return parsed.acceptsInstallments === true ? value === 'yes' : null;
    case 'swap':
      return parsed.acceptsSwap === true ? value === 'yes' : null;
    case 'paint': {
      const expected = parsed.bodyCondition === null ? undefined : PAINT_OF_BODY[parsed.bodyCondition];
      return expected === undefined ? null : expected.includes(value);
    }
    case 'chassis': {
      const sides = [parsed.frontChassisCondition, parsed.rearChassisCondition];
      if (sides.some((side) => side === 'damaged' || side === 'repainted')) return value === 'damaged';
      if (sides.every((side) => side === 'intact')) return value === 'intact';
      return null;
    }
    default:
      return null;
  }
}

export function signalsOf(
  fact: Fact,
  facts: ListingFacts,
  text: string,
  attempts: number,
  parsed: ParsedFields,
): Signals {
  const value = facts[fact];
  let glossaryAgrees: boolean | null = null;
  if (fact !== 'panels') {
    const stated = valuesTheWordsState(fact, text);
    if (stated.length > 0) glossaryAgrees = stated.includes(value);
  }
  return {
    grounded: true,
    glossaryAgrees,
    firstAnswer: attempts <= 1,
    parsedAgrees: agreesWithParsed(fact, value, parsed),
  };
}

export function confidenceOf(signals: Signals): number {
  if (!signals.grounded) return 0;
  let confidence = 1;
  if (signals.glossaryAgrees === false) confidence -= PENALTY.glossary;
  if (signals.parsedAgrees === false) confidence -= PENALTY.parsed;
  if (!signals.firstAnswer) confidence -= PENALTY.reask;
  return Math.max(0, Math.round(confidence * 1000) / 1000);
}

/** Why a whole extraction waits for a person before any of its facts is used (CS-43, pattern 22). */
export type HoldReason = 'addressed_model' | 'hidden_characters';

export type FieldReading = {
  readonly fact: Fact;
  readonly value: string;
  readonly evidence: string;
  readonly signals: Signals;
  readonly confidence: number;
  readonly threshold: number;
  /** Accepted fields may be used; the others wait in the review queue and are not used. */
  readonly accepted: boolean;
};

export type NextStep =
  | {
      readonly action: 'store';
      readonly answerId: number | undefined;
      readonly fields: readonly FieldReading[];
      /** Empty when the accepted fields can be used at once. */
      readonly hold: readonly HoldReason[];
    }
  | {
      readonly action: 'review';
      readonly outcome: Exclude<Outcome, 'ok'>;
      /** For the review queue in the database, never for a log line: a problem quotes the listing. */
      readonly problems: readonly Problem[];
    };

/**
 * The call site: only an ok result has a value; everything else goes to review with its problems and no value. An ok
 * answer is stored field by field with its confidence; a field below its threshold waits for review, and the whole
 * extraction waits when the listing addressed the model (the model's flag or the code's own reading) or hides tag
 * characters.
 */
export function nextStep(
  result: AiResult<ListingFacts>,
  listing: ListingFactsInput,
  parsed: ParsedFields = NOTHING_PARSED,
): NextStep {
  if (result.outcome !== 'ok')
    return { action: 'review', outcome: result.outcome, problems: result.problems };
  const facts = result.value;
  const text = textRead(listing);
  const attempts = result.attempts.length;
  const fields = FACTS.map((fact): FieldReading => {
    const signals = signalsOf(fact, facts, text, attempts, parsed);
    const confidence = confidenceOf(signals);
    const threshold = THRESHOLD[fact];
    return {
      fact,
      value: facts[fact],
      evidence: facts[`${fact}_evidence`],
      signals,
      confidence,
      threshold,
      accepted: confidence >= threshold,
    };
  });
  const hold: HoldReason[] = [];
  if (facts.instructions_to_ai || addressedSpans(text).length > 0) hold.push('addressed_model');
  if (hasTagCharacters(`${listing.title}\n${listing.description}`)) hold.push('hidden_characters');
  return { action: 'store', answerId: result.answerId, fields, hold };
}
