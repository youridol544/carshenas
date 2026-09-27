// Layout shift caused by the web font arriving late, for font-display swap and optional (CS-3, research note
// 2026-09-27-persian-typeface.md). The app's @font-face says swap; optional is measured by rewriting that one
// declaration in the served CSS, so both runs use the same build.
//
// Usage, from the repository root:
//   pnpm --filter @carshenas/web build && (cd apps/web && npx next start --port 3100) &
//   node docs/research/2026-09-27-persian-typeface/lab/font-display-cls.mjs [http://127.0.0.1:3100]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const e2e = fileURLToPath(new URL('../../../../e2e', import.meta.url));
const { chromium, devices } = require(require.resolve('@playwright/test', { paths: [e2e] }));

const base = process.argv[2] ?? 'http://127.0.0.1:3100';
const PAGES = ['/design', '/', '/no-such-page'];
const DELAYS = [0, 300, 1500];
const DISPLAYS = ['swap', 'optional'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch();
console.log('page            display   font delay  CLS      h1 typeface at the end');
for (const path of PAGES) {
  for (const display of DISPLAYS) {
    for (const delay of DELAYS) {
      const context = await browser.newContext({ ...devices['Pixel 7'] });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.route('**/*.woff2', async (route) => {
        await sleep(delay);
        await route.continue();
      });
      if (display === 'optional') {
        await page.route('**/*.css', async (route) => {
          const response = await route.fetch();
          const body = (await response.text()).replaceAll('font-display:swap', 'font-display:optional');
          await route.fulfill({ response, body });
        });
      }
      await page.goto(base + path, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await sleep(1000);
      const result = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const family = h1 ? getComputedStyle(h1).fontFamily.split(',')[0].trim() : '';
        const face = [...document.fonts].find((f) => family.includes(f.family));
        return { shift: window.__shift, family, status: face ? face.status : 'none' };
      });
      const used = result.status === 'loaded' ? 'web font' : `fallback (${result.status})`;
      console.log(
        `${path.padEnd(15)} ${display.padEnd(9)} ${String(delay).padStart(4)} ms   ${result.shift.toFixed(4)}   ${used}`,
      );
      await context.close();
    }
  }
}
await browser.close();
