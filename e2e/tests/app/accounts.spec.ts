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

  test('a taken name, a common password and a short one each say what to do, in Farsi', async ({ page }) => {
    const username = uniqueUsername();
    await signUp(page, username, newPassword());
    await signOut(page);

    await page.goto('/sign-up');
    await fillCredentials(page, username.toUpperCase(), '12345678');
    await page.getByRole('button', { name: COPY.signUp, exact: true }).click();
    const summary = errorSummary(page);
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('این نام کاربری گرفته شده است');
    await expect(summary).toContainText('این رمز بسیار رایج است');
    await expect(page).toHaveTitle(/^خطا: /);
    // The name comes back as it is stored; the password never does.
    await expect(usernameField(page)).toHaveValue(username);
    await expect(passwordField(page)).toHaveValue('');

    await fillCredentials(page, uniqueUsername(), 'kf8#qz');
    await page.getByRole('button', { name: COPY.signUp, exact: true }).click();
    await expect(errorSummary(page)).toContainText('رمز عبور باید حداقل ۸ کاراکتر باشد.');
  });

  test('the username field says whether a name is free while it is typed', async ({ page }) => {
    const taken = uniqueUsername();
    await signUp(page, taken, newPassword());
    await signOut(page);

    await page.goto('/sign-up');
    const field = usernameField(page);
    await field.pressSequentially(taken);
    await expect(page.getByText('این نام کاربری گرفته شده است. نام دیگری انتخاب کنید یا')).toBeVisible();
    await field.fill('');
    await field.pressSequentially(uniqueUsername());
    await expect(page.getByText('این نام کاربری آزاد است.')).toBeVisible();
    await field.fill('');
    await field.pressSequentially('علی');
    await expect(page.getByText('حروف فارسی تایپ شد؛ صفحه‌کلید را انگلیسی کنید.')).toBeVisible();
  });
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
    await signOut(page);
    await context.addCookies(cookies);
    await page.goto('/account');
    await expect(page).toHaveURL('/sign-in?next=%2Faccount');
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

test.describe('superadmin', () => {
  test('the superadmin lands on the dashboard, which the account menu links to', async ({
    page,
    rtl,
    a11y,
  }, testInfo) => {
    const superadmin = superadminFor(testInfo.workerIndex);
    await page.goto('/');
    await page.getByRole('link', { name: COPY.signInLink }).click();
    await signIn(page, superadmin.username, superadmin.password);
    await expect(page).toHaveURL('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.admin);
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
