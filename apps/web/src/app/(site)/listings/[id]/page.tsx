import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingScreen } from '@/features/listing/components/listing-screen';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import { listingTitle, summaryLine } from '@/features/listing/listing-view';
import { readListingPage } from '@/features/listing/server/listing-page-data';
import { readListingId } from '@/lib/listing-id';

// The listing page (CS-64). It reads its id and the listing at the top and calls notFound() before anything is rendered,
// with no loading.tsx and no Suspense above it, and it is a blocking route (CS-28's recipe: next-app-router.md): the
// title, the price, the verdict and the first photo are in the first response. The proxy (src/proxy.ts) answers
// first with a real 404 for an id that is no listing's and for an address Next.js cannot decode: this page's own
// notFound() arrives inside a response that has started streaming, as a 200.
export const instant = false;

export async function generateMetadata({ params }: PageProps<'/listings/[id]'>): Promise<Metadata> {
  const id = readListingId((await params).id);
  const result = id === undefined ? undefined : await readListingPage(id);
  if (result?.status !== 'found')
    return { title: LISTING_COPY.states.notFoundTitle, robots: { index: false } };
  const { listing } = result.page;
  return {
    title: `${listingTitle(listing)}، ${LISTING_COPY.titleSuffix}`,
    description: summaryLine(listing).join('، '),
    robots: listing.status === 'active' ? undefined : { index: false },
  };
}

export default async function ListingPage({ params }: PageProps<'/listings/[id]'>) {
  const id = readListingId((await params).id);
  if (id === undefined) notFound();
  const result = await readListingPage(id);
  if (result.status === 'missing') notFound();
  return <ListingScreen page={result.page} />;
}
