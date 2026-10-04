import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { HOME_COPY } from '@/features/home/home-copy';

// The closing call to action (CS-63): after the three steps and the figures, one more way into the search for the
// buyer who read to the end. An outlined action, because the hero's search owns the page's one solid action.
export function ClosingCta() {
  return (
    <section
      aria-labelledby="home-cta"
      className="mx-auto flex w-full max-w-7xl flex-col items-start gap-4 px-4 py-12"
    >
      <h2 id="home-cta" className="max-w-reading text-heading font-bold text-balance lg:text-title">
        {HOME_COPY.cta.title}
      </h2>
      <Link href="/search" className={`${actionClasses('secondary')} gap-2`}>
        <span>{HOME_COPY.cta.action}</span>
        <Icon icon={ArrowLeft} />
      </Link>
    </section>
  );
}
