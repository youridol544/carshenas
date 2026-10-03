import type { Metadata } from 'next';
import { ModelsScreen } from '@/features/model/components/models-screen';
import { MODEL_COPY } from '@/features/model/model-copy';

export const metadata: Metadata = {
  title: MODEL_COPY.index.title,
  description: MODEL_COPY.index.metaDescription,
};

// The models index (CS-67): the heading and the lead are the prerendered shell; the models stream in from a cached read
// inside their own boundary, so a failure stays in its place with a way to try again.
export default function ModelsPage() {
  return <ModelsScreen />;
}
