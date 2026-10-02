import { SEARCH_COPY } from '@/features/search/search-copy';
import { FILTERS } from '@carshenas/search/filters';

// A parameter of the address that the shared schema could not use is dropped and named, never guessed (ADR-0027): a
// hand-edited address, a link made by an older version, a filter value that no longer exists. The buyer is told which
// part was left out, in the words the filters use, instead of seeing results that quietly do not match the address.

const OWN = {
  q: SEARCH_COPY.ignored.query,
  sort: SEARCH_COPY.ignored.sort,
  catalogue: SEARCH_COPY.ignored.catalogue,
} as const;

function nameOf(param: string): string | undefined {
  return FILTERS.find((filter) => filter.param === param)?.label ?? (OWN as Record<string, string>)[param];
}

export function IgnoredNotice({ params }: { params: readonly string[] }) {
  const names = [...new Set(params.flatMap((param) => nameOf(param) ?? []))];
  if (names.length === 0) return null;
  return (
    <p
      role="status"
      className="rounded-control bg-warning-subtle px-3 py-2 text-secondary text-pretty text-warning"
    >
      {SEARCH_COPY.ignored.lead} {names.join('، ')}
    </p>
  );
}
