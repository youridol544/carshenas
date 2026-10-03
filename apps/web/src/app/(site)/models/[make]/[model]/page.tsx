import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ModelScreen } from '@/features/model/components/model-screen';
import { MODEL_COPY } from '@/features/model/model-copy';
import { readModelOverview, readModelRef } from '@/features/model/server/model-queries';
import { readYearParam } from '@/lib/model-address';

// A model's page (CS-67). It reads the model and its figures at the top and calls notFound() before anything streams,
// with no loading.tsx and no Suspense above it: a blocking route, as the listing page is (CS-28's recipe in
// next-app-router.md), so the name, the figures and the first photograph are in the first response. The proxy answers a
// real 404 for an unknown model first; this page's own notFound() would arrive inside a response that has started
// streaming. The trend, the deals and the trims stream in below the hero, each in its own boundary.
export const instant = false;

export async function generateMetadata({ params }: PageProps<'/models/[make]/[model]'>): Promise<Metadata> {
  const { make, model } = await params;
  const ref = await readModelRef(make, model);
  if (ref === null) return { title: MODEL_COPY.notFoundTitle, robots: { index: false } };
  return { title: MODEL_COPY.title(ref.name), description: MODEL_COPY.description(ref.name) };
}

export default async function ModelPage({ params, searchParams }: PageProps<'/models/[make]/[model]'>) {
  const { make, model } = await params;
  const ref = await readModelRef(make, model);
  if (ref === null) notFound();
  const year = readYearParam((await searchParams).year);
  const overview = await readModelOverview(ref.key, year);
  return <ModelScreen model={ref} overview={overview} year={year} />;
}
