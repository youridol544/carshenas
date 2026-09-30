import { HOW_STEPS, STATUS_COPY } from '@/features/data-status/data-status-copy';

// How the index is kept fresh (ADR-0017 points 3, 5, 8 and 9), in plain Farsi: part of the page's static shell, so it
// shows at once while the figures load.

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-4">
      <h2 id="how-it-works" className="text-heading font-bold">
        {STATUS_COPY.howTitle}
      </h2>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {HOW_STEPS.map((step) => (
          <li key={step.key} className="flex flex-col gap-1 rounded-card bg-surface-muted p-4">
            <h3 className="text-control font-semibold">{step.title}</h3>
            <p className="text-secondary text-pretty text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
