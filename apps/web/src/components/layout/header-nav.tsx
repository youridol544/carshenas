'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The product's destinations in the header, after the name: for now the search, which is where a buyer starts (the home
// page, CS-63, has its own search box). The page the buyer is on is marked for assistive technology (aria-current) and
// by weight-neutral colour, so nothing in the row moves between pages. A link of the row is a 44 px target.

export const NAV_LINKS = [
  { href: '/search', label: 'جست‌وجو', phone: true },
  // The paste box is on the home and the search page, where a phone is; the row has no room for a third word there (CS-65).
  { href: '/check', label: 'ارزیابی لینک', phone: false },
] as const;

export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="پیمایش اصلی" className="flex min-w-0 items-center">
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href} className={link.phone ? undefined : 'hidden sm:block'}>
              <Link
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-control px-3 text-control transition-colors hover:bg-surface-hover ${current ? 'text-default underline' : 'text-muted'}`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
