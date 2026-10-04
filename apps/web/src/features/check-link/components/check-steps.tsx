import { CHECK_COPY } from '@/features/check-link/check-copy';
import { CoveredList } from '@/features/check-link/components/covered-list';
import { LinkExample } from '@/features/check-link/components/link-example';
import { readCoveredCars } from '@/features/check-link/server/check-link-queries';
import { formatCount } from '@carshenas/locale/format-number';

// What the page offers before a link is pasted: three steps, an example of a link, and the cars Carshenas reads, so the
// limit is known before anything is pasted and no answer has to be a surprise (an empty state is a place to teach,
// ui-design craft.md section 7). The list is read when the page is asked for and left out if the read fails.

export async function CheckSteps() {
  const covered = await readCoveredCars();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section aria-labelledby="check-steps-title" className="flex flex-col gap-3">
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
        <LinkExample lead={CHECK_COPY.problems.example} />
      </section>
      {covered.length === 0 ? null : (
        <section aria-labelledby="check-covered-title" className="flex flex-col gap-3">
          <h2 id="check-covered-title" className="text-heading font-bold">
            {CHECK_COPY.covered.title}
          </h2>
          <CoveredList cars={covered} moreLabel={CHECK_COPY.covered.moreModels} />
        </section>
      )}
    </div>
  );
}
