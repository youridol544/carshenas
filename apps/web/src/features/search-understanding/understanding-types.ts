import type { Understanding } from '@carshenas/search/understand/types';

// What POST /api/search/understand answers (CS-62, docs/specs/S04-plain-farsi-search.md): the understanding of one
// sentence, and which way it was read. Shared by the route and the components, so neither imports the other.

/**
 * `code_only`: the master switch (SEARCH_UNDERSTANDING_AI) is off, its default, and code alone read the sentence;
 * `with_model`: it is on, and a model was asked only for what code could not settle (`understanding.modelUsed` says
 * whether it was, and `understanding.degraded` why not when it could not be).
 */
export type UnderstandMode = 'code_only' | 'with_model';

export type UnderstandResponse = {
  readonly mode: UnderstandMode;
  readonly understanding: Understanding;
};

/** Every non-200 answer carries a Farsi message for the person and nothing else. */
export type UnderstandError = { readonly message: string };
