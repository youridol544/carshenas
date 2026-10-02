import { Clock } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { SEARCH_COPY } from '@/features/search/search-copy';

// The index itself is empty: nothing was seen on the source within the freshness window (ADR-0017), so there is nothing
// to filter and nothing the buyer did wrong. It says so, and why the list is kept that way.

export function EmptyIndex() {
  return (
    <section className="flex flex-col items-start gap-3 rounded-card bg-surface-muted p-6">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-pressed text-muted">
        <Icon icon={Clock} size={24} />
      </span>
      <h2 className="text-heading font-bold text-balance">{SEARCH_COPY.emptyIndex.title}</h2>
      <p className="max-w-reading text-body text-pretty text-muted">{SEARCH_COPY.emptyIndex.body}</p>
    </section>
  );
}
