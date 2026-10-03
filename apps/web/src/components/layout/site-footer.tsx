import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND_NAME } from '@/components/layout/site-header';

// The footer of every product page (CS-63): the name, the two places a visitor may want next (the search and the
// data-status page, which says how fresh the numbers are), and the credits of the photographs the product shows,
// passed in by the route's layout as a slot: the layout composes features, this component knows none. A divider over
// it, no shadow; nothing floats here (design-language.md, section 4).

type SiteFooterProps = {
  searchLabel: string;
  statusLabel: string;
  /** The index of model pages (CS-67). */
  modelsLabel: string;
  label: string;
  /** The disclosures that credit the photographs. */
  credits: ReactNode;
};

export function SiteFooter({ searchLabel, statusLabel, modelsLabel, label, credits }: SiteFooterProps) {
  return (
    <footer className="mt-auto border-t border-divider bg-canvas">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-heading font-bold">{BRAND_NAME}</p>
          <nav aria-label={label} className="flex flex-wrap gap-x-4">
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center text-control text-link underline"
            >
              {searchLabel}
            </Link>
            <Link
              href="/models"
              className="inline-flex min-h-11 items-center text-control text-link underline"
            >
              {modelsLabel}
            </Link>
            <Link
              href="/status"
              className="inline-flex min-h-11 items-center text-control text-link underline"
            >
              {statusLabel}
            </Link>
          </nav>
        </div>
        <div className="flex max-w-reading flex-col gap-1">{credits}</div>
      </div>
    </footer>
  );
}
