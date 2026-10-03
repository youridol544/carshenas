import type { Metadata } from 'next';
import { ModelPhotosScreen } from '@/features/admin/components/model-photos-screen';
import { MODEL_PHOTOS_COPY } from '@/features/admin/model-photos-admin-copy';
import { loadModelPhotos } from '@/features/admin/server/model-photo-queries';

export const metadata: Metadata = { title: MODEL_PHOTOS_COPY.title };

// The model photos (CS-97). Reads the session at request time. Anyone but the superadmin gets a real 404 from
// src/proxy.ts; the loader still answers not-found itself.
export const instant = false;

export default async function AdminModelPhotosPage() {
  return <ModelPhotosScreen data={await loadModelPhotos()} />;
}
