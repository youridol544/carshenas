import { formatDate } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { NumericText } from '@/components/ui/numeric-text';
import { STATUS_COPY } from '@/features/data-status/data-status-copy';
import { formatErrorPct } from '@/features/data-status/data-status-format';
import type { ValuationStatus } from '@/features/data-status/data-status-types';

// The market values on the data-status page (CS-66 criterion 1, ADR-0017 point 6): the day they hold for, how many
// listings were valued and rated, and how accurate each model's values were in that run (its leave-one-out median
// absolute percentage error, valuation_segment). The bars are in the text's own neutral, not a hue: they compare
// sizes, and colour would read as a verdict. They grow from the inline start, as the text does.

/** The bars' scale never ends below this error, so a model at 4 % does not fill its row. */
const SCALE_FLOOR_PCT = 15;

/**
 * A bar on a track, in the subtle text colour (5:1 on the canvas). SVG draws in physical coordinates, so the bar is
 * anchored at the right on purpose: the inline start of this right-to-left page.
 */
function ErrorBar({ share }: { share: number }) {
  const width = Math.max(2, Math.min(100, share * 100));
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      className="h-2 w-full min-w-0 overflow-hidden rounded-full bg-surface-hover text-subtle"
    >
      <rect x={100 - width} y={0} width={width} height={8} fill="currentColor" />
    </svg>
  );
}

export function ValuationSection({ valuation }: { valuation: ValuationStatus | null }) {
  return (
    <section aria-labelledby="valuation" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="valuation" className="text-heading font-bold">
          {STATUS_COPY.valuationTitle}
        </h2>
        <p className="max-w-reading text-secondary text-pretty text-muted">{STATUS_COPY.valuationLead}</p>
      </div>
      {valuation === null ? (
        <p className="text-secondary text-muted">{STATUS_COPY.noValuation}</p>
      ) : (
        <ValuationFigures valuation={valuation} />
      )}
    </section>
  );
}

function ValuationFigures({ valuation }: { valuation: ValuationStatus }) {
  const errors = valuation.models.map((model) => model.errorPct);
  const scale = Math.max(SCALE_FLOOR_PCT, ...errors);
  const facts = [
    { key: 'valued', count: valuation.valued, label: STATUS_COPY.valued },
    { key: 'rated', count: valuation.rated, label: STATUS_COPY.rated },
    { key: 'comparables', count: valuation.comparables, label: STATUS_COPY.comparables },
  ];
  return (
    <div className="flex flex-col gap-6 rounded-card border border-divider p-4 sm:p-6">
      <div className="flex flex-col gap-3">
        <p className="text-control">
          {STATUS_COPY.valuationDate}{' '}
          <time dateTime={valuation.asOfDate} className="font-semibold">
            {formatDate(`${valuation.asOfDate}T12:00:00Z`)}
          </time>
        </p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.key} className="flex items-baseline gap-2">
              <dt className="order-2 text-secondary text-muted">{fact.label}</dt>
              <dd className="order-1 text-heading font-bold">
                <NumericText>{formatCount(fact.count)}</NumericText>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {valuation.models.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-control font-semibold">{STATUS_COPY.accuracyTitle}</h3>
            <p className="text-control">
              {STATUS_COPY.accuracyRangeFrom}{' '}
              <span className="font-semibold">{formatErrorPct(Math.min(...errors))}</span>{' '}
              {STATUS_COPY.accuracyRangeTo}{' '}
              <span className="font-semibold">{formatErrorPct(Math.max(...errors))}</span>
              {STATUS_COPY.accuracyRangeEnd}
            </p>
            <p className="max-w-reading text-secondary text-pretty text-muted">{STATUS_COPY.accuracyLead}</p>
          </div>
          <ul className="flex max-w-2xl flex-col gap-2">
            {valuation.models.map((model) => (
              <li
                key={model.modelId}
                className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(3rem,auto)] items-center gap-x-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(3rem,auto)]"
              >
                <span className="flex min-w-0 flex-col">
                  <bdi className="truncate text-control">{model.name}</bdi>
                  <span className="text-meta text-muted">
                    <NumericText>{formatCount(model.comparables)}</NumericText> {STATUS_COPY.modelComparables}
                  </span>
                </span>
                <ErrorBar share={model.errorPct / scale} />
                <span className="text-end text-control font-semibold">{formatErrorPct(model.errorPct)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
