import type { Metadata } from 'next';
import { TrackedModelsScreen } from '@/features/admin/components/tracked-models-screen';
import { loadModelSpecs, readSpecQuery } from '@/features/admin/server/model-spec-queries';
import { loadTrackedModels, readUntrackedQuery } from '@/features/admin/server/tracked-model-queries';
import { TRACKED_MODELS_COPY } from '@/features/admin/tracked-models-admin-copy';

export const metadata: Metadata = { title: TRACKED_MODELS_COPY.title };

// The tracked models (CS-53). Reads the session at request time. Anyone but the superadmin gets a real 404 from
// src/proxy.ts; the loader still answers not-found itself. The untracked list's search (q) and the specs' (s) come from the address.
export const instant = false;

export default async function AdminTrackedModelsPage({ searchParams }: PageProps<'/admin/tracked-models'>) {
  const params = await searchParams;
  const query = readUntrackedQuery(params.q);
  const specQuery = readSpecQuery(params.s);
  const [data, specs] = await Promise.all([loadTrackedModels(query), loadModelSpecs(specQuery)]);
  return <TrackedModelsScreen data={data} specs={specs} />;
}
