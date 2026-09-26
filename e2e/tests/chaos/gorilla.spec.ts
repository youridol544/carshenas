import { APP_PAGES, type AppPage } from '../../fixtures/app-pages';
import { expect, test } from '../../fixtures/test';
import { gorillaSettings, runGorilla } from '../../gorilla/run';

// Run through `pnpm gorilla` (scripts/gorilla.mjs), which chooses and prints the seed and turns on the
// chaos-mobile and chaos-desktop projects. Every app page in fixtures/app-pages.ts, or the one URL given.

// The gorilla's own oracles judge the page; the shared console guard would only repeat their findings.
test.use({ failOnBrowserErrors: false });

const settings = gorillaSettings();
const targets: readonly AppPage[] = settings.url
  ? [
      {
        name: settings.url,
        path: settings.url,
        scope: settings.scope ?? 'body',
        ready: async (page) => {
          await page.waitForLoadState('load');
        },
      },
    ]
  : APP_PAGES.map((page) => (settings.scope ? { ...page, scope: settings.scope } : page));

for (const target of targets) {
  test(`gorilla: ${target.name}`, async ({ page }, testInfo) => {
    // Search for the budget, shrink for at most as long again, then the final scans.
    test.setTimeout(2 * settings.budgetMs + 120_000);
    const result = await runGorilla(page, testInfo, {
      url: target.path,
      scope: target.scope,
      ready: target.ready,
      seed: settings.seed,
      path: settings.path,
      runs: settings.runs,
      maxActions: settings.maxActions,
      budgetMs: settings.budgetMs,
    });
    expect(
      result.problems,
      `The gorilla found problems (seed ${result.seed}). Action log: ${result.logFile}\nReplay: ${result.replay}`,
    ).toEqual([]);
  });
}
