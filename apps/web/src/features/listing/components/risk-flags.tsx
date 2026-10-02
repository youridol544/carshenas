import { Info, TriangleAlert } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { RiskFlag } from '@/features/listing/listing-view';

// Cautions as sentences, never bare icons (listing-patterns.md): a price that may be a down payment, a reading that is
// missing, the seller's fields against the text, what the rating cannot see. Each is text a screen reader reads as it
// stands, with a warning or an info mark that only reinforces it.

export function RiskFlags({ flags }: { flags: readonly RiskFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <section aria-labelledby="risks-title" className="flex flex-col gap-3">
      <h2 id="risks-title" className="text-heading font-bold">
        {LISTING_COPY.risks.title}
      </h2>
      <ul aria-label={LISTING_COPY.risks.listLabel} className="flex flex-col gap-2">
        {flags.map((flag) => (
          <li
            key={flag.id}
            data-risk={flag.id}
            className={`flex items-start gap-2 rounded-control p-3 text-body text-pretty ${flag.tone === 'warning' ? 'bg-warning-subtle text-warning' : 'bg-surface-muted text-muted'}`}
          >
            <span className="flex h-lh shrink-0 items-center">
              <Icon icon={flag.tone === 'warning' ? TriangleAlert : Info} size={16} />
            </span>
            <span>{flag.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
