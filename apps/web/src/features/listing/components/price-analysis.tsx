import { ArrowDown, ArrowUp, Info } from 'lucide-react';
import { InfoPopover } from '@/components/ui/info-popover';
import { Icon } from '@/components/ui/icon';
import { NumericText } from '@/components/ui/numeric-text';
import { Gauge } from '@/features/listing/components/gauge';
import { gaugeInfo, type GaugeView } from '@/features/listing/gauge-view';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { Explanation } from '@/features/listing/listing-explanation';

// The price analysis, the hero of the listing page (CS-64): the verdict in one sentence, the gauge with the listing's
// price and the market value under it, then «چرا این ارزیابی؟» (the explanation, written by code from stored facts) and
// how values are made. A listing without a market value says so in the same box, so the page's order never changes.

const COPY = LISTING_COPY.analysis;

function ExplanationLines({ explanation }: { explanation: Explanation }) {
  const adjustments = explanation.lines.filter((line) => line.direction !== undefined);
  const others = explanation.lines.filter((line) => line.direction === undefined);
  const before = others.filter((line) => line.id === 'value' || line.id === 'basis');
  const after = others.filter((line) => line.id !== 'value' && line.id !== 'basis');
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-divider pt-4">
      <h3 className="text-control font-semibold">{COPY.why}</h3>
      <ul className="flex flex-col gap-2">
        {before.map((line) => (
          <li key={line.id} className="text-body text-pretty">
            {line.text}
          </li>
        ))}
      </ul>
      {adjustments.length === 0 ? null : (
        <>
          <h4 className="mt-1 text-label font-medium text-muted">{COPY.adjustments}</h4>
          <ul className="flex flex-col gap-2">
            {adjustments.map((line) => (
              <li key={line.id} className="flex items-start gap-2 text-body text-pretty">
                <span className="flex h-lh shrink-0 items-center text-muted">
                  <Icon icon={line.direction === 'down' ? ArrowDown : ArrowUp} size={16} />
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <ul className="flex flex-col gap-2">
        {after.map((line) => (
          <li key={line.id} className="text-body text-pretty">
            {line.text}
          </li>
        ))}
      </ul>
      {explanation.method.length === 0 ? null : (
        <details className="group mt-1">
          <summary className="inline-flex min-h-11 items-center text-control text-link underline">
            {COPY.method}
          </summary>
          <div className="mt-1 flex flex-col gap-2">
            {explanation.method.map((paragraph) => (
              <p key={paragraph} className="text-secondary text-pretty text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function PriceAnalysis({ gauge, explanation }: { gauge: GaugeView | null; explanation: Explanation }) {
  const reason = explanation.lines.find((line) => line.id === 'reason');
  return (
    <section
      aria-labelledby="analysis-title"
      className="@container rounded-card border border-divider bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="analysis-title" className="text-heading font-bold">
          {COPY.title}
        </h2>
        <InfoPopover label={COPY.info} closeLabel={COPY.infoClose} content={gaugeInfo()} />
      </div>
      <p className="mt-1 text-control font-semibold text-balance">{explanation.verdict}</p>
      {gauge === null ? (
        <p className="mt-3 text-body text-pretty text-muted">{COPY.notValued}</p>
      ) : (
        <>
          <Gauge view={gauge} />
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-label font-medium text-muted">{COPY.thisPrice}</dt>
              <dd className="text-control font-semibold">
                {gauge.price === null ? '—' : <NumericText>{gauge.price}</NumericText>}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-label font-medium text-muted">{COPY.marketValue}</dt>
              <dd className="text-control font-semibold">
                <NumericText>{gauge.value}</NumericText>
                <span className="block text-meta font-normal text-muted">
                  {COPY.valuedOn(gauge.valuedOn)}
                </span>
              </dd>
            </div>
          </dl>
          {gauge.banded || reason === undefined ? null : (
            <p className="mt-4 flex items-start gap-2 rounded-control bg-surface-muted p-3 text-secondary text-pretty">
              <span className="flex h-lh shrink-0 items-center text-muted">
                <Icon icon={Info} size={16} />
              </span>
              <span>{reason.text}</span>
            </p>
          )}
          <ExplanationLines
            explanation={{
              ...explanation,
              lines: explanation.lines.filter((line) => gauge.banded || line.id !== 'reason'),
            }}
          />
        </>
      )}
    </section>
  );
}
