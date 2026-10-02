import { NumericText } from '@/components/ui/numeric-text';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { HistoryView } from '@/features/listing/listing-view';

// The listing's own price over time (CS-64, teardown pattern 31): a dated timeline, newest first, each change with the
// old price struck through, the total change and the days on market. Both come from one anchor, the day the listing was
// listed (listing-view.ts), so they cannot disagree the way Autolist's did. A listing that never changed says so.

const COPY = LISTING_COPY.history;

export function PriceHistorySection({ history }: { history: HistoryView }) {
  const changed = history.rows.length > 1;
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="text-heading font-bold">
        {COPY.title}
      </h2>
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-label font-medium text-muted">{COPY.daysOnMarket}</dt>
          <dd className="text-control font-semibold">{history.daysOnMarket}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-label font-medium text-muted">{COPY.totalChange}</dt>
          <dd className="text-control font-semibold text-pretty">
            {history.totalChange === null ? (
              <span className="font-normal text-muted">{history.unchanged ? COPY.noChange : '—'}</span>
            ) : (
              <NumericText>{history.totalChange}</NumericText>
            )}
          </dd>
        </div>
      </dl>
      <ol aria-label={COPY.listLabel} className="flex flex-col">
        {history.rows.map((row, position) => (
          <li key={row.id} className="relative flex gap-3 pb-4 last:pb-0">
            <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center">
              <span className="mt-2 size-3 rounded-full border-2 border-action bg-canvas" />
              {changed && position < history.rows.length - 1 ? (
                <span className="absolute inset-y-5 w-px bg-surface-pressed" />
              ) : null}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-meta text-muted">{row.date}</p>
              <p className="text-control font-semibold">{row.label}</p>
              <p className="flex flex-wrap items-baseline gap-x-2 text-body">
                <NumericText>{row.price}</NumericText>
                {row.previous === null ? null : (
                  <span className="text-secondary text-muted">
                    {COPY.previousPrice}:{' '}
                    <s>
                      <NumericText>{row.previous}</NumericText>
                    </s>
                  </span>
                )}
                {row.change === null ? null : <span className="text-label text-muted">{row.change}</span>}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
