import type { Page, TestInfo } from '@playwright/test';
import {
  newPassword,
  passwordField,
  signIn,
  superadminFor,
  uniqueUsername,
  usernameField,
} from '../../fixtures/accounts';
import {
  coverageMake,
  coverageModel,
  decideRequest,
  filesForModel,
  pastedFor,
  removeAccounts,
  requestOfModel,
  type Scenario,
} from '../../fixtures/check-coverage';
import { fetchesSince, pasteSeed } from '../../fixtures/paste-link';
import { expect, test } from '../../fixtures/test';
import { inspectLayout, waitForHydration } from '../../gorilla/layout';

// The four answers to a pasted link and the ask to add a model (CS-115, ADR-0046). A link whose ad Carshenas has not read is
// answered by the car in its title: queued when the car is one it reads, outside when it is not (the limit first, the cars it
// reads, one action), unreadable when the link does not say which car; a signed-in buyer asks for the model with one press
// (their file for it and the CS-71 request are made together), a visitor is asked to sign in and comes back to the same
// answer with the request placed, and the answer shows where the request stands and never offers the action twice. Each
// test has a catalogue model of its own (fixtures/check-coverage.ts), made before the app first read the catalogue's names.
// Nothing here opens Divar: every request the page makes is watched, and the crawler's log must not grow.

const COPY = {
  label: 'لینک آگهی دیوار',
  submit: 'ارزیابی',
  outside: (car: string) => `${car} را هنوز نمی‌خوانیم`,
  ask: 'درخواست افزودن این مدل',
  askChosen: 'درخواست افزودن',
  chooser: 'کدام مدل؟',
  chooseFirst: 'مدل را انتخاب کنید.',
  signInTitle: 'برای درخواست وارد شوید',
  signIn: 'ورود',
  signUp: 'ثبت‌نام',
  pending: 'درخواستتان ثبت شد؛ جواب را در اعلان‌ها می‌بینید.',
  declined: 'درخواست این مدل پیش‌تر رد شده است.',
  reason: 'این مدل خارج از بازار تهران است',
  badgePending: 'در انتظار تأیید',
  badgeDeclined: 'رد شد',
  queued: 'این آگهی هنوز خوانده نشده',
  granted: 'این مدل را به درخواست شما به فهرست افزودیم.',
  noTitle: 'عنوان آگهی در این لینک نیست',
  noCar: 'از عنوان این آگهی خودرو را نمی‌شناسیم',
  twoCars: 'عنوان آگهی بیشتر از یک خودرو دارد',
  makeOnly: 'عنوان آگهی فقط پراید را نام برده',
  coveredLead: 'فقط آگهی این خودروها را می‌خوانیم و ارزیابی می‌کنیم',
  pastedLinks: 'لینک چسبانده‌شده',
} as const;

const SHOTS = process.env.CS115_SHOTS;

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (SHOTS === undefined || SHOTS === '') return;
  await page.screenshot({ path: `${SHOTS}/${name}-${testInfo.project.name}.png`, fullPage: false });
}

/** A token Divar could have written, of this test's own: the wanted links and the counts are never shared. */
const token = () => `cv${Math.random().toString(36).slice(2, 10)}`;
const linkOf = (slug: string, code = token()) => `https://divar.ir/v/${encodeURIComponent(slug)}/${code}`;
const pathOf = (link: string) => `/check?link=${encodeURIComponent(link)}`;

/** Every request to Divar itself (not its photo host, which the fixtures answer) fails the test. */
function watchDivar(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    const { hostname } = new URL(request.url());
    if (hostname === 'divar.ir' || hostname.endsWith('.divar.ir')) requests.push(request.url());
  });
  return requests;
}

async function openAnswer(page: Page, link: string): Promise<void> {
  await page.goto(pathOf(link));
  await expect(page.locator('[data-check-answer]')).toBeVisible();
  await waitForHydration(page);
}

const askButton = (page: Page) => page.getByRole('button', { name: COPY.ask, exact: true });
const placed = (page: Page) => page.locator('[data-ask-state]');

async function signUpHere(page: Page, username: string, password: string): Promise<void> {
  await waitForHydration(page);
  await usernameField(page).fill(username);
  await passwordField(page).fill(password);
  await page.getByRole('button', { name: COPY.signUp, exact: true }).click();
}

