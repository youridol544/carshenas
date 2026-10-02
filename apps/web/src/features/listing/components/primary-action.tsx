import { ExternalLink } from 'lucide-react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { LISTING_COPY } from '@/features/listing/listing-copy';

// The page's one primary action (CS-64 criterion 4; teardown pattern 27): the click-out to the listing on its source, in a
// new tab, with its note spoken. An address that is not https is never a link (the card's rule), so the action is left
// out instead of leading nowhere.

const COPY = LISTING_COPY.action;

/** The source's address when it is a safe one to open; null otherwise. */
export function clickOutHref(url: string): string | null {
  if (!URL.canParse(url)) return null;
  const address = new URL(url);
  return address.protocol === 'https:' ? address.href : null;
}

export function PrimaryAction({
  href,
  source,
  className = '',
}: {
  href: string;
  source: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={`${COPY.openOn(source)}، ${COPY.opensInNewTab}`}
      data-click-out
      className={`${actionClasses('primary')} gap-2 ${className}`}
    >
      {COPY.openOn(source)}
      <Icon icon={ExternalLink} />
    </a>
  );
}
