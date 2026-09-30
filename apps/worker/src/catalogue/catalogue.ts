import { DIVAR_MAKES } from './divar-catalogue.ts';

// The catalogue's pure rules (CS-50): slugs, and where a source's own model key belongs. Divar's keys nest by prefix:
// a make («Peugeot»), a model («Peugeot 206»: the make, a space, the rest) and a trim («Peugeot 206 5»: the model, a
// space, the rest). A key is placed under the longest make and then the longest model it starts with; a key under a
// make that names no known model is a model of its own, Divar's own value, learned (its body type then waits for a
// person).

/** A URL-safe slug from a name: Latin letters and digits, the rest folded to single hyphens; `fallback` when none. */
export function slugOf(name: string, fallback: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return slug === '' ? fallback : slug;
}

const MAKE_KEYS = Object.keys(DIVAR_MAKES).sort((a, b) => b.length - a.length);

export type PlacedKey =
  | { readonly level: 'make'; readonly make: string }
  | { readonly level: 'model'; readonly make: string; readonly model: string }
  | { readonly level: 'trim'; readonly make: string; readonly model: string; readonly trim: string };

/**
 * Where a Divar key belongs, given the model keys the catalogue knows (make key → model keys): undefined for a key under
 * no known make.
 */
export function placeDivarKey(
  key: string,
  modelsByMake: ReadonlyMap<string, readonly string[]>,
): PlacedKey | undefined {
  const make = MAKE_KEYS.find((candidate) => key === candidate || key.startsWith(`${candidate} `));
  if (make === undefined) return undefined;
  if (key === make) return { level: 'make', make };
  const models = [...(modelsByMake.get(make) ?? [])].sort((a, b) => b.length - a.length);
  const model = models.find((candidate) => key === candidate || key.startsWith(`${candidate} `));
  if (model === undefined || model === key) return { level: 'model', make, model: key };
  return { level: 'trim', make, model, trim: key };
}
