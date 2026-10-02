import type { Route } from 'next';
import Link from 'next/link';
import { formatCount } from '@carshenas/locale/format-number';
import { NumericText } from '@/components/ui/numeric-text';
import { MODEL_COPY } from '@/features/model/model-copy';
import type { TrimRow } from '@/features/model/model-types';
import { price } from '@/features/model/model-view';
import { searchHref } from '@carshenas/search/search';

// The model's trims (CS-67): the listings that name one, with how many there are and their median asking price; each
// row opens the search for that trim. Listings that name the model only are one row at the end, so the counts add up.

const COPY = MODEL_COPY.trims;

export function TrimsSection({ trims, year }: { trims: readonly TrimRow[]; year: number | null }) {
  const named = trims.filter((trim) => trim.key !== null);
  if (named.length === 0) return null;
  const rows = [...named, ...trims.filter((trim) => trim.key === null)];
  return (
    <section aria-labelledby="model-trims" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="model-trims" className="text-heading font-bold">
          {COPY.title}
        </h2>
        <p className="text-secondary text-pretty text-muted">{COPY.lead}</p>
      </div>
      <ul className="flex flex-col">
        {rows.map((trim) => {
          const body = (
            <>
              <span className="min-w-0 text-control font-medium text-pretty">{trim.name ?? COPY.unnamed}</span>
              <span className="flex flex-wrap items-baseline gap-x-3 text-secondary text-muted">
                <span>{`${formatCount(trim.count)} ${COPY.columns.count}`}</span>
                {trim.medianToman === null ? null : (
                  <span className="font-semibold text-default">
                    <NumericText>{price(trim.medianToman) ?? ''}</NumericText>
                  </span>
                )}
              </span>
            </>
          );
          const key = trim.key ?? 'unnamed';
          return (
            <li key={key} className="border-b border-divider last:border-b-0">
              {trim.key === null ? (
                <div className="flex min-h-14 flex-col justify-center gap-0.5 px-2 py-2">{body}</div>
              ) : (
                <Link
                  href={
                    searchHref({
                      filters: { trim: [trim.key], ...(year === null ? {} : { year: { min: year, max: year } }) },
                    }) as Route
                  }
                  className="flex min-h-14 flex-col justify-center gap-0.5 rounded-control px-2 py-2 transition-colors hover:bg-surface-hover"
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
