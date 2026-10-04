import { defineConfig, devices } from '@playwright/test';

// The demo rehearsal (CS-120; docs/submission/recording-day.md): `pnpm e2e:demo` walks the five-minute demo path on the
// running app and its real data, on a phone and on a desktop screen (tests/demo/demo-walk.spec.ts).
//
// It is a configuration of its own, outside `pnpm e2e`, for three reasons. It starts no server: the app runs already, on
// whatever DEMO_BASE_URL names, because the rehearsal is only worth anything against the data the video will show. It has no
// global setup: nothing is seeded and nothing is removed, so a rehearsal leaves no test row in the database the recording
// is made on. And it is not a test of the app: it fails when the demo path is rough, with a report saying where.
const baseURL = process.env.DEMO_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

// One folder per run, shared by both projects: the config is read again in every worker, which keeps the value set here.
process.env.DEMO_RUN ??= new Date().toISOString().slice(0, 19).replaceAll(':', '-');

export default defineConfig({
  testDir: './tests/demo',
  outputDir: './test-results/demo',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A first visit to a page of a development server compiles it; the walk opens a dozen of them on each screen.
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    baseURL,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    // The same two screens as the app's own tests, and the video's: a phone (Pixel 7) and a 16:9 desktop window.
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 810 } } },
  ],
});
