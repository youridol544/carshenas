import { CircleCheck, CircleDashed, Clock } from 'lucide-react';
import { formatDate } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { Icon } from '@/components/ui/icon';
import { NumericText } from '@/components/ui/numeric-text';
import { STATUS_COPY, TARGET_COPY, TARGET_STATUS_LABEL } from '@/features/data-status/data-status-copy';
import { formatHours, formatMinutes } from '@/features/data-status/data-status-format';
import { FRESHNESS_TARGETS, type TargetResult } from '@/features/data-status/data-status-rules';

// ADR-0017's freshness targets (point 6) against what was measured (CS-66): a status page states its promises and
// whether it keeps them. A missed target is shown as missed, with the number, never hidden. Colour follows the state
// that exists (success or warning), and the word always says it.

const STATUS_ICON = { met: CircleCheck, missed: Clock, unmeasured: CircleDashed } as const;
const STATUS_BADGE = {
  met: 'bg-success-subtle text-success',
  missed: 'bg-warning-subtle text-warning',
  unmeasured: 'bg-surface-hover text-muted',
} as const;
const STATUS_TONE = { met: 'text-success', missed: 'text-warning', unmeasured: 'text-muted' } as const;

function measuredText(result: TargetResult, valuationDate: string | null): string | null {
  if (result.status === 'unmeasured') return null;
  switch (result.key) {
    case 'newListing':
    case 'resultsMedian':
      return formatMinutes(result.measured);
    case 'valuationDaily':
      return valuationDate === null ? null : formatDate(`${valuationDate}T12:00:00Z`);
  }
}

export function FreshnessTargets({
  results,
  valuationDate,
  shown,
  trackedActive,
}: {
  results: readonly TargetResult[];
  /** The market values' Tehran day, ISO. */
  valuationDate: string | null;
  shown: number;
  trackedActive: number;
}) {
  const window = formatHours(FRESHNESS_TARGETS.resultsWindowHours);
  return (
    <section aria-labelledby="freshness-targets" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="freshness-targets" className="text-heading font-bold">
          {STATUS_COPY.targetsTitle}
        </h2>
        <p className="max-w-reading text-secondary text-pretty text-muted">{STATUS_COPY.targetsLead}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {results.map((result) => {
          const measured = measuredText(result, valuationDate);
          return (
            <li key={result.key} className="flex items-start gap-3 rounded-card border border-divider p-4">
              <span className="flex h-lh shrink-0 items-center text-control">
                <Icon icon={STATUS_ICON[result.status]} className={STATUS_TONE[result.status]} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {/* The badge follows the title and wraps under it when the line is short; its words may wrap too. */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h3 className="text-control font-semibold text-balance">{TARGET_COPY[result.key].title}</h3>
                  <span
                    className={`inline-flex min-h-7 max-w-full items-center rounded-badge px-2 text-label font-medium ${STATUS_BADGE[result.status]}`}
                  >
                    {TARGET_STATUS_LABEL[result.status]}
                  </span>
                </div>
                <p className="text-secondary text-pretty text-muted">
                  {TARGET_COPY[result.key].body(window)}{' '}
                  {measured === null ? (
                    TARGET_STATUS_LABEL.unmeasured
                  ) : (
                    <span className="font-semibold text-default">{measured}</span>
                  )}
                </p>
                {result.key === 'resultsMedian' && trackedActive > 0 ? (
                  <p className="text-secondary text-pretty text-muted">
                    <NumericText>{formatCount(shown)}</NumericText> {STATUS_COPY.of}{' '}
                    <NumericText>{formatCount(trackedActive)}</NumericText>{' '}
                    {STATUS_COPY.shownOfTracked(window)}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