test.describe('the answer for a car Carshenas reads', () => {
  test('a link whose title names a car Carshenas reads is queued: it says what happens, never promises a time, and fetches nothing', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const divar = watchDivar(page);
    const started = new Date();
    const paste = pasteSeed();
    const before = await pastedFor(paste.modelId);
    await openAnswer(page, linkOf('پژو-۲۰۶-تیپ-۵-مدل-۱۳۹۸'));
    const answer = page.locator('[data-answer-kind="queued"]');
    await expect(answer).toBeVisible();
    await expect(answer.getByRole('heading', { name: COPY.queued })).toBeVisible();
    await expect(answer).toContainText('پژو ۲۰۶');
    // What happens: read in its turn, or, while nothing is being read, that reading is paused: never a promised time.
    await expect(answer).toContainText(/بعد از آن همین لینک را دوباره بچسبانید/);
    // The link to all of the model's ads is there once: the deals end with it and the card does not repeat it.
    const allOf = page.getByRole('link', { name: /دیدن همه‌ی آگهی‌های پژو ۲۰۶/ });
    await expect(allOf).toHaveCount(1);
    await expect(allOf).toHaveAttribute('href', /\/search\?.*model/);
    await expect(answer.locator('[data-price]')).toHaveCount(0);
    // A link for a car nobody asked about: no action to offer, the car is read.
    await expect(askButton(page)).toHaveCount(0);
    expect(await pastedFor(paste.modelId)).toBeGreaterThanOrEqual(before + 1);
    await a11y.check();
    await rtl.expectNoHorizontalOverflow();
    await shot(page, testInfo, 'queued');
    expect(divar, 'requests to Divar').toEqual([]);
    expect(await fetchesSince(started), 'rows the crawler logged').toBe(0);
  });
});

test.describe('the answer for a car outside the coverage', () => {
  const scenario: Scenario = 'view';

  test('the limit is stated first, with the cars that are read and one action, and nothing is fetched', async ({
    page,
    a11y,
    rtl,
  }, testInfo) => {
    const divar = watchDivar(page);
    const started = new Date();
    const car = coverageModel(testInfo.project.name, scenario);
    const before = await pastedFor(car.modelId);
    await openAnswer(page, linkOf(car.slug));
    const answer = page.locator('[data-answer-kind="outside"]');
    const heading = answer.getByRole('heading', { name: COPY.outside(car.nameFa) });
    await expect(heading).toBeVisible();
    const covered = answer.locator('[data-covered-cars]');
    await expect(covered).toContainText(COPY.coveredLead);
    await expect(covered.getByRole('link', { name: 'پژو ۲۰۶', exact: true })).toHaveAttribute(
      'href',
      '/models/peugeot/206',
    );
    await expect(askButton(page)).toBeVisible();
    // The limit comes first: the heading, then the cars, then the one action.
    const [headingBox, coveredBox, buttonBox] = await Promise.all([
      heading.boundingBox(),
      covered.boundingBox(),
      askButton(page).boundingBox(),
    ]);
    expect(headingBox?.y ?? 0).toBeLessThan(coveredBox?.y ?? 0);
    expect(coveredBox?.y ?? 0).toBeLessThan(buttonBox?.y ?? 0);
    // Nothing in the answer says or suggests that the link did not work.
    await expect(answer).not.toContainText(/نشد|خطا|مشکل|متأسف/);
    expect(await pastedFor(car.modelId)).toBeGreaterThanOrEqual(before + 1);
    expect(await requestOfModel(car.modelId)).toBeNull();
    await a11y.check();
    await rtl.expectNoHorizontalOverflow();
    await shot(page, testInfo, 'outside');
    expect(divar, 'requests to Divar').toEqual([]);
    expect(await fetchesSince(started), 'rows the crawler logged').toBe(0);
  });

  test('asked for from the box, an answer that fits the screen is shown whole, its action included, and its heading has focus', async ({
    page,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, scenario);
    await page.goto('/check');
    await waitForHydration(page);
    await page.getByRole('textbox', { name: COPY.label }).fill(linkOf(car.slug));
    await page.getByRole('button', { name: COPY.submit, exact: true }).click();
    const answer = page.locator('[data-answer-kind="outside"]');
    const heading = answer.getByRole('heading', { name: COPY.outside(car.nameFa) });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    // On a phone the answer starts below the box: it is brought into view until its end, where the one action is.
    await expect(answer).toBeInViewport({ ratio: 1 });
    await expect(askButton(page)).toBeInViewport({ ratio: 1 });
    await shot(page, testInfo, 'outside-from-box');
  });

  test('a visitor who presses the action is asked to sign in, and no request is made', async ({
    page,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, scenario);
    await openAnswer(page, linkOf(car.slug));
    await askButton(page).click();
    const panel = page.locator('[data-ask-sign-in]');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: COPY.signInTitle })).toBeFocused();
    await expect(panel).toBeInViewport({ ratio: 1 });
    await expect(panel.getByRole('link', { name: COPY.signIn, exact: true })).toHaveAttribute(
      'href',
      /\/sign-in\?next=/,
    );
    await expect(panel.getByRole('link', { name: COPY.signUp, exact: true })).toHaveAttribute(
      'href',
      /\/sign-up\?next=/,
    );
    await shot(page, testInfo, 'outside-sign-in');
    expect(await requestOfModel(car.modelId)).toBeNull();
  });
});

