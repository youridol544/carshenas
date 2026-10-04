import { formatDate } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { Icon } from '@/components/ui/icon';
import { NumericText } from '@/components/ui/numeric-text';
import { MODEL_COPY } from '@/features/model/model-copy';
import type { TrendDay } from '@/features/model/model-types';
import { price, priceRange } from '@/features/model/model-view';
import { ChevronLeft } from 'lucide-react';

// The trend's numbers as a table (CS-67): the chart's text alternative, for a screen reader and for anyone who wants the
// exact figure. It lists every day with enough listings, newest first, in a disclosure that is closed until opened
// (a phone's screen is better spent on the chart). The market-value column goes below 40 rem: the columns that are
// the chart's own stay. The table fits a 320 px phone; if the reader's text is much larger the box scrolls sideways,
// with a fade and no scrollbar (CS-112).

const COPY = MODEL_COPY.trend;

export function TrendTable({
  days,
  cohort,
  open = false,
}: {
  days: readonly TrendDay[];
  cohort: string;
  open?: boolean;
}) {
  const rows = [...days].reverse();
  return (
    <details open={open} className="group/table text-secondary">
      <summary className="flex min-h-11 w-fit items-center gap-1 text-link">
        <span className="underline">{COPY.tableSummary}</span>
        <Icon
          icon={ChevronLeft}
          size={16}
          className="group-open/table:-rotate-90 motion-safe:transition-transform"
        />
      </summary>
      <div className="scrollbar-none scroll-fade-inline overflow-x-auto pt-2">
        <table className="w-full text-start">
          <caption className="pb-2 text-start text-muted">{COPY.tableCaption(cohort)}</caption>
          <thead>
            <tr className="border-b border-divider text-muted">
              <th scope="col" className="py-2 pe-4 text-start font-medium">
                {COPY.columns.date}
              </th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">
                {COPY.columns.count}
              </th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">
                {COPY.columns.median}
              </th>
              <th scope="col" className="hidden py-2 pe-4 text-start font-medium sm:table-cell">
                {COPY.columns.range}
              </th>
              <th scope="col" className="hidden py-2 text-start font-medium sm:table-cell">
                {COPY.columns.value}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-b border-divider last:border-b-0">
                <th scope="row" className="py-2 pe-4 text-start font-normal whitespace-nowrap">
                  {formatDate(row.date)}
                </th>
                <td className="py-2 pe-4">{formatCount(row.count)}</td>
                <td className="py-2 pe-4">
                  <NumericText>{price(row.medianToman) ?? ''}</NumericText>
                  <span className="block text-meta text-muted sm:hidden">
                    <NumericText>{priceRange(row.lowToman, row.highToman) ?? ''}</NumericText>
                  </span>
                </td>
                <td className="hidden py-2 pe-4 sm:table-cell">
                  <NumericText>{priceRange(row.lowToman, row.highToman) ?? ''}</NumericText>
                </td>
                <td className="hidden py-2 sm:table-cell">
                  <NumericText>{price(row.marketValueToman) ?? '—'}</NumericText>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
