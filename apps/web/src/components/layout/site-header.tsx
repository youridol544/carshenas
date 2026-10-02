import Link from 'next/link';
import { HeaderNav } from '@/components/layout/header-nav';

// The header of every product page: the name, which leads home, at the inline start, and an account slot at the
// inline end (a visitor's way in, or a signed-in person's menu), which the route's layout passes in. A divider under
// it, no shadow: nothing floats here (design-language.md, section 4).

export const BRAND_NAME = 'کارشناس';

export function SiteHeader({ accountSlot }: { accountSlot?: React.ReactNode }) {
  return (
    <header className="border-b border-divider bg-canvas">
      {/* A container, so the account slot can shorten its words when the row is narrow; in rem, so enlarged text
          counts as narrow too. The row wraps rather than scroll sideways if even that is not enough (WCAG 1.4.10). */}
      <div className="@container mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-4 px-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="inline-flex min-h-11 items-center text-heading font-bold text-default">
            {BRAND_NAME}
          </Link>
          <HeaderNav />
        </div>
        {accountSlot}
      </div>
    </header>
  );
}
