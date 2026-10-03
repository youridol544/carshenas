import type { Route } from 'next';
import Link from 'next/link';
import { formatCount } from '@carshenas/locale/format-number';
import { InfoPopover } from '@/components/ui/info-popover';
import { NumericText } from '@/components/ui/numeric-text';
import { MODEL_COPY } from '@/features/model/model-copy';
import { yearsInfo } from '@/features/model/model-info';
import type { YearRow } from '@/features/model/model-types';
import { mileageText, price, yearBars, yearText } from '@/features/model/model-view';
import { modelHref } from '@/lib/model-address';

// The model's price by year (CS-67): one row per model year, newest first, with a bar for the median asking price, the
// number of listings and the usual mileage. The row is a link that opens that year's page (the table is the way
// into a year as much as the chips are); the chosen year is marked in words as well as by its weight. The bars are the
// median as a share of the highest median, so the eye reads the price falling with age; the figures beside them carry
// every value.

const COPY = MODEL_COPY.byYear;

export function ByYearSection({
  model,
  years,
  year,
}: {
  model: { makeSlug: string; slug: string };
  years: readonly YearRow[];
  year: number | null;
}) {
  if (years.length === 0) return null;
  return (
    <section aria-labelledby="model-years" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <h2 id="model-years" className="text-heading font-bold">
            {COPY.title}
          </h2>
          <InfoPopover
            label={MODEL_COPY.info.yearsLabel}
            closeLabel={MODEL_COPY.info.close}
            content={yearsInfo()}
          />
        </div>
        <p className="text-secondary text-pretty text-muted">{COPY.lead}</p>
      </div>
      <ul className="flex flex-col">
        {yearBars(years).map(({ row, share }) => {
          const chosen = row.year === year;
          return (
            <li key={row.year} className="border-b border-divider last:border-b-0">
              <Link
                href={modelHref(model, row.year) as Route}
                scroll={false}
                prefetch={false}
                aria-label={COPY.open(row.year)}
                aria-current={chosen ? 'page' : undefined}
                className="grid min-h-14 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-control px-2 py-2 transition-colors hover:bg-surface-hover sm:grid-cols-[3.5rem_minmax(0,1fr)_7rem]"
              >
                <span className={`text-control tabular-nums ${chosen ? 'font-bold' : 'font-medium'}`}>
                  {yearText(row.year)}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="bg-action"
                      style={{ inlineSize: `${String(Math.round(share * 100))}%` }}
                    />
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-3 text-secondary">
                    <span className="font-semibold">
                      {row.medianToman === null ? (
                        '—'
                      ) : (
                        <NumericText>{price(row.medianToman) ?? ''}</NumericText>
                      )}
                    </span>
                    <span className="text-muted">{`${formatCount(row.count)} ${COPY.columns.count}`}</span>
                    {chosen ? <span className="text-link">{COPY.current}</span> : null}
                  </span>
                </span>
                <span className="col-start-2 text-meta text-muted sm:col-start-3">
                  {mileageText(row.medianMileageKm) ?? ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
