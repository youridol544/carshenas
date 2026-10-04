import type { Metadata } from 'next';
import { StatusScreen } from '@/components/layout/status-screen';
import { ActionLink } from '@/components/ui/action-link';
import { MODEL_COPY } from '@/features/model/model-copy';

export const metadata: Metadata = { title: MODEL_COPY.notFoundTitle, robots: { index: false } };

// A model that is not in the catalogue, or an address that is none: the same plain answer with a way to the list of
// models and to the search (CS-67).
export default function ModelNotFound() {
  return (
    <StatusScreen status={404} title={MODEL_COPY.notFoundTitle}>
      <ActionLink level="primary" href="/models">
        {MODEL_COPY.allModels}
      </ActionLink>
      <ActionLink level="secondary" href="/search">
        {MODEL_COPY.searchInstead}
      </ActionLink>
    </StatusScreen>
  );
}
