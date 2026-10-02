import { NumericText } from '@/components/ui/numeric-text';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { FactRow } from '@/features/listing/listing-view';

// The key facts as a plain list of labels and values: what the listing states, nothing it does not.

export function FactsSection({ rows }: { rows: readonly FactRow[] }) {
  return (
    <section aria-labelledby="facts-title" className="@container flex flex-col gap-3">
      <h2 id="facts-title" className="text-heading font-bold">
        {LISTING_COPY.facts.title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @2xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-label font-medium text-muted">{row.label}</dt>
            <dd className="text-control text-pretty">
              <bdi>
                <NumericText>{row.value}</NumericText>
              </bdi>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
