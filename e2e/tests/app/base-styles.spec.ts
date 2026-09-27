import { expect, test } from '../../fixtures/test';

// globals.css makes one app-wide cursor choice (owner decision, 2026-09-26): the hand on enabled buttons, the arrow
// on disabled and aria-disabled ones. No page has buttons yet, so the test adds a set to the home page, which loads
// the app's own stylesheet.

test('enabled buttons show the hand cursor and disabled ones the arrow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').evaluate((main) => {
    main.insertAdjacentHTML(
      'beforeend',
      `<button type="button">جست‌وجو</button>
       <input type="submit" value="ارسال">
       <div role="button" tabindex="0">نشان کردن</div>
       <button type="button" aria-disabled="true">ذخیره</button>
       <button type="button" disabled>حذف</button>
       <div role="button" aria-disabled="true">مقایسه</div>`,
    );
  });
  for (const name of ['جست‌وجو', 'ارسال', 'نشان کردن']) {
    await expect(page.getByRole('button', { name })).toHaveCSS('cursor', 'pointer');
  }
  for (const name of ['ذخیره', 'حذف', 'مقایسه']) {
    await expect(page.getByRole('button', { name })).toHaveCSS('cursor', 'default');
  }
});
