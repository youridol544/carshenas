// The address of a model's page (CS-67), shared by the model page, the search cards, the listing page and the home page,
// which must all agree on it and may not import each other: /models/<make slug>/<model slug>, with the model year in
// `?year=` when one is chosen. The slugs are the catalogue's; a search key «make.model» names the same model.

/** The address of a model's page, for one model year or all of them. */
export function modelHref(model: { makeSlug: string; slug: string }, year: number | null = null): string {
  const base = `/models/${model.makeSlug}/${model.slug}`;
  return year === null ? base : `${base}?year=${String(year)}`;
}

/** The model a search key «make.model» names, as address parts; null for a key that is not one (a trim key, a make). */
export function modelOfKey(key: string | null | undefined): { makeSlug: string; slug: string } | null {
  if (key === null || key === undefined) return null;
  const [makeSlug, slug, ...rest] = key.split('.');
  if (makeSlug === undefined || slug === undefined || rest.length > 0 || makeSlug === '' || slug === '') {
    return null;
  }
  return { makeSlug, slug };
}

/** The model year in an address's `year` parameter, or null: Latin digits, one value, inside the calendar's range. */
export function readYearParam(value: string | readonly string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^1[34]\d{2}$/.test(value)) return null;
  return Number(value);
}