test.describe('asking to add the model', () => {
  test('a signed-in buyer asks with one press: the request and their file are made, the answer shows it and never offers the action twice', async ({
    page,
    a11y,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, 'signedin');
    const divar = watchDivar(page);
    const started = new Date();
    const buyer = uniqueUsername('ask');
    const link = linkOf(car.slug);
    try {
      await page.goto('/sign-up');
      await signUpHere(page, buyer, newPassword());
      await expect(page.getByRole('button', { name: 'منوی حساب کاربری' })).toBeVisible();
      await openAnswer(page, link);
      await askButton(page).click();
      await expect(placed(page)).toHaveAttribute('data-ask-state', 'pending');
      await expect(placed(page)).toContainText(COPY.pending);
      await expect(placed(page).getByText(COPY.badgePending, { exact: true })).toBeVisible();
      // The pressed button is gone: focus is where the request now stands, in view.
      await expect(placed(page)).toBeFocused();
      await expect(placed(page)).toBeInViewport({ ratio: 1 });
      await expect(askButton(page)).toHaveCount(0);
      expect(await requestOfModel(car.modelId)).toMatchObject({ state: 'pending', files: 1, buyers: 1 });
      const [file] = await filesForModel(buyer, car.key);
      expect(file?.name).toBe(car.nameFa);
      await a11y.check();
      await shot(page, testInfo, 'outside-asked');
      // Back to the answer later: it still says so, and still offers nothing; the file is one tap away.
      await page.reload();
      await expect(placed(page)).toContainText(COPY.pending);
      await expect(askButton(page)).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'دیدن پرونده' })).toHaveAttribute(
        'href',
        `/account/searches/${String(file?.id)}`,
      );
      expect(await filesForModel(buyer, car.key)).toHaveLength(1);
      expect(divar, 'requests to Divar').toEqual([]);
      expect(await fetchesSince(started), 'rows the crawler logged').toBe(0);
    } finally {
      await removeAccounts([buyer]);
    }
  });

  test('a visitor signs up from the answer and comes back to the same answer with the request placed', async ({
    page,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, 'visitor');
    const buyer = uniqueUsername('back');
    const link = linkOf(car.slug);
    try {
      await openAnswer(page, link);
      await askButton(page).click();
      await page.locator('[data-ask-sign-in]').getByRole('link', { name: COPY.signUp, exact: true }).click();
      await expect(page).toHaveURL(/\/sign-up\?next=/);
      await signUpHere(page, buyer, newPassword());
      // The same answer, signed in: the press made before is placed once.
      await expect(page).toHaveURL(/\/check\?link=/);
      await expect(page.locator('[data-answer-kind="outside"]')).toBeVisible();
      await expect(placed(page)).toHaveAttribute('data-ask-state', 'pending');
      await expect(askButton(page)).toHaveCount(0);
      // Back from signing in, the buyer is shown where the request stands, not left to look for it.
      await expect(placed(page)).toBeFocused();
      await expect(placed(page)).toBeInViewport({ ratio: 1 });
      expect(await requestOfModel(car.modelId)).toMatchObject({ state: 'pending', files: 1, buyers: 1 });
      await shot(page, testInfo, 'outside-returned');
    } finally {
      await removeAccounts([buyer]);
    }
  });

  test('a declined request shows its reason and is never offered again, to the buyer or to anyone', async ({
    page,
    context,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, 'declined');
    const buyer = uniqueUsername('no');
    const link = linkOf(car.slug);
    try {
      await page.goto('/sign-up');
      await signUpHere(page, buyer, newPassword());
      await expect(page.getByRole('button', { name: 'منوی حساب کاربری' })).toBeVisible();
      await openAnswer(page, link);
      await askButton(page).click();
      await expect(placed(page)).toHaveAttribute('data-ask-state', 'pending');
      const request = await requestOfModel(car.modelId);
      await decideRequest(request?.id ?? 0, 'declined', COPY.reason);
      await page.reload();
      await expect(placed(page)).toHaveAttribute('data-ask-state', 'declined');
      await expect(placed(page)).toContainText(COPY.declined);
      await expect(placed(page)).toContainText(COPY.reason);
      await expect(placed(page).getByText(COPY.badgeDeclined, { exact: true })).toBeVisible();
      await expect(askButton(page)).toHaveCount(0);
      await shot(page, testInfo, 'outside-declined');
      // A visitor sees the same: the model was asked for and declined, so there is no action.
      const visitor = await context.browser()?.newContext({ locale: 'fa-IR' });
      const other = await visitor?.newPage();
      if (other === undefined) throw new Error('no second page');
      await other.goto(`${new URL(page.url()).origin}${pathOf(link)}`);
      await expect(other.locator('[data-ask-state="declined"]')).toContainText(COPY.reason);
      await expect(askButton(other)).toHaveCount(0);
      await visitor?.close();
    } finally {
      await removeAccounts([buyer]);
    }
  });

  test('an approved request makes the car one Carshenas reads: the answer becomes queued and says why', async ({
    page,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, 'approved');
    const buyer = uniqueUsername('yes');
    const link = linkOf(car.slug);
    try {
      await page.goto('/sign-up');
      await signUpHere(page, buyer, newPassword());
      await expect(page.getByRole('button', { name: 'منوی حساب کاربری' })).toBeVisible();
      await openAnswer(page, link);
      await askButton(page).click();
      await expect(placed(page)).toHaveAttribute('data-ask-state', 'pending');
      const request = await requestOfModel(car.modelId);
      await decideRequest(request?.id ?? 0, 'approved', null);
      await page.reload();
      const answer = page.locator('[data-answer-kind="queued"]');
      await expect(answer.getByRole('heading', { name: COPY.queued })).toBeVisible();
      await expect(answer).toContainText(COPY.granted);
      await expect(askButton(page)).toHaveCount(0);
      await shot(page, testInfo, 'queued-granted');
    } finally {
      await removeAccounts([buyer]);
    }
  });

  test('when only the make is told the buyer picks the model among its models, and the request is for that model', async ({
    page,
    a11y,
  }, testInfo) => {
    const make = coverageMake(testInfo.project.name);
    const buyer = uniqueUsername('pick');
    const [first] = make.models;
    if (first === undefined) throw new Error('the make has models');
    try {
      await page.goto('/sign-up');
      await signUpHere(page, buyer, newPassword());
      await expect(page.getByRole('button', { name: 'منوی حساب کاربری' })).toBeVisible();
      await openAnswer(page, linkOf(make.slug));
      const answer = page.locator('[data-answer-kind="outside"]');
      await expect(answer.getByRole('heading', { name: COPY.outside(make.nameFa) })).toBeVisible();
      const chooser = page.getByRole('combobox', { name: COPY.chooser });
      await expect(chooser).toBeVisible();
      await expect(chooser.locator('option')).toHaveCount(make.models.length + 1);
      // Nothing chosen: the press says so and moves to the choice; no request is made.
      await page.getByRole('button', { name: COPY.askChosen, exact: true }).click();
      await expect(page.getByText(COPY.chooseFirst)).toBeVisible();
      await expect(chooser).toBeFocused();
      expect(await requestOfModel(first.modelId)).toBeNull();
      await a11y.check();
      await shot(page, testInfo, 'outside-chooser');
      await chooser.selectOption(first.key);
      await page.getByRole('button', { name: COPY.askChosen, exact: true }).click();
      await expect(placed(page)).toHaveAttribute('data-ask-state', 'pending');
      expect(await requestOfModel(first.modelId)).toMatchObject({ state: 'pending', files: 1, buyers: 1 });
      const second = make.models[1];
      expect(second === undefined ? null : await requestOfModel(second.modelId)).toBeNull();
      // The model asked for is shown with its state and is no longer in the list; the other is still to choose.
      await page.reload();
      await expect(placed(page)).toContainText(first.name);
      await expect(chooser.locator('option')).toHaveCount(make.models.length);
      await expect(chooser.locator(`option[value="${first.key}"]`)).toHaveCount(0);
    } finally {
      await removeAccounts([buyer]);
    }
  });
});

