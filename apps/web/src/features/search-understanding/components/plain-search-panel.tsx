'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { searchHref } from '@carshenas/search/search';
import { PlainSearch } from '@/features/search-understanding/components/plain-search';

// Plain-Farsi search on the search page (CS-62, CS-93): a disclosure under the search box, closed by default so the page
// keeps its first screen, that holds the sentence box. What the buyer applies opens the search page with those filters
// (the address holds the whole search, ADR-0027) and closes the disclosure, so the results are what is on screen. The
// model behind it is off unless the server's master switch is on; off, code alone reads the sentence and the box says so.

export function PlainSearchPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
      className="rounded-control border border-divider bg-surface"
    >
      <summary className="flex min-h-12 items-center px-4 text-control font-semibold text-default">
        با یک جمله بگویید چه می‌خواهید
      </summary>
      <div className="px-4 pt-2 pb-4">
        <PlainSearch
          label="ماشین مورد نظرتان را بنویسید"
          onApply={(search) => {
            setOpen(false);
            router.push(searchHref(search) as Route);
          }}
        />
      </div>
    </details>
  );
}
