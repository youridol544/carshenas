// The frame every part of the worker screen shares (CS-41): a titled section, and a figure with its label. Numbers that
// the page refreshes in place use tabular digits, so a changing count never shifts its neighbours.

export function WorkerSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-heading font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Card({
  labelledBy,
  holdRefresh = false,
  children,
}: {
  labelledBy: string;
  /** The page does not refresh while the pointer or focus is inside (auto-refresh.tsx). */
  holdRefresh?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      aria-labelledby={labelledBy}
      data-refresh-hold={holdRefresh ? '' : undefined}
      className="flex min-w-0 flex-col gap-4 rounded-card border border-divider p-4"
    >
      {children}
    </article>
  );
}

/**
 * A figure with its label above it, in a `<dl>`. The figure sits at the foot of its cell, so figures in one row line
 * up when a label wraps to a second line.
 */
export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1">
      <dt className="text-label font-medium text-muted">{label}</dt>
      <dd className="text-control font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** A machine name the worker wrote (a queue, a job kind, an error), left to right inside Persian text. */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <span dir="ltr" lang="en" className="wrap-anywhere">
      {children}
    </span>
  );
}
