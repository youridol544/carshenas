import { formatDate } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { NumericText } from '@/components/ui/numeric-text';
import { FigureSkeleton, FigureStrip, type Figure } from '@/features/data-status/components/figure-strip';
import { HOME_COPY } from '@/features/home/home-copy';
import { loadHomeTrust } from '@/features/home/server/home-queries';
import { connection } from 'next/server';

// The measured numbers under «کارشناس چطور کار می‌کند؟» (CS-63; teardown pattern 16, "trust points, short, with the
// measured accuracy"): every one is read from the database through the loaders the data-status page (CS-66) and the
// search use, never typed. The text-reading figure is a count («۷۹۱ از ۷۹۲»), never a rounded percentage, as on the
// data-status page; a figure that has no data yet (no valuation run, no published evaluation) is left out, never zero.

function Count({ right, total }: { right: number; total: number }) {
  return (
    <>
      <NumericText>{formatCount(right)}</NumericText>{' '}
      <span className="text-control font-normal text-muted">
        {HOME_COPY.how.of} <NumericText>{formatCount(total)}</NumericText>
      </span>
    </>
  );
}

export async function TrustFigures() {
  await connection();
  const trust = await loadHomeTrust();
  const figures: Figure[] = [
    {
      key: 'searchable',
      label: HOME_COPY.how.searchable,
      value: <NumericText>{formatCount(trust.searchable)}</NumericText>,
    },
    ...(trust.valuation === null
      ? []
      : [
          {
            key: 'valued-on',
            label: HOME_COPY.how.valuedOn,
            value: <span className="text-heading">{formatDate(trust.valuation.asOfDate)}</span>,
          },
          {
            key: 'rated',
            label: HOME_COPY.how.rated,
            value: <NumericText>{formatCount(trust.valuation.rated)}</NumericText>,
          },
        ]),
    ...(trust.reading === null
      ? []
      : [
          {
            key: 'reading',
            label: HOME_COPY.how.reading,
            value: <Count right={trust.reading.fieldsRight} total={trust.reading.fieldsScored} />,
            hint: HOME_COPY.how.readingHint,
          },
        ]),
  ];
  return <FigureStrip figures={figures} columns={4} size="medium" />;
}

/** The strip's frame in grey while the figures load: four figures, so nothing moves when they arrive. */
export function TrustFiguresSkeleton() {
  return (
    <FigureStrip
      columns={4}
      size="medium"
      figures={['searchable', 'valued-on', 'rated', 'reading'].map((key) => ({
        key,
        label: <FigureSkeleton />,
        value: <FigureSkeleton />,
      }))}
    />
  );
}
