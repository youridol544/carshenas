---
paths:
  - "e2e/**"
---

# Writing and fixing Playwright tests (`e2e/`)

- Application tests live in `tests/app/` (projects `mobile`, `desktop`, `iphone`); `tests/harness/` only tests the harness against the fixture site; `tests/chaos/` is the gorilla, run only through `pnpm gorilla`. Import `test` and `expect` from `../../fixtures/test`, never from `@playwright/test`. The fixtures fail a test on console errors and failed requests, and provide `a11y` and `rtl`.
- Locate by role and accessible name in Farsi, as a user perceives the page: `getByRole('button', { name: 'نشان کردن آگهی' })`, then `getByLabel`, `getByText`. No CSS or XPath, and no `data-testid` unless the element cannot have an accessible name. Copy names from a Playwright snapshot (`npx playwright cli find "<text>"`); it preserves the zero-width non-joiner that retyped Persian usually loses.
- Assert with web-first matchers (`await expect(locator).toHaveText(...)`). Never `waitForTimeout`, never `networkidle` as a readiness signal. Wait for what the user waits for.
- Freeze time with `page.clock.setFixedTime(...)` before asserting dates. Expect Persian digits in UI text (`rtl.expectPersianDigits`), Jalali dates and Toman formatting.
- Every new user-facing screen gets at least `rtl.expectDocumentRtl()`, `rtl.expectNoHorizontalOverflow()` and `a11y.check()`. The `mobile` project is the primary target.
- One behaviour per test, independent of order. Shared login goes through a setup project and a `storageState` file in `e2e/.auth/` (gitignored), not through repeated UI steps.
- A failing test is information. Read `test-results/<test>/error-context.md` first, then the trace (`npx playwright trace open <trace.zip>`). Fix the product or the test's wrong assumption. Do not weaken or delete an assertion, add retries, raise timeouts, or mark `fixme`/`skip` to get green. If the expected behaviour itself changed, say so and ask.
- `@visual` baselines are only written by `pnpm e2e:visual --update-snapshots=all`, which runs in the official container (a bare `--update-snapshots` keeps any image within the 1% tolerance). Never commit screenshots produced on the host. The container has no Persian UI font, so the app must self-host its font, and visual tests wait for `document.fonts.ready` before comparing.
- While iterating run the narrowest thing (`E2E_BASE_URL=http://127.0.0.1:3000 pnpm e2e tests/app/x.spec.ts --project=mobile` against a running `pnpm dev`); run the whole suite (`pnpm e2e`) before finishing.
- A new page goes into `fixtures/app-pages.ts` in the same change, so the stress matrix and the gorilla cover it. A gorilla finding is fixed in the product and then becomes a scripted test in `tests/app/`; never widen `DEFAULT_DENY`, add an `ignore` pattern or raise a limit to make a run green without naming the tracked issue in a comment. Keep every planted defect in `site/lab/` caught by `pnpm gorilla --selfcheck`.
