import {
  COPY as ACCOUNT_COPY,
  newPassword,
  signIn,
  signUp,
  superadminFor,
  uniqueUsername,
} from '../../fixtures/accounts';
import {
  createTestSource,
  removeTestSources,
  stopTestSource,
  type TestSource,
  type TestSourceState,
} from '../../fixtures/sources';
import { expect, test as base } from '../../fixtures/test';
import { inflateText, inspectLayout, waitForHydration } from '../../gorilla/layout';
import type { Page } from '@playwright/test';

// The superadmin section's sources screen (CS-40): the superadmin signs in with the accounts' sign-in, pauses and
// resumes a source, sees each change with who made it and when, and resumes a source the crawler stopped on a block;
// visitors and buyers get a 404. Each test makes its own sources, removed when it ends, so tests run in any order and
// in parallel.

const COPY = {
  dashboardLink: 'توقف و ازسرگیری خزش منبع‌ها',
  title: 'منبع‌ها',
  pause: 'توقف خزش',
  resume: 'ازسرگیری خزش',
  enabled: 'فعال',
  paused: 'متوقف',
  stopped: 'متوقف به دست خزنده',
  stoppedNotice: 'خزنده این منبع را متوقف کرد',
  blocked: 'سایت درخواست را رد کرد',
  pausedResult: 'خزش متوقف شد.',
  resumedResult: 'خزش از سر گرفته شد.',
  stale: 'وضعیت عوض شده بود؛ چیزی تغییر نکرد.',
  pausedChange: 'خزش متوقف شد',
  resumedChange: 'خزش از سر گرفته شد',
  clearedStopFrom: 'توقف خزنده از',
  clearedStopLifted: 'برداشته شد',
  noChanges: 'هنوز کسی وضعیت این منبع را تغییر نداده است.',
  noAnswer: 'پاسخی نرسید؛ شاید تغییر ثبت شده باشد.',
  showCurrentState: 'دیدن وضعیت تازه',
  notFound: 'این صفحه پیدا نشد',
} as const;

// 13:13:44 UTC on 2026-09-29 is 16:43 on 7 Mehr 1405 in Tehran.
const STOPPED_AT = '2026-09-29 13:13:44.123456+00';

const test = base.extend<{ sources: (state: TestSourceState) => Promise<TestSource> }>({
  sources: async ({}, use) => {
    const made: string[] = [];
    await use(async (state) => {
      const source = await createTestSource(state);
      made.push(source.id);
      return source;
    });
    await removeTestSources(made);
  },
});

async function signInAsSuperadmin(page: Page, workerIndex: number): Promise<string> {
  const superadmin = superadminFor(workerIndex);
  await page.goto('/sign-in');
  await signIn(page, superadmin.username, superadmin.password);
  await expect(page).toHaveURL('/admin');
  return superadmin.username;
}

function card(page: Page, source: TestSource) {
  return page.getByRole('article', { name: source.nameFa });
}

function changes(page: Page, source: TestSource) {
  return card(page, source).getByRole('region', { name: 'تغییرهای اخیر' }).getByRole('listitem');
}

