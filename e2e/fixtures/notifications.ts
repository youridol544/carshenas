import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

// Notifications for the browser tests (CS-68). Their producers arrive with later tasks (CS-69, CS-71, CS-72), so a
// test notifies its buyer the way `pnpm notifications:sample` does: real recent price drops, through the same database
// function a producer calls, so a muted kind gets nothing and a repeated run adds nothing. It runs as the migration
// role from the repository's .env, so these tests need the database the app under test uses.

const REPOSITORY = fileURLToPath(new URL('../..', import.meta.url));

export const NOTIFICATIONS = {
  title: 'اعلان‌ها',
  menuItem: 'اعلان‌ها',
  markRead: 'علامت خوانده‌شده',
  markAllRead: 'همه را خواندم',
  allRead: 'همه‌ی اعلان‌ها خوانده شده‌اند.',
  emptyHeading: 'هنوز اعلانی ندارید',
  emptyAction: 'جست‌وجوی خودرو',
  priceDropSetting: 'کاهش قیمت آگهی‌های نشان‌شده',
  failure: 'علامت خوانده‌شده ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید.',
  retry: 'تلاش دوباره',
  today: 'امروز',
} as const;

// A count is joined to its noun by a no-break space, as the app's formatters write it.
const NO_BREAK_SPACE = String.fromCharCode(0xa0);

/** «۳ اعلان خوانده‌نشده», as the inbox and the account button say it. */
export function unreadText(persianCount: string): string {
  return `${persianCount}${NO_BREAK_SPACE}اعلان خوانده‌نشده`;
}

export type SampleOutcome = { created: number; skipped: number };

/** Notifies `username` of `count` recent real price drops, after passing over `skip` of them. */
export function notifySample(username: string, count: number, skip = 0): SampleOutcome {
  const output = execFileSync(
    'pnpm',
    ['--silent', 'notifications:sample', username, '--count', String(count), '--skip', String(skip)],
    { cwd: REPOSITORY, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const line = output.trim().split('\n').at(-1) ?? '';
  return JSON.parse(line) as SampleOutcome;
}

export async function openInbox(page: Page): Promise<void> {
  await page.goto('/account/notifications');
}
