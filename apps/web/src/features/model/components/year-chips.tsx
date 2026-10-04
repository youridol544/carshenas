import type { Route } from 'next';
import Link from 'next/link';
import { ScrollRail } from '@/components/ui/scroll-rail';
import { MODEL_COPY } from '@/features/model/model-copy';
import type { YearRow } from '@/features/model/model-types';
import { modelHref } from '@/lib/model-address';

// The model year the page is about (CS-67): «همه‌ی سال‌ها» and one chip for each year that has listings, newest first.
// They are links, not a script: each is the page's own address with `?year=`, so a year can be shared and the browser's
// back button steps through the choices. The row scrolls sideways (ScrollRail: no scrollbar, a fade on the side that has
// more, previous and next for a mouse, and the chosen year brought to the middle after the page reloads); it wraps from a
// desktop's width. The chosen chip is solid. A chip is 44 px high and its target is the chip.

const COPY = MODEL_COPY.years;

function chipClasses(current: boolean): string {
  return `inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-4 text-label whitespace-nowrap transition-colors ${
    current
      ? 'border-action bg-action text-on-action'
      : 'border-control bg-surface text-default hover:bg-surface-hover'
  }`;
}

type YearChipsProps = {
  model: { makeSlug: string; slug: string };
  years: readonly YearRow[];
  year: number | null;
  total: number;
};

export function YearChips({ model, years, year, total }: YearChipsProps) {
  return (
    <nav aria-label={COPY.navLabel} className="flex flex-col gap-2">
      <p className="text-label font-medium text-muted">{COPY.label}</p>
      <ScrollRail
        as="ul"
        className="-mx-4 lg:mx-0"
        scrollerClassName="flex gap-2 px-4 pb-1 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0"
        current={{ selector: '[aria-current="page"]', key: year }}
      >
        <li className="shrink-0">
          <Link
            href={modelHref(model) as Route}
            scroll={false}
            prefetch={false}
            aria-current={year === null ? 'page' : undefined}
            className={chipClasses(year === null)}
          >
            {COPY.allChip(total)}
          </Link>
        </li>
        {years.map((row) => (
          <li key={row.year} className="shrink-0">
            <Link
              href={modelHref(model, row.year) as Route}
              scroll={false}
              prefetch={false}
              aria-current={year === row.year ? 'page' : undefined}
              className={chipClasses(year === row.year)}
            >
              {COPY.chip(row.year, row.count)}
            </Link>
          </li>
        ))}
      </ScrollRail>
      <p className="text-meta text-muted">{COPY.pick}</p>
    </nav>
  );
}
