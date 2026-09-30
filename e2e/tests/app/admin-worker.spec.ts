import { signIn, superadminFor } from '../../fixtures/accounts';
import {
  addFailure,
  removePipeline,
  seedPipeline,
  silenceProcess,
  type Pipeline,
} from '../../fixtures/pipeline';
import { expect, test as base } from '../../fixtures/test';
import { inflateText, inspectLayout, waitForHydration } from '../../gorilla/layout';
import type { Locator, Page } from '@playwright/test';

// The superadmin section's worker screen (CS-41), on seeded data: whether the worker is alive, and a process that
// stops beating shown as down at the next refresh; jobs by queue and state, a failure's error and trace id, retried
// and cancelled; each source's crawl against its budget with its outcomes; listings in and out per tracked model with
// the freshness chart and the window switcher; and a source's problems with the way to resume it. Each test seeds its
// own source, queue and process, removed when it ends, so tests run in any order and in parallel beside a real
// worker writing to the same database.

const COPY = {
  dashboardLink: 'دیدن کارگر و خط پردازش',
  title: 'کارگر و خط پردازش',
  alive: 'در حال کار',
  silent: 'بی‌پاسخ',
  retry: 'تلاش دوباره',
  cancel: 'لغو',
  cancelConfirm: 'بله، لغو شود',
  cancelKeep: 'نه، بماند',
  cancelled: 'کار لغو شد.',
  newFailure: /خطای تازه/,
  retried: 'کار دوباره به صف رفت.',
  cancelledChange: 'لغو شد',
  retriedChange: 'دوباره فرستاده شد',
  waiting: 'منتظر تلاش دوباره',
  window7d: '۷ روز',
  stopped: 'خزنده این منبع را متوقف کرده است',
  resumeOnSources: 'بررسی و ازسرگیری در صفحه‌ی منبع‌ها',
  notFound: 'این صفحه پیدا نشد',
} as const;

const test = base.extend<{ pipeline: Pipeline }>({
  pipeline: async ({}, use) => {
    const pipeline = await seedPipeline();
    await use(pipeline);
    await removePipeline(pipeline);
  },
});

async function openWorkerScreen(page: Page, workerIndex: number): Promise<string> {
  const superadmin = superadminFor(workerIndex);
  await page.goto('/sign-in');
  await signIn(page, superadmin.username, superadmin.password);
  await expect(page).toHaveURL('/admin');
  await page.getByRole('link', { name: COPY.dashboardLink }).click();
  await expect(page).toHaveURL('/admin/worker');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.title);
  return superadmin.username;
}

function section(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true });
}

/** From 640 px the screen shows a table; a phone gives each row its own lines. */
function isWide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 640;
}

/** A queue's jobs by state, in the screen's order: waiting, running, retrying, done, failed, cancelled. */
async function expectQueueCounts(page: Page, jobs: Locator, queue: string, counts: string[]) {
  if (isWide(page)) {
    await expect(jobs.getByRole('row').filter({ hasText: queue }).getByRole('cell')).toHaveText(counts);
    return;
  }
  const labels = ['در انتظار', 'در حال اجرا', 'منتظر تلاش دوباره', 'انجام‌شده', 'ناموفق', 'لغوشده'];
  const queues = jobs.getByRole('list', { name: 'کارها در هر صف، به تفکیک وضعیت' });
  await expect(queues.getByRole('listitem').filter({ hasText: queue })).toContainText(
    labels.map((label, index) => `${label} ${counts[index] ?? ''}`).join(' · '),
  );
}

/** A listing row's figures: total, active, new, re-priced, gone, and the median time since the last check. */
async function expectFlow(page: Page, listings: Locator, name: string, figures: (string | RegExp)[]) {
  if (isWide(page)) {
    await expect(listings.getByRole('row').filter({ hasText: name }).getByRole('cell')).toHaveText(figures);
    return;
  }
  const item = listings.getByRole('listitem').filter({ hasText: name });
  const labels = ['کل', 'فعال', 'تازه', 'تغییر قیمت', 'خارج از بازار'];
  for (const [index, label] of labels.entries()) {
    await expect(item).toContainText(`${label} ${String(figures[index])}`);
  }
}

