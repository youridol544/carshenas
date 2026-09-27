import { existsSync } from 'node:fs';
import { expect, test } from '../../fixtures/test';
import { DEFAULT_DENY, INTERACTIVE, perform } from '../../gorilla/actions';
import { installOracles } from '../../gorilla/oracles';
import { runGorilla, type GorillaOptions } from '../../gorilla/run';

// Proves the gorilla against e2e/site/lab/: the clean page produces no findings, every planted defect is found
// by the oracle meant for it, and each finding replays from its seed and path. If an oracle stops working, this
// fails instead of the gorilla quietly passing everything. Run it with `pnpm gorilla --selfcheck` (CI runs it in
// the gorilla job); `pnpm e2e` leaves it out because it takes minutes.
//
// Everything is counted in runs, not seconds: with a fixed seed a fixed number of runs is the same sequence of
// actions on every machine, while a time budget would run fewer on a slow one. The budgets are only safety nets.

// The planted defects make exactly the noise the shared console guard would fail on; the gorilla judges here.
test.use({ failOnBrowserErrors: false });

const LAB = '/lab/';
const SEED = 20260921;
const ready: NonNullable<GorillaOptions['ready']> = async (page) => {
  await expect(page.getByRole('heading', { level: 1, name: 'آزمایشگاه آزمون تصادفی' })).toBeVisible();
};
// A small page: mostly taps and typing, still some keys, scrolls, resizes, history and pauses.
const lab = {
  ready,
  seed: SEED,
  maxActions: 25,
  budgetMs: 240_000,
  weights: { tap: 14, type: 5, key: 3, scroll: 1, resize: 1, history: 1, pause: 1 },
} satisfies Partial<GorillaOptions>;

test.describe('gorilla self-check on the lab page', { tag: '@gorilla-selfcheck' }, () => {
  // Deterministic by construction; a retry would only hide an oracle that became flaky.
  test.describe.configure({ retries: 0 });

  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'fixture-mobile',
      'the lab self-check runs once, on the phone project',
    );
  });

  test('the clean lab page survives the gorilla with no findings', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const result = await runGorilla(page, testInfo, { ...lab, url: LAB, runs: 20 });
    expect(result.problems, result.replay).toEqual([]);
    expect(result.runs, 'every planned run must have happened').toBe(20);
  });

  const DEFECTS: readonly { defect: string; oracle: RegExp }[] = [
    { defect: 'throw', oracle: /^uncaught exception: planted defect/ },
    { defect: 'request', oracle: /^failed request: HTTP 404 GET .*\/lab\/prices-missing\.json/ },
    { defect: 'overflow', oracle: /^horizontal overflow/ },
    { defect: 'garbage', oracle: /^garbage text on screen/ },
    { defect: 'focus', oracle: /^focus lost: button/ },
    { defect: 'focus-query', oracle: /^focus lost: button/ },
    { defect: 'stall', oracle: /^main thread blocked/ },
    { defect: 'a11y', oracle: /^accessibility: image-alt/ },
    { defect: 'load', oracle: /^uncaught exception: planted defect: the page throws while loading/ },
  ];

  for (const { defect, oracle } of DEFECTS) {
    test(`catches the planted "${defect}" defect and replays it from the seed`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(300_000);
      const found = await runGorilla(page, testInfo, {
        ...lab,
        url: `${LAB}?defect=${defect}`,
        runs: 60,
        shrink: false,
        // axe costs about a second per run; only the accessibility defect needs it.
        oracle: { axe: defect === 'a11y' },
      });
      expect(found.failed, `the gorilla missed the "${defect}" defect in ${found.runs} runs`).toBe(true);
      expect(
        found.problems.some((problem) => oracle.test(problem)),
        found.problems.join('\n'),
      ).toBe(true);
      expect(found.reproduced, 'replaying the failure from its seed and path must fail again').toBe(true);
      expect(existsSync(found.logFile), 'the action log is written').toBe(true);
      expect(found.replay).toContain(`--seed ${SEED}`);
    });
  }

  test('never presses a denied control, by tap or by keyboard', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (error) => uncaught.push(error.message));
    await page.goto(LAB);
    await ready(page);
    const scope = page.locator('body');
    const controls = scope.locator(INTERACTIVE).filter({ visible: true });
    const ids = await controls.evaluateAll((elements) => elements.map((element) => element.id));
    const pick = ids.indexOf('clear-all');
    expect(pick, 'the guard button is among the controls the gorilla picks from').toBeGreaterThanOrEqual(0);

    expect(await perform(page, scope, { kind: 'tap', pick, double: false }, DEFAULT_DENY)).toContain(
      '(deny-list)',
    );
    expect(await perform(page, scope, { kind: 'tap', pick, double: true }, DEFAULT_DENY)).toContain(
      '(deny-list)',
    );
    await page.getByRole('button', { name: 'حذف همه خودروها' }).focus();
    expect(await perform(page, scope, { kind: 'key', key: 'Enter' }, DEFAULT_DENY)).toContain('(deny-list)');
    expect(await perform(page, scope, { kind: 'key', key: 'Space' }, DEFAULT_DENY)).toContain('(deny-list)');
    expect(uncaught).toEqual([]);
  });

  test('blocks a click on a denied control inside the page, whatever caused it', async ({
    page,
  }, testInfo) => {
    const uncaught: string[] = [];
    page.on('pageerror', (error) => uncaught.push(error.message));
    const origin = new URL(testInfo.project.use.baseURL ?? 'http://127.0.0.1:4173').origin;
    const oracles = await installOracles(page, { allowedOrigin: origin, deny: DEFAULT_DENY, axe: false });
    await page.goto(LAB);
    await ready(page);
    // A plain Playwright click, bypassing every check the gorilla makes before an action: the in-page fence
    // is what stops it (the case of a double tap whose second click lands on a control that moved).
    await page.getByRole('button', { name: 'حذف همه خودروها' }).click();
    expect(await oracles.blockedPresses()).toEqual(['حذف همه خودروها']);
    expect(uncaught).toEqual([]);
  });

  test('shrinks a failure to a short sequence that a separate replay reproduces', async ({
    page,
  }, testInfo) => {
    test.setTimeout(600_000);
    const options = { ...lab, url: `${LAB}?defect=throw`, oracle: { axe: false } } satisfies GorillaOptions;
    const found = await runGorilla(page, testInfo, { ...options, runs: 60 });
    expect(found.failed).toBe(true);
    // The defect needs three presses of «افزودن به مقایسه»; a double tap counts as two.
    expect(found.actions.length, found.actions.join('\n')).toBeLessThanOrEqual(8);

    // The way a person replays it: a new run with only the seed and the path the first one printed.
    const replayed = await runGorilla(page, testInfo, {
      ...options,
      seed: found.seed,
      path: found.path ?? undefined,
    });
    expect(replayed.failed).toBe(true);
    expect(replayed.actions).toEqual(found.actions);
  });
});