test.describe('a link that does not say which car is never called unsupported', () => {
  test('a short link, a title with no car, a title with two, and a make some of whose models are read', async ({
    page,
    a11y,
  }, testInfo) => {
    const cases: readonly [string | null, string][] = [
      [null, COPY.noTitle],
      ['فروش-فوری-خودرو', COPY.noCar],
      ['پژو-۲۰۶-و-پژو-۴۰۵', COPY.twoCars],
      ['پراید-مدل-۹۵', COPY.makeOnly],
    ];
    for (const [slug, heading] of cases) {
      const code = token();
      await openAnswer(page, slug === null ? `https://divar.ir/v/${code}` : linkOf(slug, code));
      const answer = page.locator('[data-answer-kind="unreadable"]');
      await expect(answer.getByRole('heading', { name: heading })).toBeVisible();
      await expect(askButton(page)).toHaveCount(0);
      await expect(answer).not.toContainText(/پشتیبانی|نمی‌خوانیم/);
      await a11y.check();
      await shot(page, testInfo, `unreadable-${String(cases.findIndex(([s]) => s === slug))}`);
    }
    await expect(page.locator('[data-covered-cars]').getByRole('link', { name: 'پراید ۱۳۱' })).toBeVisible();
  });
});

test.describe('the superadmin sees the demand', () => {
  test('a model buyers paste links for and ask about is counted, with the buyers and the links', async ({
    page,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, 'admin');
    const buyer = uniqueUsername('adm');
    const link = linkOf(car.slug);
    try {
      await openAnswer(page, link);
      await openAnswer(page, linkOf(car.slug));
      await page.goto('/sign-up');
      await signUpHere(page, buyer, newPassword());
      await expect(page.getByRole('button', { name: 'منوی حساب کاربری' })).toBeVisible();
      await openAnswer(page, link);
      await askButton(page).click();
      await expect(placed(page)).toHaveAttribute('data-ask-state', 'pending');
      // The superadmin, in a context of their own.
      const admin = superadminFor(testInfo.workerIndex);
      const context = await page
        .context()
        .browser()
        ?.newContext({ locale: 'fa-IR', baseURL: testInfo.project.use.baseURL });
      const adminPage = await context?.newPage();
      if (adminPage === undefined) throw new Error('no admin page');
      await adminPage.goto('/sign-in');
      await signIn(adminPage, admin.username, admin.password);
      await expect(adminPage).toHaveURL(/\/admin$/);
      await adminPage.goto('/admin/crawl-requests');
      const row = adminPage.locator(`[data-demand-model="${String(car.modelId)}"]`);
      await expect(row).toBeVisible();
      await expect(row).toContainText(COPY.pastedLinks);
      await expect(row).toContainText('خریدار');
      const card = adminPage.locator(`[data-crawl-request]`).filter({ hasText: car.nameFa });
      await expect(card).toContainText(COPY.pastedLinks);
      await shot(adminPage, testInfo, 'admin-demand');
      await context?.close();
    } finally {
      await removeAccounts([buyer]);
    }
  });
});

