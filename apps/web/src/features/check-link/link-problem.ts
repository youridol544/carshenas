import { CHECK_COPY } from '@/features/check-link/check-copy';
import type { LinkReading } from '@/features/check-link/link-parse';

// What is wrong with a pasted text, in words: null for a Divar listing's link. One place, so the box (in the browser) and
// the answer page (on the server) say the same thing.

export function problemOf(reading: LinkReading): string | null {
  const COPY = CHECK_COPY.problems;
  switch (reading.kind) {
    case 'divar_listing':
      return null;
    case 'empty':
      return COPY.empty;
    case 'not_a_link':
      return COPY.notALink;
    case 'other_site':
      return COPY.otherSite(reading.name, reading.host);
    case 'divar_other':
      return COPY.divarOther;
  }
}
