import type { Metadata } from 'next';
import { TrackedModelsScreen } from '@/features/admin/components/tracked-models-screen';
import { loadTrackedModels, readUntrackedQuery } from '@/features/admin/server/tracked-model-queries';
import { TRACKED_MODELS_COPY } from '@/features/admin/tracked-models-admin-copy';

export const metadata: Metadata = { title: TRACKED_MODELS_COPY.title };

// The tracked models (CS-53). Reads the session at request time. Anyone but the superadmin gets a real 404 from
// src/proxy.ts; the loader still answers not-found itself. The untracked list's search comes from the address.
export const instant = false;

export default async function AdminTrackedModelsPage({ searchParams }: PageProps<'/admin/tracked-models'>) {
  const query = readUntrackedQuery((await searchParams).q);
  return <TrackedModelsScreen data={await loadTrackedModels(query)} />;
}
