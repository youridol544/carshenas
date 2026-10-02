'use client';

import { useState } from 'react';
import { searchHref, type Search } from '@carshenas/search/search';
import { PlainSearch } from '@/features/search-understanding/components/plain-search';

// The host page's use of PlainSearch (/design/plain-search): what the buyer applies is shown as the address the search
// page would open. The real hosts (the search page, the home page) navigate there instead.

export function PlainSearchDemo() {
  const [applied, setApplied] = useState<Search | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <PlainSearch onApply={setApplied} />
      <p role="status" className="text-secondary text-muted">
        {applied === null ? (
          'هنوز جست‌وجویی اعمال نشده است.'
        ) : (
          <>
            نشانی جست‌وجو:{' '}
            <bdi dir="ltr" data-testid="applied-href" className="break-all text-default">
              {searchHref(applied)}
            </bdi>
          </>
        )}
      </p>
    </div>
  );
}
