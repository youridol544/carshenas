// A search: free words, the filters' values, an order and the catalogue it came from (CS-58, ADR-0027). One zod schema
// checks it wherever it arrives from (a URL, the search API's body, a stored search file, plain-Farsi search's model
// output), and it has one URL form and one stored JSON form, both built from the filter definitions. Runs in the
// browser.
import { z } from 'zod';
import { CATALOGUES, CATALOGUE_IDS, type CatalogueId } from './catalogues.ts';
import { FILTERS, type AnyFilter, type FilterId } from './filters.ts';
import { decodeValue, encodeValue, optionLabel, rangeText, type LabelOf, type Range, type RangeUnit } from './kinds.ts';
import { DEFAULT_SORT, SORT_IDS } from './sorts.ts';

type FilterShape = { [F in AnyFilter as F['id']]: z.ZodOptional<F['schema']> };

// Object.fromEntries loses the keys' types; FilterShape restores them from the same list.
const FILTER_SHAPE = Object.fromEntries(
  FILTERS.map((filter) => [filter.id, filter.schema.optional()]),
) as FilterShape;

/** The filters' values, each optional, each checked by its own filter's schema; no other key. */
export const SearchFiltersSchema = z.strictObject(FILTER_SHAPE);
export type SearchFilters = z.output<typeof SearchFiltersSchema>;
export type FilterValue<Id extends FilterId> = NonNullable<SearchFilters[Id]>;

export const MAX_QUERY_LENGTH = 200;

const SearchObject = z.strictObject({
  /** Words to find in listings' text (CS-59 matches them); what plain-Farsi search could not turn into filters. */
  q: z.string().trim().min(1).max(MAX_QUERY_LENGTH).optional(),
  filters: SearchFiltersSchema,
  /** Absent means best deal first. */
  sort: z.enum(SORT_IDS).optional(),
  /** The catalogue the search was opened from; its title shows while the filters are still the catalogue's. */
  catalogue: z.enum(CATALOGUE_IDS).optional(),
});
export type Search = z.output<typeof SearchObject>;

/**
 * A search from outside (the API's body, plain-Farsi search's answer), checked and put in its canonical form, so a
 * bare catalogue arrives with its filters.
 */
export const SearchSchema = SearchObject.transform((search): Search => canonical(search));

export const EMPTY_SEARCH: Search = { filters: {} };

/** A search file's stored form (CS-70): the search with its schema version, the catalogue always expanded. */
export const StoredSearchSchema = SearchObject.extend({ v: z.literal(1) });
export type StoredSearch = z.output<typeof StoredSearchSchema>;

/**
 * The one form of a search that the URL, the API and a stored file agree on: a bare catalogue expanded, words trimmed
 * and single-spaced, a choice's values in code-point order, filters in their definitions' order, the default order
 * left out.
 */
export function canonical(search: Search): Search {
  // A catalogue named with nothing else (a link, or plain-Farsi search answering «تمیز و بی‌دردسر») is that catalogue:
  // its filters and order, expanded here so the API and a search file search exactly what the URL form shows. With
  // any word, filter or order beside it, those are the search and the catalogue is only where it started.
  const nothingElse =
    search.q === undefined &&
    search.sort === undefined &&
    FILTERS.every((filter) => (search.filters[filter.id] as unknown) === undefined);
  if (search.catalogue !== undefined && nothingElse) return catalogueSearch(search.catalogue);
  const filters: Record<string, unknown> = {};
  for (const filter of FILTERS) {
    const value: unknown = search.filters[filter.id];
    if (value === undefined) continue;
    filters[filter.id] = Array.isArray(value) ? [...(value as string[])].sort() : value;
  }
  const q = search.q?.replace(/\s+/g, ' ').trim();
  return {
    ...(q === undefined || q === '' ? {} : { q }),
    filters: filters,
    ...(search.sort === undefined || search.sort === DEFAULT_SORT ? {} : { sort: search.sort }),
    ...(search.catalogue === undefined ? {} : { catalogue: search.catalogue }),
  };
}

