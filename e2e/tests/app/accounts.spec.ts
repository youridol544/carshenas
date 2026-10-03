import {
  COPY,
  errorSummary,
  fillCredentials,
  newPassword,
  passwordField,
  signIn,
  signOut,
  signUp,
  superadminFor,
  uniqueUsername,
  usernameField,
} from '../../fixtures/accounts';
import { expect, test } from '../../fixtures/test';

// Accounts (CS-39, ADR-0020): signing up, in and out with a username and a password, in Farsi and right to left, and
// the superadmin's way to the dashboard. Each test makes its own accounts, so they run in any order and in parallel.

test.describe('sign-up', () => {
  test('a visitor finds sign-up from the header, signs up and is signed in', async ({ page, rtl, a11y }) => {
    await page.goto('/');
    await page.getByRole('link', { name: COPY.signInLink }).click();
    await expect(page).toHaveURL('/sign-in');
    await page.getByRole('link', { name: 'ثبت‌نام کنید' }).click();
    await expect(page).toHaveURL('/sign-up');
    await expect(page).toHaveTitle('ثبت‌نام | کارشناس');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ثبت‌نام در کارشناس');
    await rtl.expectDocumentRtl();
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();

    const username = uniqueUsername();
    await fillCredentials(page, username, newPassword());
    await page.getByRole('button', { name: COPY.signUp, exact: true }).click();
    await expect(page).toHaveURL('/');
    await page.getByRole('button', { name: COPY.menu }).click();
    await expect(page.getByRole('menu')).toContainText(username);
    await expect(page.getByRole('menuitem', { name: COPY.admin })).toHaveCount(0);
  });

  test('a taken name, a common password and a short one each say what to do, in Farsi', async ({
    page,
    a11y,
  }) => {
    const username = uniqueUsername();
    await signUp(page, username, newPassword());
    await signOut(page);

    await page.goto('/sign-up');
    await fillCredentials(page, username.toUpperCase(), '12345678');
    await page.getByRole('button', { name: COPY.signUp, exact: true }).click();
    const summary = errorSummary(page);
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('این نام کاربری گرفته شده است. نام دیگری انتخاب کنید یا وارد شوید.');
    await expect(summary).toContainText('این رمز بسیار رایج است');
    await expect(page).toHaveTitle(/^خطا: /);
    await a11y.check();
    // The name comes back as it is stored; the password never does.
    await expect(usernameField(page)).toHaveValue(username);
    await expect(passwordField(page)).toHaveValue('');

    await fillCredentials(page, uniqueUsername(), 'kf8#qz');
    await page.getByRole('button', { name: COPY.signUp, exact: true }).click();
    await expect(errorSummary(page)).toContainText('رمز عبور باید حداقل ۸ کاراکتر باشد.');
  });

  test('after a failed sign-up, the name keeps its error on every key until it is fixed', async ({
    page,
  }) => {
    await page.goto('/sign-up');
    await fillCredentials(page, 'ab', newPassword());
    await page.getByRole('button', { name: COPY.signUp, exact: true }).click();
    await expect(errorSummary(page)).toContainText('نام کاربری باید حداقل ۳ کاراکتر باشد.');
    const field = usernameField(page);
    await field.fill('a');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/نام کاربری باید حداقل ۳\sکاراکتر باشد\./);
    await field.fill(uniqueUsername());
    await expect(field).not.toHaveAttribute('aria-invalid');
  });
});

