import type { Route } from 'next';
import Link from 'next/link';
import type { CoveredCars } from '@/features/check-link/check-link-types';

// The cars Carshenas reads in depth (CS-115): the limit of the product, stated as a short list of links to each model's page,
// never a wall of text. At most MAX_SHOWN are named; the rest are one link away, on the models page.

const MAX_SHOWN = 12;

const CHIP =
  'inline-flex min-h-11 items-center rounded-full border border-control bg-surface px-4 text-label font-medium text-default transition-colors hover:bg-surface-hover';

export function CoveredList({
  cars,
  lead,
  moreLabel,
}: {
  cars: CoveredCars;
  /** The sentence the list answers; empty for a list under a heading of its own. */
  lead?: string;
  moreLabel: string;
}) {
  if (cars.length === 0) return null;
  const shown = cars.slice(0, MAX_SHOWN);
  return (
    <div data-covered-cars className="flex flex-col gap-2">
      {lead === undefined ? null : <p className="text-body text-pretty text-default">{lead}</p>}
      <ul className="flex flex-wrap gap-2">
        {shown.map((car) => (
          <li key={car.key}>
            <Link href={car.href as Route} prefetch={false} className={CHIP}>
              <bdi>{car.name}</bdi>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/models"
            prefetch={false}
            className="inline-flex min-h-11 items-center px-2 text-control text-link underline"
          >
            {moreLabel}
          </Link>
        </li>
      </ul>
    </div>
  );
}
