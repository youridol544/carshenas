import { Bookmark, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { MARKED_COPY } from '@/features/marked-listings/marked-copy';
import { countMarkedListings } from '@/features/marked-listings/server/marked-queries';
import { MARKED_PATH } from '@/lib/return-path';

// The account page's way to the marked listings (CS-69): one row, the whole of it a link, saying how many there are. The
// chevron points left, forwards in a right-to-left page.

export async function MarkedCard({ accountId }: { accountId: number }) {
  const count = await countMarkedListings(accountId);
  return (
    <Link
      href={MARKED_PATH}
      className="flex min-h-16 items-center gap-3 rounded-card border border-divider bg-surface p-4 transition-colors hover:bg-surface-hover"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-default">
        <Icon icon={Bookmark} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-control font-semibold text-default">{MARKED_COPY.accountCard.heading}</span>
        <span className="text-secondary text-muted">
          {count === 0 ? MARKED_COPY.accountCard.none : MARKED_COPY.count(count)}
        </span>
      </span>
      <Icon icon={ChevronLeft} className="text-muted" />
    </Link>
  );
}
