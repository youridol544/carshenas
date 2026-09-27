import { writeFile } from 'node:fs/promises';
import { AxeBuilder } from '@axe-core/playwright';
import { test as base, expect, type Locator } from '@playwright/test';

/**
 * Project-wide test fixtures. Import `test` and `expect` from here, never from '@playwright/test'.
 *
 * - browserLog (automatic): console errors, uncaught page errors and failed requests are attached to
 *   the report and fail the test, so a green run also means a quiet console.
 * - a11y.check(): axe scan against WCAG 2.x A/AA.
 * - rtl.*: assertions every Farsi right-to-left screen must satisfy.
 */

type BrowserLog = { errors: string[]; warnings: string[]; failedRequests: string[] };

type A11yOptions = { include?: string; exclude?: string[]; disableRules?: string[] };

type Options = {
  /** Fail a test when the page logs errors or requests fail. Default true. */
  failOnBrowserErrors: boolean;
  /** Lines matching any of these patterns are attached but do not fail the test. */
  ignoreBrowserErrors: RegExp[];
};

type Helpers = {
  browserLog: BrowserLog;
  a11y: { check(options?: A11yOptions): Promise<void> };
  rtl: {
    expectDocumentRtl(): Promise<void>;
    expectNoHorizontalOverflow(): Promise<void>;
    expectPersianDigits(locator: Locator): Promise<void>;
    /** In RTL the first item in reading order sits to the right of the second. */
    expectInlineOrder(first: Locator, second: Locator): Promise<void>;
  };
};

export const test = base.extend<Options & Helpers>({
  failOnBrowserErrors: [true, { option: true }],
  ignoreBrowserErrors: [[], { option: true }],

  browserLog: [
    async ({ page, failOnBrowserErrors, ignoreBrowserErrors }, use, testInfo) => {
      const log: BrowserLog = { errors: [], warnings: [], failedRequests: [] };
      page.on('console', (message) => {
        const { url, lineNumber } = message.location();
        const line = `[console.${message.type()}] ${message.text()} (${url}:${lineNumber})`;
        if (message.type() === 'error') log.errors.push(line);
        if (message.type() === 'warning') log.warnings.push(line);
      });
      page.on('pageerror', (error) => log.errors.push(`[pageerror] ${error.message}`));
      page.on('requestfailed', (request) => {
        const reason = request.failure()?.errorText ?? '';
        if (reason.includes('ERR_ABORTED')) return; // navigations cancel in-flight requests
        log.failedRequests.push(`[requestfailed] ${request.method()} ${request.url()} ${reason}`);
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          log.failedRequests.push(
            `[http ${response.status()}] ${response.request().method()} ${response.url()}`,
          );
        }
      });

      await use(log);

      const everything = [...log.errors, ...log.failedRequests, ...log.warnings];
      if (everything.length) {
        // A file, not a body attachment: only files land in test-results/<test>/, next to error-context.md.
        const file = testInfo.outputPath('browser-log.txt');
        await writeFile(file, everything.join('\n'));
        await testInfo.attach('browser-log.txt', { path: file, contentType: 'text/plain' });
      }
      const problems = [...log.errors, ...log.failedRequests].filter(
        (line) => !ignoreBrowserErrors.some((pattern) => pattern.test(line)),
      );
      if (failOnBrowserErrors && problems.length && testInfo.status === testInfo.expectedStatus) {
        throw new Error(
          `The page reported ${problems.length} problem(s) during this test:\n${problems.join('\n')}\n` +
            "Fix the cause. For a known-noisy third party use test.use({ ignoreBrowserErrors: [[/pattern/], { scope: 'test' }] }).",
        );
      }
    },
    { auto: true },
  ],

  a11y: async ({ page }, use, testInfo) => {
    await use({
      async check(options = {}) {
        let builder = new AxeBuilder({ page }).withTags([
          'wcag2a',
          'wcag2aa',
          'wcag21a',
          'wcag21aa',
          'wcag22aa',
        ]);
        if (options.include) builder = builder.include(options.include);
        for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
        if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);
        const { violations } = await builder.analyze();
        if (violations.length) {
          await testInfo.attach('axe-violations.json', {
            body: JSON.stringify(violations, null, 2),
            contentType: 'application/json',
          });
        }
        const summary = violations.map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help} -> ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
        );
        expect(summary, 'axe accessibility violations').toEqual([]);
      },
    });
  },

  rtl: async ({ page }, use) => {
    await use({
      async expectDocumentRtl() {
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await expect(page.locator('html')).toHaveAttribute('lang', /^fa/);
        expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl');
      },
      async expectNoHorizontalOverflow() {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'the page scrolls horizontally').toBeLessThanOrEqual(1);
      },
      async expectPersianDigits(locator) {
        const text = (await locator.allInnerTexts()).join(' ');
        expect(text, 'expected Persian digits in the UI').toMatch(/[۰-۹]/);
        expect(text, 'Latin digits leaked into the UI').not.toMatch(/[0-9]/);
      },
      async expectInlineOrder(first, second) {
        const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
        if (!a || !b) throw new Error('expectInlineOrder: both elements must be visible');
        expect(a.x, 'in RTL the first item sits to the right of the second').toBeGreaterThan(b.x);
      },
    });
  },
});

export { expect };
