'use client';

import { useSearchParams } from 'next/navigation';
import { PasteLinkForm } from '@/features/check-link/components/paste-link-form';

// The answer page's box: it starts with the link the address carries (a shared address, Back, a reload), and is made
// again when that link changes, so «a different link» is an empty box and a new answer never leaves the old text behind.
// Reading the address on the client keeps the page's shell static (the box is in it, with no wait for the server).

export function CheckForm() {
  const link = useSearchParams().get('link') ?? '';
  return <PasteLinkForm key={link} initial={link} primary />;
}
