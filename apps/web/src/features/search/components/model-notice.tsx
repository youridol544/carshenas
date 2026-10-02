import type { Route } from 'next';
import Link from 'next/link';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { modelHref, modelOfKey } from '@/lib/model-address';

// When a search is for exactly one model (the filter names one and no more), a line says the model has a page of its
// own, with its market value, its range and its price trend (CS-67): the way from the results to the model's page. A
// search that names several models or none shows nothing here.

export function ModelNotice({ modelKeys, name }: { modelKeys: readonly string[] | undefined; name: string | null }) {
  const [key] = modelKeys ?? [];
  const model = modelKeys?.length === 1 ? modelOfKey(key) : null;
  if (model === null || name === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 rounded-card bg-surface-muted px-4 text-secondary text-pretty">
      <span className="text-muted">{SEARCH_COPY.modelNotice.lead(name)}</span>
      <Link href={modelHref(model) as Route} className="inline-flex min-h-11 items-center text-link underline">
        {SEARCH_COPY.modelNotice.link}
      </Link>
    </p>
  );
}
