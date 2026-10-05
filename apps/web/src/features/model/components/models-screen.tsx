import type { Route } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { InfoPopover } from '@/components/ui/info-popover';
import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
import { ModelTile } from '@/features/model/components/model-tile';
import { SectionBoundary } from '@/features/model/components/section-boundary';
import { MODEL_COPY } from '@/features/model/model-copy';
import { popularInfo } from '@/features/model/model-info';
import type { ModelIndexEntry } from '@/features/model/model-types';
import { readModelIndex } from '@/features/model/server/model-queries';
import { formatCountOf } from '@carshenas/locale/format-number';
import { POPULAR_MODEL_RANK } from '@carshenas/search/filters';
import { modelHref } from '@/lib/model-address';
import { connection } from 'next/server';

// The models index (CS-67): the way into every model page. The popular models come first as photograph tiles, then
// every model that has listings, grouped by make with the most listed make first. A model with no listing now is not
// listed: its page would be empty. Read in one cached query, so a visitor costs none of its own.

const COPY = MODEL_COPY.index;
const TILE_SIZES = '(min-width: 64rem) 14rem, (min-width: 40rem) 30vw, 45vw';

type MakeGroup = { slug: string; name: string; listings: number; models: ModelIndexEntry[] };

function groupByMake(entries: readonly ModelIndexEntry[]): MakeGroup[] {
  const groups = new Map<string, MakeGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.makeSlug) ?? {
      slug: entry.makeSlug,
      name: entry.makeName,
      listings: 0,
      models: [],
    };
    group.listings += entry.count;
    group.models.push(entry);
    groups.set(entry.makeSlug, group);
  }
  return [...groups.values()].sort((a, b) => b.listings - a.listings || a.slug.localeCompare(b.slug));
}

async function Models() {
  // Read at request time: a cached read outside the request is prerendered by the build, which has no database.
  await connection();
  const entries = await readModelIndex();
  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-card border border-divider bg-surface-muted p-6">
        <h2 className="text-heading font-bold">{COPY.empty.title}</h2>
        <p className="max-w-reading text-body text-pretty text-muted">{COPY.empty.body}</p>
      </section>
    );
  }
  const popular = entries.slice(0, POPULAR_MODEL_RANK);
  return (
    <>
      <section aria-labelledby="models-popular" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <h2 id="models-popular" className="text-heading font-bold">
              {COPY.popularTitle}
            </h2>
            <InfoPopover
              label={MODEL_COPY.info.popularLabel}
              closeLabel={MODEL_COPY.info.close}
              content={popularInfo()}
            />
          </div>
          <p className="text-secondary text-muted">{COPY.popularLead}</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {popular.map((model) => (
            <li key={`${model.makeSlug}.${model.slug}`}>
              <ModelTile model={model} sizes={TILE_SIZES} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="models-all" className="flex flex-col gap-4">
        <h2 id="models-all" className="text-heading font-bold">
          {COPY.allTitle}
        </h2>
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {groupByMake(entries).map((group) => (
            <section key={group.slug} aria-labelledby={`make-${group.slug}`} className="flex flex-col gap-1">
              <h3
                id={`make-${group.slug}`}
                className="flex flex-wrap items-baseline gap-x-2 text-control font-bold"
              >
                {group.name}
                <span className="text-meta font-normal text-muted">
                  {COPY.makeCount(group.models.length, group.listings)}
                </span>
              </h3>
              <ul className="flex flex-col">
                {group.models.map((model) => (
                  <li key={model.slug} className="border-b border-divider last:border-b-0">
                    <Link
                      href={modelHref(model) as Route}
                      prefetch={false}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-control px-2 py-2 transition-colors hover:bg-surface-hover"
                    >
                      <span className="min-w-0 text-control text-balance">{model.name}</span>
                      <span className="text-meta text-muted">{formatCountOf(model.count, 'آگهی')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}

const TILE_KEYS = ['tile-1', 'tile-2', 'tile-3', 'tile-4'] as const;

function ModelsSkeleton() {
  return (
    <div className="flex skeleton-delayed flex-col gap-3">
      <p role="status" className="sr-only">
        {MODEL_COPY.loading}
      </p>
      <div aria-hidden="true" className="w-48 text-heading">
        <SkeletonText lastLineWidth="w-full" />
      </div>
      <ul aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {TILE_KEYS.map((key) => (
          <li key={key} className="flex flex-col gap-2 rounded-card border border-divider p-2">
            <div className="aspect-4/3 overflow-hidden rounded-inner">
              <SkeletonBlock />
            </div>
            <div className="text-control">
              <SkeletonText lastLineWidth="w-2/3" />
            </div>
            <div className="text-meta">
              <SkeletonText lastLineWidth="w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ModelsScreen() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-6 pb-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-title font-bold text-balance">{COPY.title}</h1>
        <p className="max-w-reading text-body text-pretty text-muted">{COPY.lead}</p>
      </div>
      <SectionBoundary title={COPY.error.title}>
        <Suspense fallback={<ModelsSkeleton />}>
          <Models />
        </Suspense>
      </SectionBoundary>
    </main>
  );
}
