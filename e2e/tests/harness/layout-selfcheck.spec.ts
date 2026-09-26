import { expect, test } from '../../fixtures/test';
import { inspectLayout, keyboardWalk, slowDown } from '../../gorilla/layout';

// Negative controls for the layout inspector and the keyboard walk used by tests/app/layout-stress.spec.ts:
// break the fixture site on purpose and prove each check notices, and that intentional truncation is not
// flagged. Plus the two network conditions, on the fixture site because it is the page that fetches data.

test.describe('layout checks catch what they are meant to', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('۴ آگهی');
  });

  test('sideways overflow', async ({ page }) => {
    await page.addStyleTag({ content: 'h1 { inline-size: 140vw; }' });
    expect((await inspectLayout(page)).overflowPx).toBeGreaterThan(1);
  });

  test('text cut off by its box', async ({ page }) => {
    await page.addStyleTag({
      content: '.card h2 { inline-size: 40px; block-size: 12px; overflow: hidden; white-space: nowrap; }',
    });
    expect((await inspectLayout(page)).clipped.length).toBeGreaterThan(0);
  });

  test('intentional ellipsis is not a clipping problem', async ({ page }) => {
    await page.addStyleTag({
      content:
        '.card h2 { inline-size: 40px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }',
    });
    expect((await inspectLayout(page)).clipped).toEqual([]);
  });

  test('a control too small to tap', async ({ page }) => {
    await page.addStyleTag({
      content:
        '.saved { min-block-size: 0; block-size: 16px; inline-size: 16px; padding: 0; overflow: hidden; }',
    });
    expect((await inspectLayout(page)).smallTargets.join(' ')).toContain('button#saved');
  });

  test('a hit area that lands beside the control still counts as too small', async ({ page }) => {
    // the physical-centring bug craft.md warns about: in RTL, inset-inline-start: 50% plus a translate puts the
    // 44 px area beside the 24 px button, so the button itself is still too small to tap
    await page.addStyleTag({
      content:
        '.saved { position: relative; min-block-size: 0; block-size: 24px; inline-size: 24px; padding: 0; border: 0; } .saved::after { content: ""; position: absolute; inset-inline-start: 50%; inset-block-start: 50%; inline-size: 44px; block-size: 44px; translate: -50% -50%; }',
    });
    expect((await inspectLayout(page, { minTarget: 44 })).smallTargets.join(' ')).toContain('button#saved');
  });

  test('a small control whose hit area is grown to 44 px is not too small to tap', async ({ page }) => {
    await page.addStyleTag({
      content:
        '.saved { position: relative; min-block-size: 0; block-size: 24px; inline-size: 24px; padding: 0; border: 0; } .saved::after { content: ""; position: absolute; inset: -10px; }',
    });
    expect((await inspectLayout(page, { minTarget: 44 })).smallTargets.join(' ')).not.toContain(
      'button#saved',
    );
  });

  test('a missing focus indicator', async ({ page }) => {
    await page.addStyleTag({
      content: '*:focus-visible { outline: none !important; box-shadow: none !important; }',
    });
    expect((await keyboardWalk(page)).problems.join('\n')).toContain('shows no focus indicator');
  });

  test('a focus trap', async ({ page }) => {
    await page.evaluate(() => {
      const saved = document.querySelector<HTMLElement>('#saved');
      const logo = document.querySelector<HTMLElement>('.logo');
      saved?.addEventListener('keydown', (event) => {
        if (event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault();
          logo?.focus();
        }
      });
    });
    expect((await keyboardWalk(page)).problems.join('\n')).toContain('focus trap');
  });

  test('a control without an accessible name', async ({ page }) => {
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.style.cssText = 'inline-size: 44px; block-size: 44px';
      document.querySelector('main')?.prepend(button);
    });
    expect((await keyboardWalk(page)).problems.join('\n')).toContain('has no accessible name');
  });

  test('the unbroken fixture passes the keyboard walk', async ({ page }) => {
    const walk = await keyboardWalk(page);
    expect(walk.tabbable).toBeGreaterThan(0);
    expect(walk.problems).toEqual([]);
  });
});

test('a slow network shows the loading state and then the content', async ({ page }) => {
  await slowDown(page, 1_500, (url) => url.pathname.startsWith('/api/'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('در حال بارگذاری…');
  await expect(page.getByRole('status')).toHaveText('۴ آگهی', { timeout: 10_000 });
  expect((await inspectLayout(page)).overflowPx).toBeLessThanOrEqual(1);
});

test.describe('when the listings request fails', () => {
  // The failed request is the point of this test, so the shared console guard must not fail it.
  test.use({ failOnBrowserErrors: false });

  test('a message replaces the list and nothing is thrown', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (error) => uncaught.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('بارگذاری آگهی‌ها ناموفق بود.');
    expect(uncaught).toEqual([]);
    expect((await inspectLayout(page)).overflowPx).toBeLessThanOrEqual(1);
  });
});