// A message under a field keeps to the one line kept for it, so nothing below it moves while a person types (the
// design review of 2026-09-29 measured «ثبت‌نام» moving 22 px when a name was taken). The narrowest phone is the test;
// on the desktop project its scrollbar leaves 273 px of the 288.
test.describe('on a 320 px phone', () => {
  test.use({ viewport: { width: 320, height: 800 } });

  test('what the fields say while they are typed never moves the button', async ({ page }) => {
    const taken = uniqueUsername();
    await signUp(page, taken, newPassword());
    await signOut(page);

    await page.goto('/sign-up');
    const button = page.getByRole('button', { name: COPY.signUp, exact: true });
    const buttonTop = async () => (await button.boundingBox())?.y;
    const top = await buttonTop();
    expect(top).toBeDefined();
    const field = usernameField(page);
    const password = passwordField(page);

    // Typed, then left for the next field: the check after leaving, then again on every key.
    const typedNames: [string, string][] = [
      ['ab', 'نام کاربری باید حداقل ۳ کاراکتر باشد.'],
      ['a!b', 'فقط حرف انگلیسی، عدد و _ بنویسید.'],
      ['1abc', 'نام کاربری باید با حرف انگلیسی شروع شود.'],
      ['a'.repeat(31), 'نام کاربری باید حداکثر ۳۰ کاراکتر باشد.'],
      ['علی', 'نام کاربری را با حروف انگلیسی بنویسید.'],
      [taken, 'گرفته شده؛ نام دیگری بنویسید یا وارد شوید.'],
      [uniqueUsername(), 'این نام کاربری آزاد است.'],
    ];
    for (const [typed, message] of typedNames) {
      await field.fill(typed);
      await field.blur();
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      expect(await buttonTop()).toBe(top);
    }

    // While a name is typed in Persian, before the field is left, it is a hint about the keyboard.
    await page.goto('/sign-up');
    await usernameField(page).pressSequentially('علی');
    await expect(page.getByText('صفحه‌کلید فارسی است؛ آن را انگلیسی کنید.', { exact: true })).toBeVisible();
    expect(await buttonTop()).toBe(top);

    // A check the server could not answer.
    await page.route('**/api/accounts/username-availability', (route) =>
      route.fulfill({ json: { status: 'throttled' } }),
    );
    await usernameField(page).fill(uniqueUsername());
    await expect(page.getByText('آزاد بودن نام هنگام ثبت‌نام بررسی می‌شود.', { exact: true })).toBeVisible();
    expect(await buttonTop()).toBe(top);

    await password.pressSequentially('علی');
    await expect(page.getByText('فارسی تایپ شد؛ صفحه‌کلید را بررسی کنید.', { exact: true })).toBeVisible();
    expect(await buttonTop()).toBe(top);
    await password.fill('abc');
    await expect(page.getByText('۵ کاراکتر دیگر', { exact: true })).toBeVisible();
    expect(await buttonTop()).toBe(top);
  });

  test('the longest name wraps in the account menu and on the account page', async ({ page, rtl }) => {
    const username = uniqueUsername('m'.repeat(19));
    expect(username).toHaveLength(30);
    await signUp(page, username, newPassword());
    await page.getByRole('button', { name: COPY.menu }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toContainText(username);
    const box = await menu.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
    await page.keyboard.press('Escape');

    await page.goto('/account');
    await expect(page.getByRole('main')).toContainText(username);
    await rtl.expectNoHorizontalOverflow();
  });
});

test('the account menu works from the keyboard and shows where focus is', async ({ page }) => {
  await signUp(page, uniqueUsername(), newPassword());
  await page.goto('/');
  const trigger = page.getByRole('button', { name: COPY.menu });
  // Focused directly: WebKit's Tab skips links by default, so the number of presses differs between browsers.
  await trigger.focus();
  await page.keyboard.press('Enter');
  const account = page.getByRole('menuitem', { name: COPY.account });
  await expect(account).toBeFocused();
  // The ring, not only the faint highlight (1.16:1 on white): the design review of 2026-09-29.
  await expect(account).toHaveCSS('outline-style', 'solid');
  await expect(account).toHaveCSS('outline-width', '2px');
  // The inbox (CS-68) sits between the account and signing out.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: COPY.notifications })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const signOutItem = page.getByRole('menuitem', { name: COPY.signOut });
  await expect(signOutItem).toBeFocused();
  await expect(signOutItem).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test.describe('sign-in', () => {
  test('a visitor sent to sign in comes back to the page they asked for', async ({ page, rtl, a11y }) => {
    const username = uniqueUsername();
    const password = newPassword();
    await signUp(page, username, password);
    await signOut(page);

    await page.goto('/account');
    await expect(page).toHaveURL('/sign-in?next=%2Faccount');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ورود به کارشناس');
    await rtl.expectDocumentRtl();
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();

    await signIn(page, username, password);
    await expect(page).toHaveURL('/account');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.account);
    await expect(page.getByRole('main')).toContainText(username);
    await rtl.expectPersianDigits(page.getByRole('definition').last());
    await a11y.check();
  });

  test('a wrong password and an unknown name get the same answer, which names neither', async ({ page }) => {
    const username = uniqueUsername();
    await signUp(page, username, newPassword());
    await signOut(page);

    await page.goto('/sign-in');
    await signIn(page, username, 'not the password at all');
    const summary = errorSummary(page);
    await expect(summary).toContainText(COPY.wrong);
    await expect(summary).toBeFocused();

    await signIn(page, uniqueUsername(), 'not the password at all');
    await expect(errorSummary(page)).toHaveText(`${COPY.summary}${COPY.wrong}`);
  });

  test('failed attempts in a row add help, then make the name wait', async ({ page }) => {
    const username = uniqueUsername();
    await page.goto('/sign-in');
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await signIn(page, username, `wrong guess ${String(attempt)}`);
      // Every answer empties the password field; the summary alone reads the same from the third answer on.
      await expect(passwordField(page)).toHaveValue('');
      await expect(errorSummary(page)).toContainText(COPY.wrong);
    }
    await expect(page.getByText('Caps Lock', { exact: true })).toBeVisible();
    await signIn(page, username, 'wrong guess 6');
    await expect(errorSummary(page)).toContainText('چند بار پشت سر هم ورود ناموفق بود.');
  });

  test('signing out ends the session, and its cookie no longer signs anyone in', async ({
    page,
    context,
  }) => {
    await signUp(page, uniqueUsername(), newPassword());
    const cookies = await context.cookies();
    // Over plain http to a loopback host the cookie is `session` without Secure; over https it is `__Host-session`
    // with Secure (request-origin.test.ts). A buyer's session ends 30 days after sign-in, never later.
    const session = cookies.find((cookie) => cookie.name === 'session');
    expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax', secure: false, path: '/' });
    const days = ((session?.expires ?? 0) * 1_000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    await signOut(page);
    await context.addCookies(cookies);
    await page.goto('/account');
    await expect(page).toHaveURL('/sign-in?next=%2Faccount');
  });

  test('an answer belongs to its visit: coming back, by a link or by the back button, shows an empty form', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: COPY.signInLink }).click();
    await page.getByRole('button', { name: COPY.signIn, exact: true }).click();
    await expect(errorSummary(page)).toBeFocused();
    await passwordField(page).fill('typed and left behind');

    await page.getByRole('link', { name: 'کارشناس' }).click();
    await expect(page).toHaveURL('/');
    await page.getByRole('link', { name: COPY.signInLink }).click();
    await expect(page).toHaveURL('/sign-in');
    await expect(page).toHaveTitle('ورود | کارشناس');
    await expect(page.getByRole('heading', { name: COPY.summary })).toHaveCount(0);
    await expect(usernameField(page)).toHaveValue('');
    await expect(passwordField(page)).toHaveValue('');

    await page.getByRole('button', { name: COPY.signIn, exact: true }).click();
    await expect(errorSummary(page)).toBeFocused();
    await page.getByRole('link', { name: 'ثبت‌نام کنید' }).click();
    await expect(page).toHaveURL('/sign-up');
    await page.goBack();
    await expect(page).toHaveURL('/sign-in');
    await expect(page.getByRole('heading', { name: COPY.summary })).toHaveCount(0);
  });

  test('the password can be shown and hidden', async ({ page }) => {
    await page.goto('/sign-in');
    const password = passwordField(page);
    await password.fill('blue tiger rice');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'نمایش رمز عبور' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'پنهان کردن رمز عبور' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });
});

