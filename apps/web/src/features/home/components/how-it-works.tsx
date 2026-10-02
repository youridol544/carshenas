import Link from 'next/link';
import type { ReactNode } from 'react';
import { InfoPopover } from '@/components/ui/info-popover';
import { HOME_COPY } from '@/features/home/home-copy';
import { filterInfo } from '@/features/search/info-content';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { formatCount } from '@carshenas/locale/format-number';
import { deal } from '@carshenas/search/filters';

// «کارشناس چطور کار می‌کند؟» (CS-63; teardown pattern 16): three steps, each a sentence about what the product does,
// and under them the measured numbers (a slot: the page streams them in from the database's own figures). The rating
// step carries the info control of the price rating, whose text is the filter's own definition in @carshenas/search
// (what each word measures against the market value), so the page explains its rule from the rule.

type HowItWorksProps = {
  /** The measured figures, with their own loading and failure states. */
  figures: ReactNode;
};

export function HowItWorks({ figures }: HowItWorksProps) {
  const [read, value, rate] = HOME_COPY.how.steps;
  const steps = [read, value, rate];
  return (
    <section aria-labelledby="home-how" className="bg-surface-muted">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12">
        <h2 id="home-how" className="text-heading font-bold text-balance lg:text-title">
          {HOME_COPY.how.title}
        </h2>
        <ol className="grid gap-8 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.key} className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action text-label font-medium text-on-action"
              >
                {formatCount(index + 1)}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-1">
                  <h3 className="text-control font-semibold text-balance">{step.title}</h3>
                  {step.key === 'rate' ? (
                    <InfoPopover
                      label={SEARCH_COPY.info.button(deal.label)}
                      closeLabel={SEARCH_COPY.info.close}
                      content={filterInfo(deal)}
                    />
                  ) : null}
                </div>
                <p className="text-secondary text-pretty text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-3">
          <h3 className="text-control font-semibold">{HOME_COPY.how.trustTitle}</h3>
          {figures}
          <Link
            href="/status"
            className="inline-flex min-h-11 w-fit items-center text-control text-link underline"
          >
            {HOME_COPY.how.status}
          </Link>
        </div>
      </div>
    </section>
  );
}
