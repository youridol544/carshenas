import type { Search } from '@carshenas/search/search';
import { MAX_REQUESTS_PER_FILE } from '@/lib/crawl-requests-rules';

// What a search file asks a deeper crawl of (CS-71, ADR-0032): the models and trims its search names, in the catalogue's
// slugs (a model is `make.model`, a trim `make.model.trim`, ADR-0027). A crawl is chosen by model, so a file that names
// only a make asks for nothing yet. A trim the file names is its own scope and covers its model: the model alone is
// asked for only when the file names it without one of its trims. Pure and shared by the page and the action.

export type RequestScope = {
  /** `make.model` or `make.model.trim`: the filter's own value, unique within a file's scopes. */
  readonly key: string;
  readonly makeSlug: string;
  readonly modelSlug: string;
  /** Null asks for the whole model. */
  readonly trimSlug: string | null;
};

export type RequestScopes = {
  readonly scopes: readonly RequestScope[];
  /** The file names more models and trims than one file may ask for. */
  readonly tooMany: boolean;
};

function parts(key: string): readonly string[] {
  return key.split('.');
}

export function requestScopesOf(filters: Search['filters']): RequestScopes {
  const trims = [...new Set(filters.trim ?? [])].sort();
  const models = [...new Set(filters.model ?? [])].sort();
  const scopes: RequestScope[] = [];
  const covered = new Set<string>();
  for (const key of trims) {
    const [makeSlug, modelSlug, trimSlug] = parts(key);
    if (makeSlug === undefined || modelSlug === undefined || trimSlug === undefined) continue;
    covered.add(`${makeSlug}.${modelSlug}`);
    scopes.push({ key, makeSlug, modelSlug, trimSlug });
  }
  for (const key of models) {
    const [makeSlug, modelSlug] = parts(key);
    if (makeSlug === undefined || modelSlug === undefined || covered.has(key)) continue;
    scopes.push({ key, makeSlug, modelSlug, trimSlug: null });
  }
  return { scopes, tooMany: scopes.length > MAX_REQUESTS_PER_FILE };
}