test.describe('the superadmin', () => {
  test('pauses and resumes a source, and each change is listed with who made it and when', async ({
    page,
    sources,
    rtl,
    a11y,
  }, testInfo) => {
    const source = await sources({ crawlState: 'enabled' });
    const username = await signInAsSuperadmin(page, testInfo.workerIndex);
    await page.getByRole('link', { name: COPY.dashboardLink }).click();
    await expect(page).toHaveURL('/admin/sources');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');

    const sourceCard = card(page, source);
    await expect(sourceCard.getByText(COPY.enabled, { exact: true })).toBeVisible();
    await expect(sourceCard.getByText(COPY.noChanges)).toBeVisible();
    await rtl.expectDocumentRtl();
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();

    // From the keyboard (WebKit gives a clicked button no focus): the same button now resumes, and focus stays on it.
    await sourceCard.getByRole('button', { name: COPY.pause }).press('Enter');
    await expect(sourceCard.getByRole('status')).toHaveText(COPY.pausedResult);
    await expect(sourceCard.getByText(COPY.paused, { exact: true })).toBeVisible();
    const resume = sourceCard.getByRole('button', { name: COPY.resume });
    await expect(resume).toBeFocused();
    await expect(changes(page, source)).toHaveCount(1);
    const paused = changes(page, source).first();
    await expect(paused).toContainText(COPY.pausedChange);
    await expect(paused).toContainText(username);
    await expect(paused.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
    await rtl.expectPersianDigits(paused.locator('time'));

    await resume.click();
    await expect(sourceCard.getByRole('status')).toHaveText(COPY.resumedResult);
    await expect(sourceCard.getByText(COPY.enabled, { exact: true })).toBeVisible();
    await expect(changes(page, source)).toHaveCount(2);
    await expect(changes(page, source).first()).toContainText(COPY.resumedChange);

    // The record survives a reload: it is in the database, not in the page.
    await page.reload();
    await expect(changes(page, source)).toHaveCount(2);
    await a11y.check();
  });

  test('sees why the crawler stopped a source, resumes it, and the stop moves into its history', async ({
    page,
    sources,
  }, testInfo) => {
    const source = await sources({
      crawlState: 'stopped_on_block',
      stoppedAt: STOPPED_AT,
      reason: 'blocked',
    });
    await signInAsSuperadmin(page, testInfo.workerIndex);
    await page.goto('/admin/sources');
    const sourceCard = card(page, source);
    await expect(sourceCard.getByText(COPY.stopped, { exact: true })).toBeVisible();
    await expect(sourceCard.getByText(COPY.stoppedNotice)).toBeVisible();
    await expect(sourceCard).toContainText('۷ مهر ۱۴۰۵');
    await expect(sourceCard).toContainText('۱۶:۴۳');
    await expect(sourceCard).toContainText(COPY.blocked);

    await sourceCard.getByRole('button', { name: COPY.resume }).press('Enter');
    await expect(sourceCard.getByRole('status')).toHaveText(COPY.resumedResult);
    await expect(sourceCard.getByText(COPY.enabled, { exact: true })).toBeVisible();
    await expect(sourceCard.getByText(COPY.stoppedNotice)).toHaveCount(0);
    const resumed = changes(page, source).first();
    await expect(resumed).toContainText(COPY.resumedChange);
    await expect(resumed).toContainText(COPY.clearedStopFrom);
    await expect(resumed).toContainText(COPY.clearedStopLifted);
    await expect(resumed).toContainText('۷ مهر ۱۴۰۵');
    await expect(resumed).toContainText(COPY.blocked);
    await expect(sourceCard.getByRole('button', { name: COPY.pause })).toBeFocused();
  });

  test('never clears a stop the page did not show: a stop that arrived after the page opened comes first', async ({
    page,
    sources,
  }, testInfo) => {
    const source = await sources({ crawlState: 'paused' });
    await signInAsSuperadmin(page, testInfo.workerIndex);
    await page.goto('/admin/sources');
    const sourceCard = card(page, source);
    await expect(sourceCard.getByText(COPY.paused, { exact: true })).toBeVisible();
    // The crawler stopped the source after the page was opened, while the page still shows it paused.
    await stopTestSource(source.id, STOPPED_AT);

    await sourceCard.getByRole('button', { name: COPY.resume }).click();
    await expect(sourceCard.getByRole('status')).toContainText(COPY.stale);
    await expect(sourceCard.getByText(COPY.stopped, { exact: true })).toBeVisible();
    await expect(sourceCard.getByText(COPY.stoppedNotice)).toBeVisible();
    await expect(sourceCard.getByText(COPY.noChanges)).toBeVisible();
  });

  test('keeps the screen within a 320 px phone when every string is long Farsi', async ({
    page,
    sources,
  }, testInfo) => {
    await sources({ crawlState: 'stopped_on_block', stoppedAt: STOPPED_AT, reason: 'blocked' });
    await signInAsSuperadmin(page, testInfo.workerIndex);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/admin/sources');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.title);
    const plain = await inspectLayout(page, { minTarget: 44 });
    expect.soft(plain.overflowPx, 'the page scrolls sideways').toBeLessThanOrEqual(1);
    expect.soft(plain.clipped, 'text cut off by its box').toEqual([]);
    expect.soft(plain.smallTargets, 'controls under 44 px').toEqual([]);
    expect.soft(plain.brokenWords, 'a Persian word split across lines').toEqual([]);
    expect.soft(plain.brokenNumbers, 'a number split inside a group or from its unit').toEqual([]);
    await waitForHydration(page);
    await inflateText(page);
    const inflated = await inspectLayout(page, { minTarget: 44 });
    expect(inflated.overflowPx, 'the page scrolls sideways with long Farsi').toBeLessThanOrEqual(1);
    expect(inflated.clipped, 'text cut off by its box with long Farsi').toEqual([]);
  });
});

test.describe('a press whose answer never arrives', () => {
  // What this test does on purpose: the dropped POST, and the error the card's boundary catches, which React logs.
  test.use({
    ignoreBrowserErrors: [
      [
        /\[requestfailed\] POST .*\/admin\/sources net::ERR_CONNECTION_RESET/,
        /Failed to load resource: net::ERR_CONNECTION_RESET/,
        /TypeError: Failed to fetch/,
      ],
      { scope: 'test' },
    ],
  });

  test('stays inside its card, says the change may have landed, and shows the source again on request', async ({
    page,
    sources,
  }, testInfo) => {
    const source = await sources({ crawlState: 'enabled' });
    await signInAsSuperadmin(page, testInfo.workerIndex);
    await page.goto('/admin/sources');
    const sourceCard = card(page, source);
    // The connection drops on the way: the Server Action's POST never reaches the server.
    await page.route('**/admin/sources', (route) =>
      route.request().method() === 'POST' ? route.abort('connectionreset') : route.fallback(),
    );
    await sourceCard.getByRole('button', { name: COPY.pause }).click();
    await expect(sourceCard.getByRole('alert')).toContainText(COPY.noAnswer);
    await expect(sourceCard.getByRole('alert')).toContainText('کد پیگیری');
    // The rest of the screen is still there.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.title);
    await expect(sourceCard.getByText(COPY.enabled, { exact: true })).toBeVisible();

    await page.unroute('**/admin/sources');
    await sourceCard.getByRole('button', { name: COPY.showCurrentState }).click();
    // Nothing reached the server, so the source is still crawled and its control is back.
    await expect(sourceCard.getByRole('button', { name: COPY.pause })).toBeVisible();
    await expect(sourceCard.getByText(COPY.noChanges)).toBeVisible();
  });
});

test.describe('everyone else', () => {
  test.use({
    ignoreBrowserErrors: [
      [/\[http 404\] GET .*\/admin\/sources$/, /Failed to load resource.*404/],
      { scope: 'test' },
    ],
  });

  test('gets a real 404 from the sources screen, as a visitor and as a buyer, and no link to it', async ({
    page,
    request,
  }) => {
    // A raw request, not page.goto: a production build that streamed first would answer 200.
    const visitorRequest = await request.get('/admin/sources', { maxRedirects: 0 });
    expect(visitorRequest.status()).toBe(404);
    const visitor = await page.goto('/admin/sources');
    expect(visitor?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.notFound);

    await signUp(page, uniqueUsername(), newPassword());
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
    await page.getByRole('button', { name: ACCOUNT_COPY.menu }).click();
    await expect(page.getByRole('menuitem', { name: ACCOUNT_COPY.admin })).toHaveCount(0);
    await page.keyboard.press('Escape');
    const buyer = await page.goto('/admin/sources');
    expect(buyer?.status()).toBe(404);
  });
});
