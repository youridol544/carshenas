import { expect, test } from '../../fixtures/test';

// Plain-Farsi search on its host page, /design/plain-search (CS-62): a sentence in, the filters it meant as chips the
// buyer removes, the words nobody read said aloud, the model's switch off by default (code alone answers, and says
// so when it needed more). Runs against the real lane database's catalogue; no test reaches a language model.

const SENTENCE = 'پژو ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون';
const OWNER_EXAMPLE = 'یک ماشین تمیز کم کار و بیدردسر میخوام که همه چیش از نظر فنی خوب باشه و تمیز باشه';

async function ask(page: import('@playwright/test').Page, sentence: string) {
  await page.getByRole('searchbox', { name: 'چه ماشینی می‌خواهید؟' }).fill(sentence);
  await page.getByRole('button', { name: 'بفهم' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/design/plain-search');
});

test('a sentence becomes removable chips, and the buyer’s removal changes what is applied', async ({
  page,
}) => {
  await ask(page, SENTENCE);
  await expect(page.getByRole('status').filter({ hasText: 'فهمیدم' })).toBeVisible();
  const chips = page.getByRole('list').getByRole('button', { name: /^برداشتن/ });
  await expect(chips).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'برداشتن «بدون رنگ»' })).toBeVisible();

  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  const full = (await page.getByTestId('applied-href').textContent()) ?? '';
  expect(full).toContain('model=peugeot.206');
  expect(full).toContain('nopaint=1');

  await page.getByRole('button', { name: 'برداشتن «بدون رنگ»' }).click();
  await expect(chips).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'برگرداندن فیلترهای برداشته‌شده' })).toBeVisible();
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  const without = (await page.getByTestId('applied-href').textContent()) ?? '';
  expect(without).toContain('model=peugeot.206');
  expect(without).not.toContain('nopaint=1');

  await page.getByRole('button', { name: 'برگرداندن فیلترهای برداشته‌شده' }).click();
  await expect(chips).toHaveCount(4);
});

test('the owner’s vague request becomes the clean-and-easy filters, each said to be inferred from the words', async ({
  page,
}) => {
  await ask(page, OWNER_EXAMPLE);
  await expect(page.getByRole('heading', { level: 3, name: /این‌ها را هم گذاشتم/ }).first()).toBeVisible();
  // The clean-and-easy filters, each one named: low mileage for its age, a popular model, paint free, no accident, no
  // replaced parts (clean body), and a sound engine, gearbox and chassis (technically sound).
  for (const name of [
    'کم‌کارکرد نسبت به سن',
    'مدل پرطرفدار',
    'بدون رنگ',
    'بدون تصادف',
    'بدون تعویض بدنه',
    'موتور سالم',
    'گیربکس سالم',
    'شاسی سالم و پلمپ',
  ]) {
    await expect(page.getByRole('button', { name: `برداشتن «${name}»` })).toBeVisible();
  }
  // Which words implied them is said, in groups.
  await expect(
    page.getByRole('heading', { level: 3, name: 'برای «از نظر فنی خوب» این‌ها را هم گذاشتم' }),
  ).toBeVisible();
});

test('words nobody could read are said, and one tap searches them as text', async ({ page }) => {
  await ask(page, 'پژو ۲۰۶ خوشگل');
  await expect(page.getByText('این کلمه‌ها را نتوانستم به فیلتر تبدیل کنم')).toBeVisible();
  await expect(page.getByText('خوشگل', { exact: true })).toBeVisible();
  // The model is off by default: the page says so quietly.
  await expect(page.getByText('فهم هوشمند جمله فعلاً خاموش است')).toBeVisible();
  await page.getByRole('button', { name: 'جست‌وجو در متن آگهی‌ها' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'در متن آگهی‌ها هم می‌گردم' })).toBeVisible();
  await page.getByRole('button', { name: 'نمایش آگهی‌ها' }).click();
  await expect(page.getByTestId('applied-href')).toContainText('q=');
});

test('a make the index does not collect is said, not matched to something else', async ({ page }) => {
  await ask(page, 'مزدا ۳');
  await expect(page.getByText(/هنوز در کارشناس جمع‌آوری نمی‌شود/)).toBeVisible();
});

test('nonsense is not dropped: it is offered as a text search', async ({ page }) => {
  await ask(page, 'asdfgh');
  await expect(page.getByRole('button', { name: 'برداشتن «asdfgh»' })).toBeVisible();
  await expect(
    page.getByText('فیلتری از این جمله نساختم؛ آن را در متن آگهی‌ها جست‌وجو می‌کنم.'),
  ).toBeVisible();
});

test.describe('when the request fails', () => {
  // The failure is the point: the browser's own report of it is expected.
  test.use({
    ignoreBrowserErrors: [[/api\/search\/understand/, /Failed to load resource/], { scope: 'test' }],
  });

  test('a failed request keeps the sentence and says what to do', async ({ page }) => {
    await page.route('**/api/search/understand', (route) => route.abort());
    await page.getByRole('searchbox').fill(SENTENCE);
    await page.getByRole('button', { name: 'بفهم' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'همین‌جا مانده' })).toContainText(
      'جمله‌ی شما همین‌جا مانده است',
    );
    await expect(page.getByRole('searchbox')).toHaveValue(SENTENCE);
  });
});

test('floor: right to left, no sideways scroll, accessible, chips are 44 px targets', async ({
  page,
  rtl,
  a11y,
}) => {
  await rtl.expectDocumentRtl();
  await ask(page, OWNER_EXAMPLE);
  await expect(page.getByRole('button', { name: /^برداشتن/ }).first()).toBeVisible();
  await rtl.expectNoHorizontalOverflow();
  await a11y.check();
  for (const chip of await page.getByRole('button', { name: /^برداشتن/ }).all()) {
    const box = await chip.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  }
  await expect(page.getByRole('button', { name: 'بفهم' })).toBeVisible();
});

test('screenshots for the evidence', async ({ page }, testInfo) => {
  await ask(page, OWNER_EXAMPLE);
  await expect(page.getByRole('button', { name: /^برداشتن/ }).first()).toBeVisible();
  await page.screenshot({
    path: `../docs/evidence/query-understanding/2026-10-02/screenshots/${testInfo.project.name}-owner-example.png`,
  });
});