/** A catalogue's search: its filters and order, marked as coming from it. */
export function catalogueSearch(id: CatalogueId): Search {
  const found = CATALOGUES.find((candidate) => candidate.id === id);
  if (found === undefined) throw new RangeError(`no catalogue ${id}`);
  return canonical({ filters: found.filters, sort: found.sort, catalogue: id });
}

/** True while a search opened from a catalogue still has exactly that catalogue's filters, order and no words. */
export function isCatalogueUnchanged(search: Search): boolean {
  if (search.catalogue === undefined || search.q !== undefined) return false;
  return JSON.stringify(canonical(search)) === JSON.stringify(catalogueSearch(search.catalogue));
}

// The URL form.

const QUERY_PARAM = 'q';
const SORT_PARAM = 'sort';
const CATALOGUE_PARAM = 'catalogue';

/**
 * A search as URL parameters, in a fixed order: an unchanged catalogue is its name alone («?catalogue=family»);
 * anything else lists its words, filters and order, with the catalogue it started from.
 */
export function toSearchParams(search: Search): URLSearchParams {
  const form = canonical(search);
  const params = new URLSearchParams();
  if (form.catalogue !== undefined && isCatalogueUnchanged(form)) {
    params.set(CATALOGUE_PARAM, form.catalogue);
    return params;
  }
  if (form.q !== undefined) params.set(QUERY_PARAM, form.q);
  for (const filter of FILTERS) {
    const value: unknown = form.filters[filter.id];
    if (value === undefined) continue;
    for (const text of encodeValue(filter, value)) params.append(filter.param, text);
  }
  if (form.sort !== undefined) params.set(SORT_PARAM, form.sort);
  if (form.catalogue !== undefined) params.set(CATALOGUE_PARAM, form.catalogue);
  return params;
}

export type ParsedSearch = {
  readonly search: Search;
  /** Parameters this search knows whose values it could not use; the page says so instead of dropping them silently. */
  readonly ignored: readonly string[];
};

/**
 * A search from URL parameters. A catalogue's name alone opens the catalogue; with any word, filter or order beside
 * it, those are the search and the catalogue is only where it started. Each unusable value is left out and named;
 * parameters the search does not know (a campaign tag) are passed over.
 */
export function fromSearchParams(params: URLSearchParams): ParsedSearch {
  const ignored: string[] = [];
  const catalogueText = params.get(CATALOGUE_PARAM);
  const catalogue = catalogueText === null ? undefined : z.enum(CATALOGUE_IDS).safeParse(catalogueText);
  if (catalogue !== undefined && !catalogue.success) ignored.push(CATALOGUE_PARAM);
  const catalogueId = catalogue?.success === true ? catalogue.data : undefined;

  const ownParams = [QUERY_PARAM, SORT_PARAM, ...FILTERS.map((filter) => filter.param)];
  const hasOwn = ownParams.some((name) => params.has(name));
  if (catalogueId !== undefined && !hasOwn) return { search: catalogueSearch(catalogueId), ignored };

  const filters: Record<string, unknown> = {};
  for (const filter of FILTERS) {
    const texts = params.getAll(filter.param);
    if (texts.length === 0) continue;
    const parsed = filter.schema.safeParse(decodeValue(filter, texts));
    if (parsed.success) filters[filter.id] = parsed.data;
    else ignored.push(filter.param);
  }
  // Words are never refused: an empty box is no words, and a pasted essay keeps its first 200 characters.
  const words = params.get(QUERY_PARAM)?.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH).trim();
  const sortText = params.get(SORT_PARAM);
  const sort = sortText === null ? undefined : z.enum(SORT_IDS).safeParse(sortText);
  if (sort !== undefined && !sort.success) ignored.push(SORT_PARAM);

  return {
    search: canonical({
      ...(words === undefined || words === '' ? {} : { q: words }),
      filters: filters,
      ...(sort?.success === true ? { sort: sort.data } : {}),
      ...(catalogueId === undefined ? {} : { catalogue: catalogueId }),
    }),
    ignored,
  };
}