test('the account page shows the username and signs out with its own button', async ({ page }) => {
  const username = uniqueUsername();
  await signUp(page, username, newPassword());
  await page.goto('/account');
  await expect(page.getByRole('main')).toContainText(username);
  await page.getByRole('main').getByRole('button', { name: COPY.signOut }).click();
  // The account page needs an account, so signing out there goes home.
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: COPY.signInLink })).toBeVisible();
  await page.goto('/account');
  await expect(page).toHaveURL('/sign-in?next=%2Faccount');
});

test.describe('superadmin', () => {
  test('the superadmin lands on the dashboard, which the account menu links to', async ({
    page,
    context,
    rtl,
    a11y,
  }, testInfo) => {
    const superadmin = superadminFor(testInfo.workerIndex);
    await page.goto('/');
    await page.getByRole('link', { name: COPY.signInLink }).click();
    await signIn(page, superadmin.username, superadmin.password);
    await expect(page).toHaveURL('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.admin);
    // The superadmin's session ends 12 hours after sign-in.
    const session = (await context.cookies()).find((cookie) => cookie.name === 'session');
    const hours = ((session?.expires ?? 0) * 1_000 - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThanOrEqual(12);
    await rtl.expectDocumentRtl();
    await rtl.expectNoHorizontalOverflow();
    await a11y.check();

    await page.getByRole('link', { name: 'کارشناس' }).click();
    await expect(page).toHaveURL('/');
    await page.getByRole('button', { name: COPY.menu }).click();
    await page.getByRole('menuitem', { name: COPY.admin }).click();
    await expect(page).toHaveURL('/admin');
  });
});

// Found by the gorilla (seed 20260921, phone): Tab onto the brand, tap «ورود / ثبت‌نام», and the header that held
// focus belonged to the page left behind, so focus fell back to the document.
test("focus that disappears with the page left behind lands on the new page's main content", async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('banner').getByRole('link', { name: 'کارشناس', exact: true })).toBeFocused();
  await page.getByRole('link', { name: COPY.signInLink }).click();
  await expect(page).toHaveURL('/sign-in');
  await expect(page.getByRole('main')).toBeFocused();
});

