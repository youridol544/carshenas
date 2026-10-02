'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { PlainSearch } from '@/features/search-understanding/components/plain-search';
import { HOME_COPY } from '@/features/home/home-copy';
import { searchHref } from '@carshenas/search/search';

// The hero's search box (CS-63): the plain-Farsi search of CS-62 as it stands, with three example sentences as chips.
// The buyer types a sentence (or taps an example), sees the filters it was understood as, may remove any, and the
// search page opens with what is left (searchHref: the address is the whole search, ADR-0027). Understanding runs here
// through POST /api/search/understand, with the model behind its own master switch (off by default): without it the
// reading is code-only and the box says so, quietly (PlainSearch's «degraded» note).
//
// The integration surface with CS-62 is one component and three props: onApply, label and examples.
export function HeroSearch() {
  const router = useRouter();
  return (
    <PlainSearch
      label={HOME_COPY.hero.searchLabel}
      examples={HOME_COPY.hero.examples}
      onApply={(search) => {
        router.push(searchHref(search) as Route);
      }}
    />
  );
}
