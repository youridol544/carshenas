import Link from 'next/link';

// Three levels of action (ui-design SKILL.md): one solid primary per screen, an outlined secondary, and a tertiary
// that looks like a link. Primary targets are 48 px high, the others at least 44 px.
export function ActionLevels() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-control bg-action px-6 text-control font-semibold text-on-action transition-colors hover:bg-action-hover"
      >
        جستجوی خودرو
      </Link>
      <Link
        href="#deal-ratings"
        className="inline-flex min-h-11 items-center justify-center rounded-control border border-control bg-surface px-4 text-control font-semibold text-default transition-colors hover:bg-surface-hover"
      >
        ارزیابی‌ها
      </Link>
      <Link
        href="#formats"
        className="inline-flex min-h-11 items-center px-2 text-control text-link underline"
      >
        مبلغ‌ها و تاریخ‌ها
      </Link>
    </div>
  );
}
