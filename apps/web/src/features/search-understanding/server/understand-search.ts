import 'server-only';
import type { Lexicon } from '@carshenas/search/understand/lexicon';
import {
  understandQuery,
  type ModelStep,
  type UnderstandTrace,
} from '@carshenas/search/understand/understand';
import type { UnderstandResponse } from '@/features/search-understanding/understanding-types';

// One sentence through plain-Farsi search (CS-62): code reads it, and the model is asked only about what code could
// not settle, and only when there is a model step to ask (the master switch is on and the question is allowed).
// The lexicon and the model step come in as parameters, so the route binds the real ones and a test binds its own.

export type UnderstandDependencies = {
  readonly lexicon: () => Promise<Lexicon>;
  /** Absent when the master switch is off: code answers alone and says why when it needed more. */
  readonly model?: ModelStep;
};

export async function understandSentence(
  typed: string,
  dependencies: UnderstandDependencies,
): Promise<{ response: UnderstandResponse; trace: UnderstandTrace }> {
  const { understanding, trace } = await understandQuery(typed, {
    lexicon: await dependencies.lexicon(),
    ...(dependencies.model === undefined
      ? { withoutModel: 'switched_off' as const }
      : { model: dependencies.model }),
  });
  return {
    response: { mode: dependencies.model === undefined ? 'code_only' : 'with_model', understanding },
    trace,
  };
}
