import type { Metadata } from 'next';
import { StatusScreen } from '@/components/layout/status-screen';
import { ActionLink } from '@/components/ui/action-link';
import { LISTING_COPY } from '@/features/listing/listing-copy';

export const metadata: Metadata = { title: LISTING_COPY.states.notFoundTitle, robots: { index: false } };

// A listing that does not exist, or was taken down, or an address that is no listing's: the same plain answer with a way
// back to the search (CS-64).
export default function ListingNotFound() {
  return (
    <StatusScreen
      status={404}
      title={LISTING_COPY.states.notFoundTitle}
      description={LISTING_COPY.states.notFoundBody}
    >
      <ActionLink level="primary" href="/search">
        {LISTING_COPY.states.backToSearch}
      </ActionLink>
    </StatusScreen>
  );
}
