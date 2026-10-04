import { CHECK_COPY, type LinkProblem } from '@/features/check-link/check-copy';
import type { LinkReading } from '@/lib/pasted-link';

// What is wrong with a pasted text, in words: null for a Divar listing's link. One place, so the box (in the browser) and
// the answer page (on the server) say the same thing: what happened, and what to do. Another site is told only that
// Carshenas reads Divar's ads.

type NotAListing = Exclude<LinkReading, { readonly kind: 'divar_listing' }>;

export function problemOf(reading: NotAListing): LinkProblem;
export function problemOf(reading: LinkReading): LinkProblem | null;
export function problemOf(reading: LinkReading): LinkProblem | null {
  const COPY = CHECK_COPY.problems;
  switch (reading.kind) {
    case 'divar_listing':
      return null;
    case 'empty':
      return COPY.empty;
    case 'not_a_link':
      return COPY.notALink;
    case 'other_site':
      return COPY.otherSite;
    case 'divar_other':
      return COPY.notAnAd;
  }
}

/** The whole message in one line, as the box says it under the field. */
export function problemLine(problem: LinkProblem): string {
  return problem.body === null ? `${problem.title}.` : `${problem.title}. ${problem.body}`;
}
