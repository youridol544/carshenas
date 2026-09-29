import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Optional local overrides, see .env.example. Real environment variables win.
const envFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const CI = Boolean(process.env.CI);
const FIXTURE_URL = 'http://127.0.0.1:4173';
const DEFAULT_APP_URL = 'http://127.0.0.1:3100';
const appURL = process.env.E2E_BASE_URL ?? DEFAULT_APP_URL;

// tests/app runs against the real application: by default a production build started here, or whatever
// E2E_BASE_URL points at (a running `pnpm dev`, a preview deployment). tests/harness are the harness's own
// self-tests and always run against the bundled Farsi RTL fixture site.
// Plain `node` on purpose: it also works in the Playwright container, which has no pnpm.
const NEXT_BIN = 'node node_modules/next/dist/bin/next';
const appServerCommand =
  process.env.E2E_WEB_SERVER_CMD ??
  (process.env.E2E_BASE_URL ? undefined : `${NEXT_BIN} build && ${NEXT_BIN} start --port 3100`);
const appServerCwd = process.env.E2E_WEB_SERVER_CWD ?? fileURLToPath(new URL('../apps/web', import.meta.url));
const onlyFixture = Boolean(process.env.E2E_ONLY_FIXTURE);
// tests/chaos (the gorilla) only runs through `pnpm gorilla`, which always sets a seed.
const gorilla = Boolean(process.env.GORILLA_SEED);

const server = { reuseExistingServer: !CI, stdout: 'ignore', stderr: 'pipe' } as const;

export default defineConfig({
  // Baselines are produced only inside the official Playwright container (scripts/visual-docker.sh),
  // so the path carries no OS suffix.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  // Left out unless asked for: @visual needs the container, @gorilla-selfcheck takes minutes (pnpm gorilla --selfcheck).
  grepInvert: [
    ...(process.env.E2E_VISUAL ? [] : [/@visual/]),
    ...(process.env.GORILLA_SELFCHECK ? [] : [/@gorilla-selfcheck/]),
  ],
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  // An over-running suite fails with a report instead of being killed by the CI job timeout.
  globalTimeout: CI ? 30 * 60_000 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  reporter: CI
    ? [['github'], ['html', { open: 'never' }], ['blob']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: CI ? 'on-first-retry' : 'off',
  },
  projects: [
    // Buyers are phone-first: the mobile project is the default target for new tests.
    ...(onlyFixture
      ? []
      : [
          { name: 'mobile', testDir: './tests/app', use: { ...devices['Pixel 7'], baseURL: appURL } },
          {
            name: 'desktop',
            testDir: './tests/app',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: appURL },
          },
          ...(process.env.E2E_WEBKIT
            ? [{ name: 'iphone', testDir: './tests/app', use: { ...devices['iPhone 15'], baseURL: appURL } }]
            : []),
        ]),
    // Chaos projects: never retried (a retry with the same seed repeats the same failure, and a new seed would
    // hide it). No trace or video of the whole search: the gorilla replays its minimal failure and traces that.
    ...(gorilla && !onlyFixture
      ? [
          {
            name: 'chaos-mobile',
            testDir: './tests/chaos',
            retries: 0,
            use: {
              ...devices['Pixel 7'],
              baseURL: appURL,
              trace: 'off' as const,
              video: 'off' as const,
            },
          },
          {
            name: 'chaos-desktop',
            testDir: './tests/chaos',
            retries: 0,
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 1440, height: 900 },
              baseURL: appURL,
              trace: 'off' as const,
              video: 'off' as const,
            },
          },
        ]
      : []),
    {
      name: 'fixture-mobile',
      testDir: './tests/harness',
      use: { ...devices['Pixel 7'], baseURL: FIXTURE_URL },
    },
    {
      name: 'fixture-desktop',
      testDir: './tests/harness',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: FIXTURE_URL },
    },
  ],
  webServer: [
    { ...server, name: 'fixture', command: 'node site/serve.mjs', url: FIXTURE_URL, timeout: 30_000 },
    ...(appServerCommand && !onlyFixture
      ? [
          {
            ...server,
            name: 'app',
            command: appServerCommand,
            url: appURL,
            cwd: appServerCwd,
            timeout: 240_000,
            env: {
              NEXT_TELEMETRY_DISABLED: '1',
              // Every test signs up and in from 127.0.0.1, so the per-address hourly limits (ADR-0020 point 8;
              // defaults 100, 20 and 120) would stop a full run. The throttling the tests exercise is per name.
              CARSHENAS_SIGN_IN_ADDRESS_LIMIT: '100000',
              CARSHENAS_SIGN_UP_ADDRESS_LIMIT: '100000',
              CARSHENAS_USERNAME_CHECK_ADDRESS_LIMIT: '100000',
            },
            gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 } as const,
          },
        ]
      : []),
  ],
});
