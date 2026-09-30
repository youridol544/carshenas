import { formatDate } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { NumericText } from '@/components/ui/numeric-text';
import { STATUS_COPY } from '@/features/data-status/data-status-copy';
import type { ExtractionEvaluation } from '@/features/data-status/data-status-types';

// How well listing text is read (CS-52's evaluation, published in ai_evaluation; CS-66): counts «۷۹۱ از ۷۹۲», never a
// rounded percentage, which would print 99.87 % as «۱۰۰٪». The listings that tried to instruct the model are
// counted with those held for a person.

export function ExtractionSection({ evaluation }: { evaluation: ExtractionEvaluation | null }) {
  return (
    <section aria-labelledby="extraction" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="extraction" className="text-heading font-bold">
          {STATUS_COPY.extractionTitle}
        </h2>
        <p className="max-w-reading text-secondary text-pretty text-muted">{STATUS_COPY.extractionLead}</p>
      </div>
      {evaluation === null ? (
        <p className="text-secondary text-muted">{STATUS_COPY.noExtraction}</p>
      ) : (
        <div className="flex flex-col gap-4 rounded-card border border-divider p-4 sm:p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                key: 'fields',
                right: evaluation.fieldsRight,
                total: evaluation.fieldsScored,
                label: STATUS_COPY.fieldsRight,
              },
              {
                key: 'items',
                right: evaluation.itemsRight,
                total: evaluation.items,
                label: STATUS_COPY.itemsRight,
              },
              ...(evaluation.injectedItems === 0
                ? []
                : [
                    {
                      key: 'injected',
                      right: evaluation.injectedHeld,
                      total: evaluation.injectedItems,
                      label: STATUS_COPY.injectedHeld,
                    },
                  ]),
            ].map((fact) => (
              <div key={fact.key} className="flex flex-col gap-1">
                <dt className="order-2 text-secondary text-pretty text-muted">{fact.label}</dt>
                <dd className="order-1 text-title font-bold">
                  <NumericText>{formatCount(fact.right)}</NumericText>{' '}
                  <span className="text-control font-normal text-muted">
                    {STATUS_COPY.of} <NumericText>{formatCount(fact.total)}</NumericText>
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-secondary text-pretty text-muted">
            {STATUS_COPY.extractionOn}{' '}
            <time dateTime={evaluation.evaluatedOn}>{formatDate(`${evaluation.evaluatedOn}T12:00:00Z`)}</time>
          </p>
        </div>
      )}
    </section>
  );
}