test.describe('the worker screen', () => {
  test('is a right-to-left page with Persian digits and no accessibility violations', async ({
    page,
    pipeline,
    rtl,
    a11y,
  }, testInfo) => {
    await openWorkerScreen(page, testInfo.workerIndex);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    const process = page.getByRole('article', { name: pipeline.process.name });
    await expect(process).toBeVisible();
    await rtl.expectDocumentRtl();
    await rtl.expectNoHorizontalOverflow();
    await rtl.expectPersianDigits(process.locator('time').first());
    await a11y.check();
  });

  test('shows a beating process alive with its release, and down at the next refresh once it stops beating', async ({
    page,
    pipeline,
  }, testInfo) => {
    // The page asks again every 15 seconds; the test's clock moves those seconds on instead of waiting for them.
    await page.clock.install();
    await openWorkerScreen(page, testInfo.workerIndex);
    const process = page.getByRole('article', { name: pipeline.process.name });
    await expect(process).toContainText(COPY.alive);
    await expect(process).toContainText(pipeline.process.version);
    await expect(process).toContainText('۲ ساعت پیش');
    // Any worker alive makes the whole alive; this process is.
    await expect(section(page, 'کارگر').getByRole('status')).toHaveText(COPY.alive);

    await silenceProcess(pipeline.process.instanceId);
    await page.clock.runFor(15_000);
    await expect(process).toContainText(COPY.silent);
  });

  test('says a process silent for 45 seconds is not responding, and counts its silence in seconds', async ({
    page,
    pipeline,
  }, testInfo) => {
    await openWorkerScreen(page, testInfo.workerIndex);
    await silenceProcess(pipeline.process.instanceId, 45);
    await page.reload();
    const process = page.getByRole('article', { name: pipeline.process.name });
    await expect(process).toContainText(COPY.silent);
    // Not «اکنون»: the time agrees with the badge.
    await expect(process.locator('time').last()).toHaveText(/^۴[۵-۹]\sثانیه پیش$/);
  });

  test('lists jobs by queue and state, shows a failure with its error and trace id, and retries and cancels', async ({
    page,
    pipeline,
  }, testInfo) => {
    const username = await openWorkerScreen(page, testInfo.workerIndex);
    const jobs = section(page, 'کارها');
    await expectQueueCounts(page, jobs, pipeline.queue, ['۰', '۰', '۱', '۰', '۱', '۰']);

    const failed = jobs.getByRole('listitem').filter({ hasText: pipeline.errorMessage });
    await expect(failed).toContainText(pipeline.traceId);
    await expect(failed).toContainText('تلاش ۳ از ۳');
    await failed.getByRole('button', { name: COPY.retry }).click();
    await expect(failed.getByRole('status')).toHaveText(COPY.retried);
    // The pressed button is gone: focus moves to the answer, never to the page.
    await expect(failed.getByText(COPY.retried)).toBeFocused();
    const changes = jobs.getByRole('article', { name: 'تلاش‌های دوباره و لغوهای اخیر' });
    await expect(changes.getByRole('listitem').first()).toContainText(COPY.retriedChange);
    await expect(changes.getByRole('listitem').first()).toContainText(username);
    // Retried, it waits to run again; its control stays answered: no cancel appears under the finger that retried it.
    await expect(failed).toContainText(COPY.waiting);
    await expect(failed.getByRole('button')).toHaveCount(0);

    // A cancel asks first; «نه» keeps the job and gives the cancel button back its focus.
    const waiting = jobs.getByRole('listitem').filter({ hasText: pipeline.waitingErrorMessage });
    await expect(waiting).toContainText(COPY.waiting);
    await waiting.getByRole('button', { name: COPY.cancel }).click();
    await expect(waiting.getByRole('button', { name: COPY.cancelConfirm })).toBeFocused();
    await waiting.getByRole('button', { name: COPY.cancelKeep }).click();
    await expect(waiting.getByRole('button', { name: COPY.cancel })).toBeFocused();
    await waiting.getByRole('button', { name: COPY.cancel }).click();
    await waiting.getByRole('button', { name: COPY.cancelConfirm }).click();
    // The cancelled job stays where it was, answered, and the cancel is recorded.
    await expect(waiting.getByRole('status')).toHaveText(COPY.cancelled);
    await expect(waiting).toContainText('لغوشده');
    await expect(waiting.getByRole('button')).toHaveCount(0);
    await expect(changes.getByRole('listitem').first()).toContainText(COPY.cancelledChange);
    await expectQueueCounts(page, jobs, pipeline.queue, ['۰', '۰', '۱', '۰', '۰', '۱']);
  });

  test('keeps the failures in place when the page refreshes, and shows new ones only when asked', async ({
    page,
    pipeline,
  }, testInfo) => {
    await page.clock.install();
    await openWorkerScreen(page, testInfo.workerIndex);
    const failures = section(page, 'کارها').getByRole('article', { name: 'خطاهای اخیر' });
    const ours = failures.getByRole('listitem').filter({ hasText: pipeline.errorMessage });
    await expect(ours).toBeVisible();
    // Where the row sits in its card: other tests' queues above it may come and go meanwhile.
    const offset = async () => {
      const [row, card] = await Promise.all([ours.boundingBox(), failures.boundingBox()]);
      return (row?.y ?? 0) - (card?.y ?? 0);
    };
    const before = await offset();

    const late = `a failure after the page opened ${pipeline.queue}`;
    await addFailure(pipeline, late);
    const pill = failures.getByRole('button', { name: COPY.newFailure });
    // While the pointer rests on the failures the page holds still, whatever arrives.
    await ours.hover();
    await page.clock.runFor(15_000);
    await page.clock.runFor(15_000);
    await expect(pill).toHaveCount(0);
    expect(await offset()).toBe(before);
    // Once it leaves, the next refresh brings the news, as a button, and inserts no row: the rows that remain keep
    // their order (other tests' jobs, removed as those tests end, may drop out).
    const jobIds = () =>
      failures
        .getByRole('listitem')
        .evaluateAll((items) => items.map((item) => item.querySelector('[id^="job-"]')?.id ?? ''));
    const seen = await jobIds();
    await page.mouse.move(0, 0);
    await page.clock.runFor(15_000);
    await expect(pill).toBeVisible();
    const after = await jobIds();
    expect(after).toEqual(seen.filter((id) => after.includes(id)));
    await expect(failures.getByRole('listitem').filter({ hasText: late })).toHaveCount(0);

    await pill.click();
    await expect(failures.getByRole('listitem').filter({ hasText: late })).toBeVisible();
    await expect(pill).toHaveCount(0);
  });

  test("shows a source's crawl: today's requests against its budget, runs by kind and state, and outcomes", async ({
    page,
    pipeline,
  }, testInfo) => {
    await openWorkerScreen(page, testInfo.workerIndex);
    const crawl = section(page, 'خزش').getByRole('article', { name: pipeline.sourceNameFa });
    await expect(crawl).toContainText('درخواست‌های امروز: ۴٬۲۱۰ از سقف روزانه‌ی ۱۲٬۰۰۰');
    await expect(crawl.getByRole('listitem').filter({ hasText: 'صفحه‌ی آگهی · موفق' })).toContainText(
      '۱ اجرا',
    );
    await expect(crawl.getByRole('listitem').filter({ hasText: 'صفحه‌ی آگهی · موفق' })).toContainText(
      '۴ ثانیه',
    );
    await expect(crawl.getByRole('listitem').filter({ hasText: 'پیمایش فهرست · ناموفق' })).toBeVisible();
    // A run's counts read in Farsi, with Persian digits.
    await crawl.getByText('آخرین اجراها').click();
    await expect(crawl.getByRole('listitem').filter({ hasText: 'نسخه‌ی ذخیره‌شده ۱' }).first()).toBeVisible();
    await expect(crawl).not.toContainText('snapshotsStored');
    await expect(crawl.getByRole('term').filter({ hasText: 'پاسخ درست' }).locator('+ dd')).toHaveText('۱');
    await expect(crawl.getByRole('term').filter({ hasText: 'ردشده' }).locator('+ dd')).toHaveText('۱');
  });

  test('shows listings in and out per tracked model with the freshness chart, and counts over the chosen window', async ({
    page,
    pipeline,
  }, testInfo) => {
    await openWorkerScreen(page, testInfo.workerIndex);
    const listings = section(page, 'آگهی‌ها');
    await expectFlow(page, listings, pipeline.modelNameFa, ['۳', '۲', '۱', '۱', '۱', /دقیقه/]);
    // The chart's hourly points are also a table: the latest hour's figures.
    const chart = listings.getByRole('region', { name: pipeline.sourceNameFa }).getByRole('figure');
    await chart.getByText('اندازه‌گیری‌های ساعتی به‌صورت جدول').click();
    await expect(chart.getByRole('row').nth(1).getByRole('cell')).toHaveText(['۳۵', '۱', '۳۰ دقیقه']);

    await page.getByRole('link', { name: COPY.window7d }).click();
    await expect(page).toHaveURL('/admin/worker?window=7d');
    await expect(page.getByRole('link', { name: COPY.window7d })).toHaveAttribute('aria-current', 'page');
    // Over seven days the listings first stored three days ago are new too.
    await expectFlow(page, listings, pipeline.modelNameFa, ['۳', '۲', '۳', '۱', '۱', /دقیقه/]);
  });

  test("shows a source's problems with their time and evidence, and links a stopped source to resuming it", async ({
    page,
    pipeline,
  }, testInfo) => {
    await openWorkerScreen(page, testInfo.workerIndex);
    const problems = section(page, 'مشکل‌های منبع').getByRole('article', { name: pipeline.sourceNameFa });
    await expect(problems.getByRole('alert')).toContainText(COPY.stopped);
    // The summary under the window names how many sources are stopped and leads to their problems.
    await expect(page.getByRole('link', { name: 'دیدن مشکل‌ها' })).toHaveAttribute(
      'href',
      '#problems-heading',
    );
    await expect(problems).toContainText(pipeline.refusedUrl);
    await expect(problems.getByRole('listitem').filter({ hasText: pipeline.refusedUrl })).toContainText(
      'ردشده · ۴۰۳',
    );
    await expect(problems.getByRole('listitem').filter({ hasText: pipeline.unreadText })).toContainText(
      'کارکرد',
    );
    await problems.getByRole('link', { name: COPY.resumeOnSources }).click();
    await expect(page).toHaveURL('/admin/sources');
    await expect(page.getByRole('article', { name: pipeline.sourceNameFa })).toContainText(
      'متوقف به دست خزنده',
    );
  });

  test('keeps the screen within a 320 px phone when every string is long Farsi', async ({
    page,
    pipeline,
  }, testInfo) => {
    await openWorkerScreen(page, testInfo.workerIndex);
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(page.getByRole('article', { name: pipeline.sourceNameFa }).first()).toBeVisible();
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

test.describe('anyone but the superadmin', () => {
  // The 404 is what the test asks for; the browser logs it as a failed load.
  test.use({
    ignoreBrowserErrors: [
      [/\[http 404\] GET .*\/admin\/worker$/, /Failed to load resource.*404/],
      { scope: 'test' },
    ],
  });

  test('gets the not-found page', async ({ page }) => {
    const response = await page.goto('/admin/worker');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.notFound);
  });
});