test('a return path that resolves to another site is never followed', async ({ page }) => {
  // The task review of 2026-09-29: «/..//evil.example» resolves to «//evil.example», which a browser reads as a site.
  await signUp(page, uniqueUsername(), newPassword());
  await page.goto('/sign-in?next=%2F..%2F%2Fevil.example');
  await expect(page).toHaveURL('/');
});

test('pages that need an account answer a visitor with a real redirect or a real 404', async ({
  request,
}) => {
  // Raw requests, not page.goto: a production build that streamed first would redirect on the client with a 200.
  const account = await request.get('/account', { maxRedirects: 0 });
  expect(account.status()).toBe(307);
  expect(account.headers().location).toBe('/sign-in?next=%2Faccount');
  const admin = await request.get('/admin', { maxRedirects: 0 });
  expect(admin.status()).toBe(404);
});

test.describe('the dashboard for everyone else', () => {
  test.use({
    ignoreBrowserErrors: [[/\[http 404\] GET .*\/admin$/, /Failed to load resource.*404/], { scope: 'test' }],
  });

  test('answers 404 to a visitor and to a buyer', async ({ page }) => {
    const visitor = await page.goto('/admin');
    expect(visitor?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('این صفحه پیدا نشد');

    await signUp(page, uniqueUsername(), newPassword());
    const buyer = await page.goto('/admin');
    expect(buyer?.status()).toBe(404);
  });
});
