import { formatCount } from '@carshenas/locale/format-number';
import { HOW_STEPS, STATUS_COPY } from '@/features/data-status/data-status-copy';

// How the index is kept fresh (ADR-0017 points 3, 5, 8 and 9), in plain Farsi, as a numbered list. Part of the page's
// static shell, so it shows at once while the figures load, in two forms: on a desktop an aside beside the figures;
// on a phone a closed disclosure under the lead, above the figures, because anything under the streamed figures would
// move when they arrive. One of the two is always display: none, so only one reaches the accessibility tree.

function Steps() {
  return (
    <ol className="flex flex-col gap-4">
      {HOW_STEPS.map((step, index) => (
        <li key={step.key} className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted px-1 text-label font-medium text-muted"
          >
            {formatCount(index + 1)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="text-control font-semibold">{step.title}</h3>
            <p className="text-secondary text-pretty text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorksAside() {
  return (
    <aside aria-labelledby="how-it-works" className="hidden flex-col gap-4 lg:flex">
      <h2 id="how-it-works" className="text-heading font-bold">
        {STATUS_COPY.howTitle}
      </h2>
      <Steps />
    </aside>
  );
}

export function HowItWorksDisclosure() {
  return (
    <details className="border-y border-divider lg:hidden">
      <summary className="flex min-h-11 items-center text-control font-semibold text-link">
        {STATUS_COPY.howTitle}
      </summary>
      <div className="pt-2 pb-4">
        <Steps />
      </div>
    </details>
  );
}
