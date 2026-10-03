import { formatPercent } from '@carshenas/locale/format-number';
import { InfoPopover } from '@/components/ui/info-popover';
import { MODEL_COPY } from '@/features/model/model-copy';
import { factsInfo } from '@/features/model/model-info';
import type { ModelStats } from '@/features/model/model-types';
import { factShare } from '@/features/model/model-view';

// What the model's listings say about themselves (CS-67): the share that state no repainted body, an automatic gearbox,
// a private seller, each from the count of listings that state the fact at all. These are counts of what ads wrote, not
// advice and not an inspection; a share is shown only when enough listings state it (TREND_MIN_LISTINGS), and nothing
// here is written text about cars: every figure is a count from the database.

const COPY = MODEL_COPY.facts;

export function FactsSection({ stats }: { stats: ModelStats }) {
  const items = [
    { id: 'paint', label: COPY.paintFree, fact: stats.facts.paintFree },
    { id: 'gearbox', label: COPY.automatic, fact: stats.facts.automatic },
    { id: 'seller', label: COPY.privateSeller, fact: stats.facts.privateSeller },
  ].flatMap((item) => {
    const share = factShare(item.fact);
    return share === null ? [] : [{ ...item, share }];
  });
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="model-facts" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <h2 id="model-facts" className="text-heading font-bold">
            {COPY.title}
          </h2>
          <InfoPopover
            label={MODEL_COPY.info.factsLabel}
            closeLabel={MODEL_COPY.info.close}
            content={factsInfo()}
          />
        </div>
        <p className="text-secondary text-muted">{COPY.lead(stats.count)}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="flex min-w-0 flex-col gap-2 rounded-control bg-surface-muted p-3">
            <dt className="text-label text-muted">{item.label}</dt>
            <dd className="text-heading font-bold">{formatPercent(item.share)}</dd>
            <dd aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-surface-pressed">
              <span
                className="bg-action"
                style={{ inlineSize: `${String(Math.round(item.share * 100))}%` }}
              />
            </dd>
            <dd className="text-meta text-pretty text-muted">{COPY.of(item.fact.yes, item.fact.of)}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.note}</p>
    </section>
  );
}
