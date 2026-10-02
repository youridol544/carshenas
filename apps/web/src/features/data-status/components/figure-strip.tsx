// A row of figures between two rules (CS-66): the page's one way of showing numbers side by side, so the overview,
// a source, the market values and the text reading all read alike. Separated by space and hairlines, never by boxes
// (design-language.md, section 4). On a phone the figures sit two to a row, or one below 22.5rem, where a long value
// needs the whole line; from 40rem they share one row, each after a vertical hairline.

export type Figure = {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: string;
};

const COLUMNS = {
  3: 'grid-cols-1 min-[22.5rem]:grid-cols-3',
  4: 'grid-cols-1 min-[22.5rem]:grid-cols-2 sm:grid-cols-4',
} as const;

const VALUE_SIZE = { large: 'text-title', medium: 'text-heading' } as const;

export function FigureStrip({
  figures,
  columns,
  size = 'large',
}: {
  figures: readonly Figure[];
  /** How many share the row from 40rem; the strip is meant to hold exactly that many. */
  columns: keyof typeof COLUMNS;
  size?: keyof typeof VALUE_SIZE;
}) {
  return (
    <dl className={`grid gap-x-4 border-y border-divider sm:gap-x-0 ${COLUMNS[columns]}`}>
      {figures.map((figure) => (
        <div
          key={figure.key}
          className="flex min-w-0 flex-col gap-1 py-4 sm:border-s sm:border-divider sm:px-4 sm:first:border-s-0 sm:first:ps-0"
        >
          <dt className="text-secondary text-pretty text-muted">{figure.label}</dt>
          <dd className={`min-h-lh min-w-0 font-bold ${VALUE_SIZE[size]}`}>{figure.value}</dd>
          {figure.hint === undefined ? null : <dd className="text-meta text-muted">{figure.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A bar centred in one line box of the figure it stands for, while the figures load. */
export function FigureSkeleton() {
  return (
    <span aria-hidden className="flex h-lh w-24 max-w-full items-center">
      <span className="h-3 w-full rounded-badge bg-skeleton" />
    </span>
  );
}
