import { CHECK_COPY } from '@/features/check-link/check-copy';
import { formatCount } from '@carshenas/locale/format-number';

// What the page offers before a link is pasted: three steps, so the empty page says how to get the link and what comes
// back (an empty state is a place to teach, ui-design craft.md section 7). Server markup.

export function CheckSteps() {
  return (
    <section aria-labelledby="check-steps-title" className="flex max-w-2xl flex-col gap-3">
      <h2 id="check-steps-title" className="text-heading font-bold">
        {CHECK_COPY.page.stepsLabel}
      </h2>
      <ol className="flex flex-col gap-3">
        {CHECK_COPY.page.steps.map((step, index) => (
          <li key={step} className="flex items-start gap-3 text-body text-pretty">
            <span
              aria-hidden="true"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-pressed text-label font-semibold"
            >
              {formatCount(index + 1)}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