test.describe('layout', () => {
  test('keeps its layout, with no control under 44 px and nothing clipped, in every state', async ({
    page,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, 'layout');
    const make = coverageMake(testInfo.project.name);
    const states: readonly string[] = [
      pathOf(linkOf('پژو-۲۰۶-تیپ-۵')),
      pathOf(linkOf(car.slug)),
      pathOf(linkOf(make.slug)),
      pathOf(linkOf('فروش-فوری-خودرو')),
      pathOf(`https://divar.ir/v/${token()}`),
      pathOf('https://example.com/x'),
      '/check',
    ];
    for (const path of states) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await waitForHydration(page);
      const report = await inspectLayout(page, { minTarget: 44 });
      expect(report.overflowPx, path).toBeLessThanOrEqual(1);
      expect(report.clipped, path).toEqual([]);
      expect(report.smallTargets, path).toEqual([]);
      expect(report.brokenNumbers, path).toEqual([]);
    }
  });
});

test.describe('the other boxes keep the title of a link', () => {
  test('a long link pasted in the search page box is read by its car, not only by its code', async ({
    page,
  }, testInfo) => {
    const car = coverageModel(testInfo.project.name, 'view');
    await page.goto('/search');
    await waitForHydration(page);
    const field = page.getByRole('searchbox', { name: 'جست‌وجو در آگهی‌ها' });
    await field.focus();
    await field.evaluate((input, value) => {
      const data = new DataTransfer();
      data.setData('text', value);
      input.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, linkOf(car.slug));
    await expect(page).toHaveURL(/\/check\?link=/);
    await expect(
      page.locator('[data-answer-kind="outside"]').getByRole('heading', { name: COPY.outside(car.nameFa) }),
    ).toBeVisible();
  });
});
