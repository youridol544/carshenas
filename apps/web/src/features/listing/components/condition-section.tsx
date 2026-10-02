import { Check, Info, TriangleAlert } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { ConditionRow, ConditionTone } from '@/features/listing/listing-view';

// The car's condition twice, so the buyer sees who said what (CS-64, teardown pattern 32): the fields the seller filled
// in, and the facts the listing's text states, each with the short phrase it was read from, so a wrong reading is
// visible. A quote is only the phrase the reading rests on, never the seller's description (ADR-0017 point 10), and
// there is no quote at all for a phrase that was long or looked like a phone number.

const COPY = LISTING_COPY.condition;

const TONES = {
  good: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  neutral: 'bg-surface-muted text-muted',
} as const satisfies Record<ConditionTone, string>;

function Chip({ row }: { row: ConditionRow }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-label ${TONES[row.tone]}`}
    >
      {row.tone === 'neutral' ? (
        <Icon icon={Info} size={16} />
      ) : (
        <Icon icon={row.tone === 'good' ? Check : TriangleAlert} size={16} />
      )}
      {row.text}
    </span>
  );
}

function Rows({ rows, label }: { rows: readonly ConditionRow[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col items-start gap-1">
          <Chip row={row} />
          {row.quote === null ? null : (
            <p className="text-secondary text-pretty text-muted">
              <q>{row.quote}</q>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

type ConditionSectionProps = {
  declared: readonly ConditionRow[];
  fromText: readonly ConditionRow[];
  terms: readonly ConditionRow[];
};

export function ConditionSection({ declared, fromText, terms }: ConditionSectionProps) {
  const nothing = declared.length === 0 && fromText.length === 0 && terms.length === 0;
  return (
    <section aria-labelledby="condition-title" className="flex flex-col gap-4">
      <h2 id="condition-title" className="text-heading font-bold">
        {COPY.title}
      </h2>
      {nothing ? <p className="text-body text-muted">{COPY.none}</p> : null}
      {declared.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <h3 className="text-label font-medium text-muted">{COPY.declaredTitle}</h3>
          <Rows rows={declared} label={COPY.declaredTitle} />
        </div>
      )}
      {fromText.length === 0 && terms.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <h3 className="text-label font-medium text-muted">{COPY.textTitle}</h3>
          <p className="text-secondary text-pretty text-muted">{COPY.textHint}</p>
          <Rows rows={[...fromText, ...terms]} label={COPY.textTitle} />
        </div>
      )}
    </section>
  );
}