/** Next.js's searchParams prop as URLSearchParams, a repeated parameter keeping every value. */
export function paramsFromRecord(record: Readonly<Record<string, string | readonly string[] | undefined>>) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(record)) {
    for (const text of typeof value === 'string' ? [value] : (value ?? [])) params.append(name, text);
  }
  return params;
}

/** The link to a search: «/search?catalogue=family», «/search?make=peugeot&price=..1000000000». */
export function searchHref(search: Search, path = '/search'): string {
  const query = toSearchParams(search).toString();
  return query === '' ? path : `${path}?${query}`;
}

// The stored form: search files (CS-70) and the search API's JSON body.

/** A search as a search file stores it: canonical, versioned, a catalogue always expanded to its filters. */
export function toStoredSearch(search: Search): StoredSearch {
  return { v: 1, ...canonical(search) };
}

/** A stored search read back; a row that no longer fits the schema is an error the caller shows, never a guess. */
export function fromStoredSearch(stored: unknown): z.ZodSafeParseResult<Search> {
  const parsed = StoredSearchSchema.safeParse(stored);
  if (!parsed.success) return parsed;
  const { v: _version, ...search } = parsed.data;
  return { success: true, data: canonical(search) };
}

// Chips: the applied values, each removable.

export type Chip = {
  /** Unique in a chip row: the filter's id, and the value for a choice. */
  readonly key: string;
  readonly filterId: FilterId;
  readonly text: string;
  /** The search without this chip, and no longer marked as its catalogue. */
  readonly without: Search;
};

/** The applied filters as chips, in the filters' order; a choice gives one chip per chosen value. */
export function chipsOf(search: Search, labelOf?: LabelOf): Chip[] {
  const form = canonical(search);
  const { catalogue: _catalogue, ...rest } = form;
  const chips: Chip[] = [];
  for (const filter of FILTERS) {
    const value: unknown = form.filters[filter.id];
    if (value === undefined) continue;
    const without = (next: unknown): Search => ({
      ...rest,
      filters: { ...form.filters, [filter.id]: next },
    });
    switch (filter.kind) {
      case 'choice':
        for (const chosen of value as string[]) {
          const others = (value as string[]).filter((other) => other !== chosen);
          chips.push({
            key: `${filter.id}:${chosen}`,
            filterId: filter.id,
            text: optionLabel(filter, chosen, labelOf),
            without: canonical(without(others.length === 0 ? undefined : others)),
          });
        }
        break;
      case 'ranked':
        chips.push(chipOf(filter, optionLabel(filter, value as string), without));
        break;
      case 'range':
        chips.push(chipOf(filter, rangeChip(filter.id, filter.unit, value as Range), without));
        break;
      case 'limit':
        chips.push(chipOf(filter, filter.chip(value as number), without));
        break;
      case 'flag':
        chips.push(chipOf(filter, filter.label, without));
        break;
    }
  }
  return chips;
}

/**
 * A search as a short list of texts, for a list of search files, an admin screen or a notification: an unchanged
 * catalogue is its title alone; any other search is its words, then the chips' texts in the filters' order.
 */
export function describeSearch(search: Search, labelOf?: LabelOf): string[] {
  const form = canonical(search);
  if (form.catalogue !== undefined && isCatalogueUnchanged(form)) {
    const found = CATALOGUES.find((candidate) => candidate.id === form.catalogue);
    if (found !== undefined) return [found.title];
  }
  return [...(form.q === undefined ? [] : [form.q]), ...chipsOf(form, labelOf).map((chip) => chip.text)];
}

function chipOf(filter: AnyFilter, text: string, without: (next: unknown) => Search): Chip {
  return { key: filter.id, filterId: filter.id, text, without: canonical(without(undefined)) };
}

// A year range says it is a model year; a price or mileage range says so by its unit.
function rangeChip(id: FilterId, unit: RangeUnit, value: Range): string {
  const text = rangeText(unit, value);
  if (unit === 'year') return `مدل ${text}`;
  if (id === 'mileage') return `کارکرد ${text}`;
  if (unit === 'cc') return `حجم موتور ${text}`;
  return text;
}
