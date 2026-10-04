import type { Route } from 'next';
import Link from 'next/link';

// The three levels of action (ui-design SKILL.md): one solid primary per screen, an outlined secondary and a
// tertiary that looks like a link. Primary and secondary are 48 px high, the tertiary's target at least 44 px. A
// link is an ActionLink; a <button> takes the same classes from actionClasses. When ADR-0005's first interactive
// primitive brings shadcn's Button, these become its variants.
//
// `group relative pending-slot` is the button's side of the pending indicator (Spinner, spinner.tsx): `group` lets
// the spinner see `data-pending`, `relative` anchors it, and `pending-slot` (globals.css) gives a button that holds one
// the padding to carry it, so the label never moves, in any state.
const PENDING = 'group relative pending-slot';
const classes = {
  primary: `${PENDING} inline-flex min-h-12 items-center justify-center rounded-control bg-action px-6 text-control font-semibold text-on-action transition-colors hover:bg-action-hover`,
  secondary: `${PENDING} inline-flex min-h-12 items-center justify-center rounded-control border border-control bg-surface px-6 text-control font-semibold text-default transition-colors hover:bg-surface-hover`,
  tertiary: `${PENDING} inline-flex min-h-11 items-center px-2 text-control text-link underline`,
} as const;

export type ActionLevel = keyof typeof classes;

export function actionClasses(level: ActionLevel) {
  return classes[level];
}

type ActionLinkProps<T extends string> = {
  level: ActionLevel;
  href: Route<T> | URL;
  children: React.ReactNode;
};

export function ActionLink<T extends string>({ level, href, children }: ActionLinkProps<T>) {
  // T is passed on explicitly: once the app has a dynamic route, TypeScript cannot infer Link's route type from a
  // generic `Route<T> | URL` and falls back to URL (checked with next typegen, 2026-09-28).
  return (
    <Link<T> href={href} className={classes[level]}>
      {children}
    </Link>
  );
}
