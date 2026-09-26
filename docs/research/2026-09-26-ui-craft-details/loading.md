# Research pass: layout stability, loading states, perceived performance and optimistic UI (CS-26)

Date: 2026-09-26. Scope: the owner's examples #2 (reserve image space), #7 (optimistic UI), #8 (skeletons), #11 (tabular numbers), plus every cause of layout shift, loading-state timing, skeleton design, React/Next abstractions and optimistic updates.

Checked against the installed versions: `next` 16.3.5 (bundled docs in `apps/web/node_modules/next/dist/docs/` and its source), `react`/`react-dom` 19.2.8 (types and `react-dom-client` source), the App Router's vendored React `19.3.0-canary-cbb046ab-20260731`, `tailwindcss` 4.3.3, and our lint config (`apps/web/eslint.config.mjs`). Web pages were fetched with `curl` and read as text on 2026-09-26; react.dev pages were read from their source markdown in `github.com/reactjs/react.dev` (main); WCAG text from `github.com/w3c/wcag` because w3.org answered 403.

Confidence: **high** = two independent credible sources or an official doc; **medium** = one credible source, or sources that agree on the mechanism but not the numbers; **low** = our inference.

## Sources consulted

| # | Source (author, why credible) | URL | Date | Fetched | Owner examples it independently states |
|---|---|---|---|---|---|
| S1 | Milica Mihajlija, Philip Walton (Chrome team; CLS metric owners), "Cumulative Layout Shift (CLS)", web.dev | https://web.dev/articles/cls | updated 2023-04-12 | yes | none (defines CLS, 500 ms input exclusion, transforms) |
| S2 | Addy Osmani, Barry Pollard (Chrome web performance), "Optimize Cumulative Layout Shift", web.dev | https://web.dev/articles/optimize-cls | 2020-05-05, updated 2025-02-07 | yes | #2; #8 in part ("placeholder or skeleton UI" to reserve space) |
| S3 | Jake Archibald (browser engineer, Chrome then Mozilla), "Avoiding `<img>` layout shifts: aspect-ratio vs width & height attributes" | https://jakearchibald.com/2022/img-aspect-ratio/ | 2022-07-11 | yes | #2 |
| S4 | Barry Pollard, "Setting Height And Width On Images Is Important Again", Smashing Magazine | https://www.smashingmagazine.com/2020/03/setting-height-width-images-important-again/ | 2020-03-09 | yes | #2 |
| S5 | Jen Simmons (Mozilla then Apple WebKit; drove the proposal), "Adding Explicit Aspect Ratios to CSS", TPAC Lyon | https://talks.jensimmons.com/FnU3KJ/slides | 2018-10 | yes, title and date only (slides are images); summary via Robin Rendle, CSS-Tricks, https://css-tricks.com/do-this-to-improve-image-loading-on-your-website/, 2020-02-19 | #2 (origin; content not quotable) |
| S6 | MDN, `<img>` element | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img | modified 2026-09-11 | yes | #2 |
| S7 | MDN, `aspect-ratio` | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/aspect-ratio | modified 2026-07-21 | yes | #2 |
| S8 | MDN, `font-variant-numeric` | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric | modified 2026-09-10 | yes | #11 (alignment only) |
| S9 | MDN, `scrollbar-gutter` | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter | modified 2026-04-20 | yes | none |
| S10 | MDN, `aria-busy` | https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy | modified 2025-06-23 | yes | none |
| S11 | MDN, `<length>` (`lh` unit); web-features data for `lh` (Baseline high 2026-05-21) and `layout-instability` (not Baseline, Chromium 84+) | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length ; https://github.com/web-platform-dx/web-features | 2026 | yes | none |
| S12 | Katie Hempenius (Chrome), "Improved font fallbacks", Chrome for Developers | https://developer.chrome.com/blog/font-fallbacks | updated 2023-02-10 | yes | none |
| S13 | Katie Hempenius, "Best practices for fonts", web.dev | https://web.dev/articles/font-best-practices | updated 2022-10-04 | yes | none |
| S14 | Una Kravets, Vladimir Levin (Chrome), "content-visibility", web.dev | https://web.dev/articles/content-visibility | 2020-08-05, updated 2025-09-23 | yes | none |
| S15 | WICG, Layout Instability API (spec) | https://wicg.github.io/layout-instability/ | living | yes | none |
| S16 | Vercel, Web Interface Guidelines (live page; the vendored `AGENTS.md` at commit e3d624b lacks the loading-duration numbers) | https://vercel.com/design/guidelines | living, read 2026-09-26 | yes | #2, #7, #8, #11 |
| S17 | Jakub Krehel, make-interfaces-feel-better, `typography.md` (vendored at commit 35545ea) | https://github.com/jakubkrehel/make-interfaces-feel-better | copied 2026-09-18 | yes (vendored copy) | #11 |
| S18 | Jakob Nielsen (NN/g), "Response Times: The 3 Important Limits" | https://www.nngroup.com/articles/response-times-3-important-limits/ | 1993, 2014 addendum | yes | none |
| S19 | Katie Sherwin (NN/g), "Progress Indicators Make a Slow System Less Insufferable" | https://www.nngroup.com/articles/progress-indicators/ | 2014-10-26 | yes | none |
| S20 | Samhita Tankala (NN/g), "Skeleton Screens 101" | https://www.nngroup.com/articles/skeleton-screens/ | 2023-06-04, reviewed 2026-09-02 | yes | #8 |
| S21 | Jakob Nielsen (NN/g), "Confirmation Dialogs Can Prevent User Errors — If Not Overused" | https://www.nngroup.com/articles/confirmation-dialog/ | 2018-02-18, reviewed 2026-08-07 | yes | #7 (undo side) |
| S22 | Luke Wroblewski (product designer, Polar; author of Mobile First), "Mobile Design Details: Avoid The Spinner" | https://www.lukew.com/ff/entry.asp?1797 | 2013-09-17 | yes | #8 |
| S23 | Luke Wroblewski, "Mobile Design Details: Performing Actions Optimistically" | https://www.lukew.com/ff/1759/mobile-design-details-performing-actions-optimistically | 2013-07-29 | yes | #7 |
| S24 | Aza Raskin (Humanized, Mozilla), "Never Use a Warning When you Mean Undo", A List Apart | https://alistapart.com/article/neveruseawarning/ | 2007-07-21 | yes | #7 (undo side) |
| S25 | Kathryn Faulkner, Katherine Olvera (Viget UX; 136-person test), "A Bone to Pick with Skeleton Screens" | https://www.viget.com/articles/a-bone-to-pick-with-skeleton-screens/ | 2017-10-19 | yes | #8 (contrary evidence) |
| S26 | Adrian Roselli (accessibility practitioner, W3C WG member), "More Accessible Skeletons" | https://adrianroselli.com/2020/11/more-accessible-skeletons.html | 2020-11-29, updated 2026-04-14 | yes | #8 (critical) |
| S27 | W3C, WCAG 2.2 SC 2.2.2 text and Understanding 2.2.1 / 2.2.2 | https://github.com/w3c/wcag (guidelines/sc/20/pause-stop-hide.html, understanding/20/timing-adjustable.html) | Recommendation 2024-12-12 | yes (repo; w3.org gave 403) | none |
| S28 | React team, `useOptimistic` | https://react.dev/reference/react/useOptimistic | living, read 2026-09-26 | yes | #7 |
| S29 | React team, `useActionState` | https://react.dev/reference/react/useActionState | living | yes | #7 |
| S30 | React team, `useTransition` | https://react.dev/reference/react/useTransition | living | yes | none |
| S31 | React team, `<Suspense>` | https://react.dev/reference/react/Suspense | living | yes | #8 ("loading spinner or skeleton") |
| S32 | React team, `useDeferredValue` | https://react.dev/reference/react/useDeferredValue | living | yes | none |
| S33 | React team, `<Activity>` | https://react.dev/reference/react/Activity | living | yes | none |
| S34 | React team, "React 19.2" (batching Suspense reveals) | https://react.dev/blog/2025/10/01/react-19-2 | 2025-10-01 | yes | none |
| S35 | Next.js team (Vercel), bundled docs 16.3.5: `loading.js`, Streaming, Instant navigation, Building interactive apps, Server Actions, Preserving UI state, Single-page applications, Prefetching, Adopting Partial Prefetching, `<Link>`, `useLinkStatus`, `next/image`, `next/font`, `catchError` | `apps/web/node_modules/next/dist/docs/01-app/…` (public: https://nextjs.org/docs/app) | 16.3.5 | yes | #2 (`next/image`), #7 (interactive apps), #8 (streaming, `loading.js`) |
| S36 | Next.js source 16.3.5: `client/components/layout-router.js` (state key built without search params), `client/components/app-router-instance.js` (navigations in `startTransition`), `compiled/@next/font/dist/local/get-fallback-metrics-from-font-file.js` | `apps/web/node_modules/next/dist/…` | 16.3.5 | yes | none |
| S37 | Next.js Learn, "Streaming" and "Adding Search and Pagination"; `vercel/next-learn` `dashboard/final-example/app/ui/skeletons.tsx` | https://nextjs.org/learn/dashboard-app/streaming | living | yes | #8 |
| S38 | Remix team (Shopify), "Pending and Optimistic UI", Remix v2 docs | https://v2.remix.run/docs/discussion/pending-ui/ | last commit 2025-06-06 | yes | #7, #8 |
| S39 | React Router team, "Pending UI" (8.4 docs) | https://reactrouter.com/start/framework/pending-ui | living | yes | #7 |
| S40 | Stephan Meijer (Kent C. Dodds is a code contributor), `spin-delay` README | https://github.com/smeijer/spin-delay | 2.0.1, 2024-08-16 | yes | none (timing) |
| S41 | Kent C. Dodds, Epic Stack `useDelayedIsPending` (`app/utils/misc.tsx`) | https://github.com/epicweb-dev/epic-stack | main, read 2026-09-26 | yes | none (timing) |
| S42 | dvtng, `react-loading-skeleton` README and `Skeleton.tsx` | https://github.com/dvtng/react-loading-skeleton | 3.5.0, 2024-09-21 | yes | #8 (built-in skeleton states) |
| S43 | Brandur Leach (Stripe API team), "Designing robust and predictable APIs with idempotency" | https://stripe.com/blog/idempotency | 2017-02-22 | yes | none |
| S44 | Tuomas Artman (Linear co-founder), "Rethinking the startup MVP"; Linear changelog | https://linear.app/now/rethinking-the-startup-mvp-building-a-competitive-product ; https://linear.app/changelog/2023-10-12-triage-responsibility | 2024-02-28; 2023-10-12 | yes | #7 |
| S45 | Apple, Human Interface Guidelines, "Right to left" | https://developer.apple.com/design/human-interface-guidelines/right-to-left | living, read 2026-09-26 | yes (JSON source) | none |
| S46 | Tailwind CSS 4.3.3 as installed (`h-lh`, `block-lh`, `min-block-lh`, `aspect-<ratio>`, `tabular-nums`, `scrollbar-gutter-stable`, `delay-*` from `--transition-delay-*`) | `apps/web/node_modules/tailwindcss/dist/lib.js` | 4.3.3 | yes | none |
| — | Linear's React Helsinki and 2023 sync-engine talks (video); Mejtoft et al. 2018 "The effect of skeleton screens" (cited by S20) | — | — | no | UNVERIFIED, not used as evidence |

## Tips

### L-1: Budget zero layout shift for every designed swap (image, font, skeleton→content) and prove it with a measured test
- Owner example: #2 (generalised)
- Why: The page threshold is CLS ≤ 0.1 at the 75th percentile, but a swap we design ourselves should add nothing; lab loads miss the shifts that happen after interactions and while scrolling, which is where a streamed, filterable results page shifts.
- How: In the Chromium Playwright projects (`mobile`, `desktop`; skip `iphone`, the API is Chromium-only) register an observer before navigation and read it after the content is visible plus two animation frames:
  ```ts
  await page.addInitScript(() => {
    const store = window as unknown as { layoutShift: number };
    store.layoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) store.layoutShift += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/search?make=peugeot');
  await expect(page.getByRole('list', { name: 'نتایج جست‌وجو' })).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => (window as unknown as { layoutShift: number }).layoutShift)).toBe(0);
  ```
  Force the late paths with `page.route` delays on the font and one photo. Record the number in the `/verify-ui` evidence bundle.
- Sources: Mihajlija, Walton — Cumulative Layout Shift (CLS) — https://web.dev/articles/cls — 2023-04-12 — "Good CLS values are 0.1 or less. Poor values are greater than 0.25."; Osmani, Pollard — Optimize Cumulative Layout Shift — https://web.dev/articles/optimize-cls — 2025-02-07 — "CLS is measured throughout the full life of the page and not just during the initial page load that lab tools typically measure."; web-features — layout-instability — https://github.com/web-platform-dx/web-features — 2026 — (not Baseline; Chrome/Edge 84+, no quote).
- Confidence: high for thresholds and the API; low for "zero per designed swap" (our target).
- Conflicts: none. The e2e suite has no CLS assertion today; this is a new measurable check for the `design-reviewer` rubric.

### L-2: Reserve every image's box before it loads: `width`/`height` attributes for content images, CSS `aspect-ratio` plus `object-fit` for design slots
- Owner example: #2 (confirmed and sharpened)
- Why: An `<img>` without dimensions is 0 px tall until its header bytes arrive, so everything under it jumps. Browsers turn `width`/`height` attributes into a presentational hint `aspect-ratio: auto w / h`: the box exists from the first layout, and `auto` lets the file's real ratio win if the attributes were wrong. CSS `aspect-ratio` without `auto` enforces the ratio, which suits a fixed design slot but stretches the photo unless `object-fit` is set.
- How: A content image whose size we know (dimensions stored at ingestion): `<img width={w} height={h} className="h-auto w-full" …>`. A design slot (result-row thumbnail): frame `aspect-4/3` + `object-cover` (crops). The listing-page gallery, where the whole car must show: frame `aspect-4/3` + `object-contain` on a token background (letterboxes portrait photos). Lazy-loaded images need this most. Art-directed `<picture>`: give each `<source>` its own `width`/`height`.
- Sources: Archibald — Avoiding `<img>` layout shifts — https://jakearchibald.com/2022/img-aspect-ratio/ — 2022-07-11 — "the image reserves space for its content as soon as it appears in the document, so stuff doesn't shift around once it loads." and "Is it content or design?"; Osmani, Pollard — Optimize CLS — https://web.dev/articles/optimize-cls — 2025-02-07 — "Always include width and height size attributes on your images and video elements. Alternatively, reserve the required space with CSS aspect-ratio or similar."; MDN — `<img>` — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img — 2026-09-11 — "Including height and width enables the aspect ratio of the image to be calculated by the browser prior to the image being loaded." and "unloaded images have a width and height of 0"; MDN — aspect-ratio — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/aspect-ratio — 2026-07-21 — "auto is used if the element is a replaced element with a natural aspect ratio, like an <img> element"; Simmons — Adding Explicit Aspect Ratios to CSS — https://talks.jensimmons.com/FnU3KJ/slides — 2018-10 — (origin of the proposal; slides not quotable).
- Confidence: high.
- Conflicts: Pollard's 2020 article describes the mapping as a user-agent stylesheet rule `aspect-ratio: attr(width) / attr(height)`; Archibald (2022) shows it is a presentational hint of the form `auto w / h`, and web.dev (2025 update, co-authored by Pollard) now links Archibald. The owner's "e.g. with aspect-ratio" is right for design slots; for content images the attributes are the better tool because the real ratio can correct a wrong guess.

### L-3: Listing photos of unknown size: `next/image` `fill` inside a positioned `aspect-*` frame, `sizes` that equals the frame, and a frame that never collapses
- Owner example: #2
- Why: `next/image` needs `width` and `height` unless the file is imported or `fill` is set; source photos arrive with unknown dimensions, so `fill`. A `fill` image is absolutely positioned, so the parent supplies both position and size. Without `sizes`, a 112 px thumbnail downloads a viewport-wide file on a 412 px phone.
- How:
  ```tsx
  <div className="relative aspect-4/3 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
    {photoUrl === null ? (
      <NoPhotoMark /> // same box, token colour, icon aria-hidden: never render nothing
    ) : (
      <Image src={photoUrl} alt={title} fill sizes="7rem" className="object-cover" />
    )}
  </div>
  ```
  `sizes="7rem"` matches `w-28`. The placeholder while loading is the frame's token background: `placeholder="blur"` on remote files needs a `blurDataURL` we would have to generate. The one above-the-fold photo on the listing page: `loading="eager"` with `fetchPriority="high"` (our rule).
- Sources: Next.js team — `next/image` (16.3.5) — `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` — 16.3.5 — "If the height and width are unknown, we recommend using the fill property." and "If sizes is missing, the browser assumes the image will be as wide as the viewport (100vw)." and "If the image is dynamic or remote, you must provide blurDataURL yourself."; Osmani, Pollard — Optimize CLS — https://web.dev/articles/optimize-cls — 2025-02-07 — "Removing the space set aside for elements can cause just as much CLS as inserting content."
- Confidence: high.
- Conflicts: ADR-0008 says "Images are never re-hosted", while `next/image`'s default loader "will write optimized images to disk so subsequent requests can be served faster from the disk cache" (image docs): serving source photos through `/_next/image` keeps copies on our server, and generating `blurDataURL` means downloading them. Needs an owner decision (ADR): `unoptimized` for source photos (served as-is from `src`) or an explicit allowance. Also: the image reference says "In most cases, you should use loading="eager" or fetchPriority="high" instead of preload", while the streaming guide recommends `preload` for an LCP image that sits inside a Suspense boundary, because it starts the fetch in the first chunk; use `preload` only in that case.

### L-4: Reserve space for every block that arrives late, and keep the space when it arrives empty
- Owner example: new (#8 related)
- Why: A streamed section (comparables, «چرا این ارزیابی», price-history chart, duplicates), a map or an embed pushes everything below it when it lands at a different size. `min-height` bounds the shift while still letting the block grow; removing reserved space shifts as much as inserting it.
- How: Put the reservation on the frame that wraps the Suspense boundary: `min-block-size` from a token equal to the typical content height at 412 px, or `aspect-*` for charts and maps. When the section comes back empty («آگهی مشابهی پیدا نشد»), render its empty state inside the same box. Content you cannot size goes below the fold or is overlaid.
- Sources: Next.js team — Streaming (16.3.5) — `…/docs/01-app/02-guides/streaming.md` — 16.3.5 — "Use fixed or min-height containers around Suspense boundaries so the space is reserved before content arrives."; Osmani, Pollard — Optimize CLS — https://web.dev/articles/optimize-cls — 2025-02-07 — "Using min-height, as suggested previously, allows the parent element to grow as necessary while reducing the impact of layout shifts"; Remix team — Pending and Optimistic UI — https://v2.remix.run/docs/discussion/pending-ui/ — 2025-06-06 — "Consistent Size: Ensure that the skeleton fallbacks match the dimensions of the actual content."
- Confidence: high.
- Conflicts: none.

### L-5: Insert new content only on the person's tap, and reserve its space within 500 ms of that tap
- Owner example: new
- Why: Shifts within 500 ms of a discrete input (tap, click, key) are treated as expected and excluded; shifts later than that, and any shift during scrolling or hover, count. A «نمایش بیشتر» that appends rows 900 ms after the tap moves the visible button: a counted shift.
- How: «نمایش بیشتر»: on tap, render the new rows' skeletons immediately where the rows will go (the button moves now, inside the window), then fill them. Saved-search updates while someone reads: never inject rows at the top; show an overlaid pill «۳ آگهی تازه» and insert on tap. Hover (desktop) never changes layout. Toasts, banners and the Telegram hand-off prompt are overlays (`position: fixed`), not in flow.
- Sources: Mihajlija, Walton — CLS — https://web.dev/articles/cls — 2023-04-12 — "Layout shifts that occur within 500 milliseconds of user input will have the hadRecentInput flag set, so they can be excluded from calculations." and "it's best to create some space right away and show a loading indicator to avoid an unpleasant layout shift when the request completes."; Osmani, Pollard — Optimize CLS — https://web.dev/articles/optimize-cls — 2025-02-07 — "reserving the expected space within that 500 millisecond timeframe and taking the impact of any future shift up front" and "Have the user initiate the load of new content, so they are not surprised by the shift" and "ensure the element is not part of the document flow by overlaying the content where this makes sense."
- Confidence: high.
- Conflicts: none; `listing-patterns.md` already prefers «نمایش بیشتر» over infinite scroll. Add the immediate skeleton rows.

### L-6: Move and resize with `transform` only; layout properties shift neighbours, a transform never counts
- Owner example: new
- Why: The Layout Instability spec compares a node's starting point both with and without transforms, so a transform-only change is never a shift, while `top`/`left`/`width`/`height`/margin changes move other elements.
- How: sheets, badges, press feedback and toasts use `translate`/`scale`/`opacity` with the motion tokens. Height reveals (`grid-template-rows: 0fr → 1fr`, `motion.md`) change layout and are fine only as a direct response to a tap.
- RTL/Farsi: the spec measures from the "flow-relative starting corner", which in RTL is the top-right. An element that widens toward the left does not shift itself but pushes its inline-end (left-hand) neighbours, so put variable-width items (a price, a count) at the inline end of a row or give them a fixed width.
- Sources: WICG — Layout Instability API — https://wicg.github.io/layout-instability/ — living — "to ensure that a node is not made unstable solely due to a transform change." and "the flow-relative starting corner of the first fragment of the principal box of N"; Osmani, Pollard — Optimize CLS — https://web.dev/articles/optimize-cls — 2025-02-07 — "Composited animations using translate can't impact other elements, and so don't count toward CLS."; Mihajlija, Walton — CLS — https://web.dev/articles/cls — 2023-04-12 — "CSS transform property lets you animate elements without triggering layout shifts"
- Confidence: high; the RTL corollary is medium (spec plus inference).
- Conflicts: none.

### L-7: Keep text boxes the same size when state changes: pending buttons keep their label, message lines are reserved, client-only text has a fixed box, no autofocus on phones
- Owner example: new (#11 related)
- Why: A label swap («ذخیره» → «در حال ذخیره…») resizes the button and shifts its siblings; an error line appearing under a field after an async check pushes the form; a date or number re-rendered differently after hydration changes width; an autofocused field opens the phone keyboard and resizes the viewport.
- How: Pending: keep the label, show the spinner in a slot that is always rendered with a fixed `size-*` and toggled by `opacity`; keep `aria-disabled` (our rule). Field messages: the message element is always rendered with `min-block-lh` (Tailwind 4.3.3: `min-block-size: 1lh`). Numbers and dates are formatted on the server (`persian-type-formatting.md`), so hydration never re-renders them; a client-only relative time («۳ دقیقه پیش») gets a fixed box or a same-size Suspense fallback. No `autoFocus` on phones on page load.
- Sources: Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — read 2026-09-26 — "Show a loading indicator & keep the original label." and "Rarely autofocus on mobile because the keyboard opening can cause layout shift."; Next.js team — `useLinkStatus` (16.3.5) — `…/03-api-reference/04-functions/use-link-status.md` — 16.3.5 — "Inline indicators can easily introduce layout shifts. Prefer a fixed-size, always-rendered hint element and toggle its opacity, or use an animation."; MDN — `<length>` — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length — 2026 — "Equal to the computed value of the line-height property of the element on which it is used"
- Confidence: high for the label and indicator slot; medium for the reserved message line (web.dev's 500 ms rule plus inference).
- Conflicts: `react-patterns/references/data-and-actions.md` §4 `SaveButton` renders `{pending ? 'در حال ذخیره…' : 'ذخیره'}`, which contradicts `states-a11y.md` ("pending buttons keep their label and width") and Vercel. Next's own single-page-apps example also swaps labels (`'Deleting…'`). Fix §4.

### L-8: Put `scrollbar-gutter: stable` on the root so desktop pages do not jump sideways
- Owner example: new
- Why: Classic (non-overlay) scrollbars take space only while the page overflows: a results page that grows past the viewport, or a dialog that locks scrolling with `overflow: hidden`, adds or removes the gutter and moves the whole page horizontally. Phones use overlay scrollbars, so this is the 1440 px case.
- How: `<html lang="fa" dir="rtl" className="scrollbar-gutter-stable">` (Tailwind 4.3.3 utility) or `html { scrollbar-gutter: stable; }` in `globals.css`. Baseline since December 2024.
- RTL/Farsi: the gutter sits on whichever inline edge the browser puts the scrollbar; no physical property is involved.
- Sources: MDN — scrollbar-gutter — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter — 2026-04-20 — "When using classic scrollbars, the gutter will be present if overflow is auto, scroll, or hidden even if the box is not overflowing." and "When using overlay scrollbars, the gutter will not be present."
- Confidence: high (official reference).
- Conflicts: none.

### L-9: For the Persian web font, do not trust the automatic fallback: use `display: 'optional'` for body text, or measure a tuned fallback
- Owner example: new
- Why: Swapping fonts reflows text (both FOUT and FOIT). `next/font/local` defaults to `display: 'swap'` and `adjustFontFallback: 'Arial'`; in 16.3.5 the fallback metrics are computed from the Latin a–z average width only (the source says so) and applied to `local("Arial")`, which does not exist on Android. Persian glyphs differ from Latin, so line breaks change on the swap regardless.
- How: (a CS-3 decision) body text `display: 'optional'` (no swap ever; a first visit may render the system font, later visits the cached web font), or `swap` with `preload: true` and per-platform fallback faces tuned on Persian sample text. Decide by measurement: delay the font response with `page.route` in the `mobile` project and read layout shift (L-1) for `adjustFontFallback: 'Arial'`, `false`, and a hand-tuned face. Keep a Persian-capable family at the end of the stack (today `--font-sans: Vazirmatn, 'Noto Sans Arabic', Tahoma, system-ui, sans-serif`). A fixed `line-height` does not fix swap reflow; our 1.7 is for readability.
- RTL/Farsi: the whole tip.
- Sources: Osmani, Pollard — Optimize CLS — https://web.dev/articles/optimize-cls — 2025-02-07 — "font-display: optional can avoid a re-layout as the web font is only used if it is available by the time of initial layout."; Hempenius — Best practices for fonts — https://web.dev/articles/font-best-practices — 2022-10-04 — "text render is delayed for no longer than 100ms and there's assurance that there isn't font-swap related layout shifts" and "Use font-display: optional for fonts used in body text."; Hempenius — Improved font fallbacks — https://developer.chrome.com/blog/font-fallbacks — 2023-02-10 — "neither of these fonts is available on Android (Roboto is the only system font on Android)." and "line-height can sometimes be successfully used to reduce or eliminate font-related layout shifts—this practice is not recommended."; Next.js team — `next/font` (16.3.5) — `…/03-api-reference/02-components/font.md` — 16.3.5 — "The possible values are 'Arial', 'Times New Roman' or false. The default is 'Arial'."; Next.js source — `get-fallback-metrics-from-font-file.js` — 16.3.5 — "TODO: Currently only works for the latin alphabet."
- Confidence: high for the mechanism; medium for the Persian consequence (source code and the Chrome note, not yet measured).
- Conflicts: the Next font docs promise "you can optimally load web fonts with no layout shift"; for Persian text with the automatic fallback the installed code does not support that claim. `persian-type-formatting.md` does not choose a `font-display` strategy yet.

### L-10: Long result lists get `content-visibility: auto` with `contain-intrinsic-size: auto <row height>`, defined once as a utility
- Owner example: new
- Why: Skipping rendering for off-screen rows keeps appended pages cheap on low-end Android; the `auto` keyword remembers each row's rendered size, so scrolling back does not return to the placeholder size and make the scrollbar jitter.
- How: `@utility row-lazy { content-visibility: auto; contain-intrinsic-size: auto var(--size-listing-row); }` in `globals.css` (Tailwind 4.3.3 has no utility for it, and a bracket class would bypass tokens); apply it to rows after the first page. Baseline newly available 2025-09-15. With 15–30 rows per page (`listing-patterns.md`) it matters after a few «نمایش بیشتر» taps. Off-screen rows stay in the accessibility tree.
- Sources: Kravets, Levin — content-visibility — https://web.dev/articles/content-visibility — 2025-09-23 — "The auto keyword for contain-intrinsic-size causes the browser will remember the last-rendered size, if any, and use that instead of the developer-provided placeholder size." and "the off-screen content remains available in the document object model and therefore, the accessibility tree"; Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "Virtualize large lists e.g., virtua or content-visibility: auto."
- Confidence: high.
- Conflicts: none.

### L-11: Numbers that change in place get `tabular-nums` and a box sized for their widest value
- Owner example: #11 (confirmed and sharpened)
- Why: Proportional digits change width as the value changes and push neighbours. Tabular figures equalise digit widths only: a value that gains a digit or a separator («۹۵٬۰۰۰» → «۱۰۰٬۰۰۰») still grows, and the readable price form can change words («۹۵۰ میلیون» → «۱ میلیارد»).
- How: `tabular-nums` on the filter sheet's «نمایش ۱۲۸ آگهی» count, the threshold stepper's `<output>`, the OTP resend countdown, the saved-count badge, price-history axes and comparison tables; plus a `min-inline-size` token measured on the widest expected value. Static prices in result rows do not change, so there it only aligns columns. Whether the chosen Persian font has tabular Persian digits is the Persian typography pass's question (`persian-type-formatting.md` says `tabular-nums` survives in the Vazirmatn subsets); verify by measuring «۱۱۱» against «۸۸۸». Do not count-up animate data (`motion.md`); if a change must move, fade or translate the whole number inside its fixed box.
- RTL/Farsi: `ch` is the width of the Latin «0», not «۰»; do not size Persian-digit boxes in `ch` without measuring (inference).
- Sources: MDN — font-variant-numeric — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric — 2026-09-10 — "activating the set of figures where numbers are all of the same size, allowing them to be easily aligned like in tables."; Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "Use font-variant-numeric: tabular-nums or a monospace like Geist Mono."; Krehel — make-interfaces-feel-better, typography.md — https://github.com/jakubkrehel/make-interfaces-feel-better — commit 35545ea — "use tabular-nums to make all digits equal width. This prevents layout shift as values change."
- Confidence: high for `tabular-nums`; low for the reserved-width specifics (inference).
- Conflicts: `data-and-actions.md` §5 renders `<output aria-live="polite">{formatCount(shownLimit)}</output>` with neither `tabular-nums` nor a reserved width, so the − and + buttons move when the digit count changes.

### L-12: Answer every tap within 100 ms, show nothing extra under about 1 s, a looped indicator up to 10 s, and step progress with a cancel beyond 10 s
- Owner example: new
- Why: 0.1 s is the limit for feeling in direct control, 1 s for keeping the flow of thought, 10 s for keeping attention. An indicator for a sub-second wait is a distracting flash.
- How: within 100 ms: `:active` press state, optimistic state, the chip highlights. 1 to 10 s: a skeleton for a view, a spinner or dimming for a module. Over 10 s (a valuation with AI steps, a pasted-link import): named steps with progress («در حال پیدا کردن آگهی‌های مشابه… ۲ از ۴») and «لغو». Server mutations target under 500 ms.
- Sources: Nielsen — Response Times: The 3 Important Limits — https://www.nngroup.com/articles/response-times-3-important-limits/ — 1993/2014 — "0.1 second is about the limit for having the user feel that the system is reacting instantaneously" and "Anything slower than 10 seconds needs a percent-done indicator as well as a clearly signposted way for the user to interrupt the operation."; Sherwin — Progress Indicators — https://www.nngroup.com/articles/progress-indicators/ — 2014-10-26 — "it is distracting to use a looped animation, because users cannot keep up with what happened"; Tankala — Skeleton Screens 101 — https://www.nngroup.com/articles/skeleton-screens/ — 2023-06-04 — "If a page takes less than 1 second to load, skeleton screens or spinners aren't necessary"; Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "POST/PATCH/DELETE complete in <500ms."
- Confidence: high.
- Conflicts: `states-a11y.md` already encodes the bands; this adds the cancel and the named steps.

### L-13: Delay pending indicators and give them a minimum on-screen time; do the delay in CSS, never a bare `isPending ? <Spinner />`
- Owner example: new (#8 related)
- Why: A spinner shown at 0 ms flashes on fast responses; one shown at 200 ms and removed at 210 ms flickers.
- How: The sources agree on the mechanism, not the numbers: Vercel show-delay ~150–300 ms and minimum ~300–500 ms; `spin-delay` defaults 500/200; the Epic Stack uses 400/300; Next's link hint fades in after 100 ms; react.dev dims stale content after 200 ms. Proposed tokens for CS-3: `--transition-delay-pending: 400ms` (spinners, skeleton appearance), `--transition-delay-stale: 200ms` (dimming), minimum visible 300 ms for spinners in client components. Tailwind 4.3.3 reads `delay-*` from `--transition-delay-*`, so these become `delay-pending` and `delay-stale`. In CSS: the indicator is always rendered, fades in with the delay when `[data-pending]` is present, and disappears without delay. A true minimum duration needs timers (a small hook with an effect, or `spin-delay`, a dependency decision under ADR-0003). A streamed fallback that is part of the prerendered shell cannot be delayed by React; a CSS `animation-delay` fade-in hides grey boxes from fast streams while the space stays reserved (inference).
- Sources: Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "add a short show-delay (~150–300 ms) & a minimum visible time (~300–500 ms) to avoid flicker on fast responses."; Meijer — spin-delay README — https://github.com/smeijer/spin-delay — 2024-08-16 — "what happens when the request takes 210ms? Right, we see a spinner for 10ms. This flicker can be annoying."; Dodds — Epic Stack `useDelayedIsPending` — https://github.com/epicweb-dev/epic-stack/blob/main/app/utils/misc.tsx — main, 2026-09-26 — "This avoids a flash of loading state regardless of how fast or slow the request is."; Next.js team — `useLinkStatus` (16.3.5) — `…/use-link-status.md` — 16.3.5 — "add an initial animation delay (e.g. 100ms) and start the animation as invisible (e.g. opacity: 0)."
- Confidence: medium (agreement on mechanism, spread of numbers).
- Conflicts: Vercel adds "The <Suspense> component in React does this automatically." React's docs say otherwise: newly rendered boundaries "still immediately display fallbacks"; React only throttles reveals to one per 300 ms. `states-a11y.md` ("Under 1 s show nothing") cannot hold for a skeleton that is prerendered into the shell. The caller's brief attributes `spin-delay` to Kent C. Dodds's team; its author is Stephan Meijer, with Dodds as a contributor and user.

### L-14: Updates keep the old content on screen: run them in a transition and dim the stale part instead of swapping in a skeleton
- Owner example: new (bounds #8)
- Why: Replacing visible results with a fallback is jarring and loses the reader's place. Transitions keep already revealed content until the new content is ready, and the App Router already dispatches every navigation inside `startTransition`.
- How: Filter chips (URL updates): the chip group calls `router.push` inside its own `startTransition`, shows the chosen chip with `useOptimistic`, and exposes a pending flag as `data-pending`; the results wrapper uses `transition-opacity group-has-data-pending:opacity-50 group-has-data-pending:delay-stale`, so it dims after 200 ms and undims at once; the new count is announced politely when it lands. Search-as-you-type in the make and model lists: `useDeferredValue` plus the same dimming. Debounce only the network request, never rendering.
- Sources: React team — useTransition — https://react.dev/reference/react/useTransition — living — "Hiding the entire tab container to show a loading indicator leads to a jarring user experience."; React team — Suspense — https://react.dev/reference/react/Suspense — living — "During a Transition, React avoids hiding already revealed content."; React team — useDeferredValue — https://react.dev/reference/react/useDeferredValue — living — `transition: isStale ? 'opacity 0.2s 0.2s linear' : 'opacity 0s 0s linear'` and "If the work you're optimizing doesn't happen during rendering, debouncing and throttling are still useful."; Next.js team — Building interactive apps (16.3.5) — `…/02-guides/interactive-apps.md` — 16.3.5 — "to dim while the transition runs, without replacing the board with a skeleton."; Next.js source — `app-router-instance.js` — 16.3.5 — (`push`/`replace` wrap `dispatchNavigateAction` in `startTransition`, no quote).
- Confidence: high.
- Conflicts: Next.js Learn's search chapter keys the boundary (`<Suspense key={query + currentPage}>`) so every search shows a skeleton; the 16.3 guide dims instead. Remix lists "URL Change" under busy indicators; dimming the results is that busy indicator, so the two agree once the control (optimistic) and the results (busy) are treated separately.

### L-15: Decide per boundary whether new data is "different content" (reset with `key`) or "the same view refined" (keep and dim)
- Owner example: new
- Why: React resets a boundary when its key changes; otherwise a transition keeps the old content. In 16.3.5 the layout router builds each segment's state key without search parameters, so a `?make=` change keeps the same tree (old results stay while the new ones load), while a new `[id]` remounts the page (its fallbacks show) and the previous route stays hidden in `<Activity>`.
- How: Results and filters: no key (L-14). A different listing: nothing to add, the param change remounts. If a skeleton on every filter change is ever wanted, key the boundary with a stable serialisation of the parsed filters, not the raw query string (parameter order would reset it needlessly). Lock the observed behaviour with an e2e test before relying on it, since it is not documented.
- Sources: React team — Suspense — https://react.dev/reference/react/Suspense — living — "The key can go on the boundary itself or on a component above it."; Next.js source — `client/components/layout-router.js` — 16.3.5 — `createRouterCacheKey(activeSegment, true) // no search params`; Next.js Learn — Adding Search and Pagination — https://nextjs.org/learn/dashboard-app/adding-search-and-pagination — living — (`key={query + currentPage}` example, no prose quote).
- Confidence: medium (React behaviour is documented; the Next keying is read from source).
- Conflicts: as L-14.

### L-16: Make client navigations instant: a prefetchable shell for every route, boundaries below the shared layout, and a link hint only where a navigation can still block
- Owner example: new
- Why: A navigation is instant only when the destination's static and cached content and its fallbacks are available on click, and a client navigation re-renders only below the layout both routes share, so a boundary above it cannot help. With our config (`cacheComponents` on, `partialPrefetching` off) `<Link>` prefetches a dynamic route only down to the nearest `loading.js`; component-level Suspense fallbacks are not prefetched.
- How: Option A (evaluate first): `partialPrefetching: true`, one App Shell per route shared by every link to it (thirty listing cards cost one prefetch). Option B: `loading.tsx` on dynamic routes (a full-page skeleton on client navigation). Where prefetch stays off, put a `useLinkStatus` hint inside the card's link: fixed size, always rendered, fading in after 100 ms. Inspect shells with the Next DevTools Navigation Inspector; `@next/playwright`'s `instant()` can lock them in tests (a new dev dependency: decide first).
- Sources: Next.js team — Ensuring instant navigations (16.3.5) — `…/02-guides/instant-navigation.md` — 16.3.5 — "Client navigations only re-render below the layout the current and destination routes share"; Next.js team — Prefetching (16.3.5) — `…/02-guides/prefetching.md` — 16.3.5 — "Any number of links to the same route reuse that one shell, fetched once as the first link enters the viewport"; Next.js team — `<Link>` (16.3.5) — `…/03-api-reference/02-components/link.md` — 16.3.5 — "For dynamic routes, the partial route down to the nearest segment with a loading.js boundary will be prefetched."; Next.js team — `useLinkStatus` — 16.3.5 — "The hook is most useful when prefetch={false} is set on the Link component"
- Confidence: high.
- Conflicts: `next-app-router.md` says "`prefetch={false}` on large grids"; under Partial Prefetching the per-link cost argument mostly disappears, and without prefetch the card needs the link hint. Turning on `partialPrefetching` is a config change for the owner.

### L-17: Pre-render what the person will probably open next inside a hidden `<Activity>`
- Owner example: new
- Why: Hidden Activity children render at lower priority and read their Suspense data in advance, so opening a drawer or tab shows content, not a skeleton. Next also keeps the last three routes hidden in Activity, so Back to the results is instant with DOM and scroll intact.
- How: On the listing page, the comparables drawer, the «چرا این ارزیابی» details or a second gallery tab: the Server Component starts the read and passes the promise; the client leaf wraps the panel in `<Activity mode={open ? 'visible' : 'hidden'}>` and reads the promise with `use()` under Suspense. Only Suspense-activating reads prefetch (not effects). `Activity` is exported by React 19.2.8.
- Sources: React team — Activity — https://react.dev/reference/react/Activity — living — "This pre-rendering allows the children to load any code or data they need ahead of time"; Next.js team — Preserving UI state (16.3.5) — `…/02-guides/preserving-ui-state.md` — 16.3.5 — "Next.js preserves up to 3 routes." and "Hidden boundaries render at lower priority."; Osmani, Pollard — Optimize CLS — https://web.dev/articles/optimize-cls — 2025-02-07 — "the fully loaded page is instantly available—without any shifts which may be normally seen during load"
- Confidence: high.
- Conflicts: none; `react.md` already recommends Activity for state that must survive, not yet for prefetching.

### L-18: Keep the LCP element and the page's main content out of fallbacks
- Owner example: new (bounds #8)
- Why: An element inside a Suspense boundary cannot paint until the boundary streams and its swap script runs; a fallback over the main content also hides it from HTML-only crawlers.
- How: On the listing page the title, price, deal badge and market value come from cached reads (`'use cache'` with a tag), so they are in the shell; the first photo is the LCP candidate (L-3). Only secondary modules stream behind skeletons. Do not add boundaries you do not need: under a slow network or CPU React may use them.
- Sources: Next.js team — Streaming (16.3.5) — `…/02-guides/streaming.md` — 16.3.5 — "Keep LCP elements outside or above Suspense boundaries so they render as part of the static shell." and "if there's a Suspense boundary, React might use it."; Remix team — Pending and Optimistic UI — https://v2.remix.run/docs/discussion/pending-ui/ — 2025-06-06 — "Avoid using fallbacks for essential information—the main content of the page."
- Confidence: high.
- Conflicts: none (see L-3 for `preload` versus `loading="eager"`).

### L-19: Use a skeleton only for the first load of a view or section during a page load; nothing under about 1 s, dimming for updates, step progress for processes
- Owner example: #8 (confirmed, with limits)
- Why: NN/g supports skeletons for full-page loads under 10 s, not for sub-second loads, not for processes, and never frame-only. Viget's test found a skeleton perceived as slower than a spinner in an unfamiliar interface, and Roselli calls skeletons an accessibility anti-pattern. The evidence supports a skeleton as a structural preview of a real layout, not as decoration.
- How: Yes: the first load of search results, secondary listing-page modules, the model page's trend. No: filter changes (L-14), anything reliably cached under ~1 s, the valuation and link import (L-12), failed loads (error state), frame-only placeholders (header and footer around a blank page).
- Sources: Tankala — Skeleton Screens 101 — https://www.nngroup.com/articles/skeleton-screens/ — 2023-06-04 — "This specific type of progress indicator is used exclusively for full-page loads." and "it does not make sense (and could even be confusing) to show a skeleton screen"; Faulkner, Olvera — A Bone to Pick with Skeleton Screens — https://www.viget.com/articles/a-bone-to-pick-with-skeleton-screens/ — 2017-10-19 — "the skeleton screen performed the worst by all metrics." and "Skeleton screens work better in familiar interfaces and can be off-putting in new settings when users don't know what to expect."; Roselli — More Accessible Skeletons — https://adrianroselli.com/2020/11/more-accessible-skeletons.html — 2026-04-14 — "Skeletons are a bit of an anti-pattern."; Wroblewski — Avoid The Spinner — https://www.lukew.com/ff/entry.asp?1797 — 2013-09-17 — "progress indicators by definition call attention to the fact that someone needs to wait."
- Confidence: medium (credible sources disagree on efficacy, agree on scope).
- Conflicts: the owner's #8 treats skeletons as the anti-slop default; Roselli and Viget disagree. NN/g's "exclusively for full-page loads" versus React/Next section fallbacks: sections that stream during a page load are part of that load, so section skeletons stay within NN/g's scope.

### L-20: Build each skeleton from the same layout primitive as its component, in the same module
- Owner example: #8
- Why: A separately written skeleton drifts the day the real component changes. `react-loading-skeleton`'s principle is to give components built-in skeleton states so styles stay in sync; with Server Components the async data component never renders without data, so share the geometry through a frame with slots instead of optional data props.
- How: See "Recommended skeleton abstraction": `ListingCardFrame` owns the layout, gaps, media ratio and reserved lines; `ListingCard` and `ListingCardSkeleton` are two named exports of `listing-card.tsx`, both rendering the frame. No `isLoading` prop anywhere; no static members such as `ListingCard.Skeleton` (they do not survive the server/client boundary).
- Sources: dvtng — react-loading-skeleton README — https://github.com/dvtng/react-loading-skeleton — 3.5.0 — "Instead, make components with built-in skeleton states." and "It keeps styles in sync."; Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "Skeletons mirror final content exactly to avoid layout shift."; Next.js team — Streaming (16.3.5) — `…/02-guides/streaming.md` — 16.3.5 — "Design skeleton fallbacks that match the dimensions of the content they represent."
- Confidence: high that skeletons must mirror the content; medium for the frame-and-slots technique (our adaptation).
- Conflicts: Next.js Learn keeps all skeletons in a separate `skeletons.tsx` that duplicates markup; the 16.3 interactive-apps guide imports `TaskDetailSkeleton` from the same module as `TaskDetail`. Follow the latter.

### L-21: A skeleton text line is one line box of the real text style (`1lh`), not a fixed bar height
- Owner example: #8
- Why: Persian body text at 16 px and line height 1.7 has a 27.2 px line box; a common skeleton of 16 px bars with 8 px gaps is 24 px per line, so a three-line placeholder is about 9.6 px short and the page jumps on reveal (arithmetic, inference).
- How: Each placeholder line is `block-lh` (Tailwind 4.3.3: `block-size: 1lh`) inside an element carrying the real text's classes, with the bar centred in it; text that may wrap reserves its lines (a title clamped to two lines reserves `2lh` even when it fits one). `lh` is Baseline widely available (2026-05-21). `react-loading-skeleton` reaches the same result by putting a zero-width non-joiner inside an inline span.
- RTL/Farsi: shorter bars sit at the inline start (right) by themselves in block layout; do not add `ms-auto`/`me-auto`. Because the line box follows the line-height token, a later change to Persian line heights by the typography pass carries over automatically.
- Sources: MDN — `<length>` — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length — 2026 — "Equal to the computed value of the line-height property of the element on which it is used, converted to an absolute length."; dvtng — react-loading-skeleton `Skeleton.tsx` — https://github.com/dvtng/react-loading-skeleton/blob/master/src/Skeleton.tsx — 3.5.0 — (renders `&zwnj;` inside each skeleton span, no prose quote); Tailwind CSS 4.3.3 as installed — (`block-lh`, `min-block-lh`, `h-lh`, no quote).
- Confidence: medium.
- Conflicts: none.

### L-22: The skeleton's count and shape copy the first screen of the real result, and its box does not collapse when fewer results arrive
- Owner example: #8
- Why: Twelve skeleton rows followed by two results pull the footer up (a shift); two rows followed by thirty push it down.
- How: As many rows as fill the first screen at 412 × 915 under the header (measure once CS-3 fixes the row height), with fixed keys (`['row-1', …, 'row-5']`; the lint rejects index keys). Zero or few results: render the empty state inside the same min-height frame.
- Sources: Osmani, Pollard — Optimize CLS — https://web.dev/articles/optimize-cls — 2025-02-07 — "Removing the space set aside for elements can cause just as much CLS as inserting content."; Tankala — Skeleton Screens 101 — https://www.nngroup.com/articles/skeleton-screens/ — 2023-06-04 — "The structure of the gray boxes mimics the structure of the final page with content."
- Confidence: low (inference beyond the principle).
- Conflicts: none.

### L-23: Shimmer is subtle, travels right to left, is off under reduced motion, and ends within five seconds
- Owner example: #8
- Why: Animated skeletons say "working" but can distract and cause accessibility problems. WCAG 2.2.2 requires a way to stop motion that starts automatically, lasts over five seconds and runs beside other content; the loading exemption applies only when interaction cannot happen during that phase, and a section skeleton shares the page with usable content. Forward progress follows the reading direction.
- How: Keyframes in `globals.css` (the app is right-to-left only and `rtl:` variants are linted out): the highlight moves from `translate: 100%` to `-100%`, 1.5 s, `animation-iteration-count: 3` (4.5 s), only inside `@media (prefers-reduced-motion: no-preference)`; otherwise a static block. A static block plus the delayed appearance of L-13 is an acceptable default.
- RTL/Farsi: direction as above; NN/g's example shimmer moves left to right, which is the LTR case.
- Sources: Tankala — Skeleton Screens 101 — https://www.nngroup.com/articles/skeleton-screens/ — 2023-06-04 — "animations of this sort can potentially be distracting, annoying, or even create accessibility problems for some users."; Apple — HIG, Right to left — https://developer.apple.com/design/human-interface-guidelines/right-to-left — 2026-09-26 — "people tend to view forward progress as moving in the same direction as the language they read"; W3C — WCAG 2.2 SC 2.2.2 — https://github.com/w3c/wcag/blob/main/guidelines/sc/20/pause-stop-hide.html — 2024-12-12 — "(1) starts automatically, (2) lasts more than five seconds, and (3) is presented in parallel with other content" and "can be considered essential if interaction cannot occur during that phase for all users"; Roselli — More Accessible Skeletons — https://adrianroselli.com/2020/11/more-accessible-skeletons.html — 2026-04-14 — "I also adjusted the animation to stop after 5 seconds, in order to comply with WCAG Success Criterion 2.2.2 Pause, Stop, Hide."
- Confidence: medium (the direction is by analogy with progress indicators; the WCAG part is high).
- Conflicts: `motion.md` already has the right-to-left shimmer; it lacks the five-second stop. Its "reduce, not remove" rule is met here by the static block that remains.

### L-24: Skeleton shapes are hidden from assistive technology; one status sentence says what is loading, and the result is announced once
- Owner example: #8
- Why: Few screen readers honour `aria-busy`; a skeleton of empty elements is noise or nothing, and a Suspense swap announces nothing.
- How: The skeleton container is `aria-hidden="true"`; the fallback contains one visually hidden `role="status"` sentence («در حال بارگذاری آگهی‌ها…») that disappears with it. After a filter update, the results heading («۱۲۸ آگهی») sits in a polite live region. `aria-busy` on the list during transitions is harmless but not relied on. `cursor: progress` on desktop.
- Sources: Roselli — More Accessible Skeletons — https://adrianroselli.com/2020/11/more-accessible-skeletons.html — 2026-04-14 — "Except few screen readers honor aria-busy="true"." and "Most skeletons have terrible contrast."; MDN — aria-busy — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy — 2025-06-23 — "This prevents assistive technologies from announcing changes before updates are done."
- Confidence: medium.
- Conflicts: Roselli treats skeleton shapes as state indicators that need 3:1 contrast (SC 1.4.11); typical skeletons are far subtler. Our reading: with a text status present the shapes are decorative, so 3:1 is not required. The owner or CS-3 decides.

### L-25: Put Suspense boundaries where the designed loading sequence has steps, not around every component
- Owner example: #8
- Why: Each boundary is a possible pop-in; React reveals at most once per 300 ms and, since 19.2, batches streamed reveals; independent pops look jarring.
- How: Listing page: one boundary for the secondary column (comparables and price history appear together), one for duplicates; results page: one boundary for the list; never one per card. Every boundary has an error partner (`catchError`) whose fallback fits the same box.
- Sources: React team — Suspense — https://react.dev/reference/react/Suspense — living — "Suspense boundaries should not be more granular than the loading sequence that you want the user to experience." and "React reveals suspended content at most once every 300ms, measured from the last reveal."; React team — React 19.2 — https://react.dev/blog/2025/10/01/react-19-2 — 2025-10-01 — "React will batch reveals of server-rendered Suspense boundaries for a short time, to allow more content to be revealed together"; Next.js Learn — Streaming — https://nextjs.org/learn/dashboard-app/streaming — living — "this could lead to a popping effect as the cards load in, this can be visually jarring for the user."
- Confidence: high. (The 300 ms constant is `FALLBACK_THROTTLE_MS = 300` in both React DOM 19.2.8 and the vendored 19.3 canary.)
- Conflicts: none; `react.md` states the rule without the 300 ms fact.

### L-26: Use `loading.tsx` only where nothing meaningful renders without data; elsewhere, Suspense next to the data
- Owner example: #8
- Why: `loading.js` wraps the whole page: placed high, it catches every dynamic access and the page falls back to one full skeleton. It does not cover the same segment's layout. Under Cache Components the shell already holds the static content that a page-wide fallback would hide.
- How: Prefer cached reads plus component boundaries; add `loading.tsx` only to a route that cannot show anything without its data, or as L-16's option B; scope it to one page with a route group when siblings should not inherit it.
- Sources: Next.js team — Streaming (16.3.5) — `…/02-guides/streaming.md` — 16.3.5 — "loading.js is useful when there's nothing meaningful to show until the page's data resolves." and "now the entire page falls back to a full-page skeleton instead of streaming granularly."; Next.js team — `loading.js` (16.3.5) — `…/03-file-conventions/loading.md` — 16.3.5 — "It does not wrap the layout.js, template.js, or error.js in the same segment."
- Confidence: high.
- Conflicts: with L-16 option B, a trade-off between a full-page skeleton and a navigation that blocks; Partial Prefetching avoids the choice.

### L-27: Be optimistic only when the next state is predictable, the URL stays, and a failure can be shown and undone
- Owner example: #7
- Why: These are the Remix and React Router criteria; on slow mobile networks perceived speed comes from acting before the server answers (Instagram's likes, Polar's polls), and Linear, built for speed on local data, saves its custom views optimistically.
- How: Optimistic in Carshenas: save or unsave a listing, switch a saved search's alert on or off, the price threshold the person typed, hide a listing, rename a saved search, mark as seen, the chosen filter chip (the chip only; the results follow L-14). Keep the optimistic value local to the control (`useOptimistic` over the server prop): we have no client store (ADR-0003), so Linear's sync-engine architecture is not ours to copy.
- Sources: Remix team — Pending and Optimistic UI — https://v2.remix.run/docs/discussion/pending-ui/ — 2025-06-06 — "Next State Predictability: The application can accurately predict the next state of the UI based on the user's action." and "URL Stability: The action does not result in a change of the URL"; React Router team — Pending UI — https://reactrouter.com/start/framework/pending-ui — 8.4 — "When the future state of the UI is known by the form submission data, an optimistic UI can be implemented for instant UX."; Wroblewski — Performing Actions Optimistically — https://www.lukew.com/ff/1759/mobile-design-details-performing-actions-optimistically — 2013-07-29 — "we can actually create the illusion that your action has taken effect when in reality it hasn't yet."; Artman — Rethinking the startup MVP — https://linear.app/now/rethinking-the-startup-mvp-building-a-competitive-product — 2024-02-28 — "It should be as fast as possible (local data storage, no page reloads, available offline)."; Linear — Changelog — https://linear.app/changelog/2023-10-12-triage-responsibility — 2023-10-12 — "Saving and updating custom views is now faster with optimistic behavior."; Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "Update the UI immediately when success is likely; reconcile on server response."
- Confidence: high.
- Conflicts: Remix puts URL changes under busy indicators, while Next's guide makes the filter chip optimistic; resolved as in L-14.

### L-28: Never be optimistic about numbers the server computes, records it creates, or effects that leave the app
- Owner example: #7
- Why: AGENTS.md: every number a user sees comes from the database. A new record's id does not exist yet. A Telegram message cannot be recalled.
- How: Busy indicator (and L-12 progress) for: the valuation, a pasted Divar link import, the result count in the filter sheet, OTP and sign-in, "send a test alert", creating a saved search whose link needs the server id (a pending row «در حال ذخیره…» without id-dependent actions is acceptable). Market value and deal rating are never predicted in the client.
- Sources: Remix team — Pending and Optimistic UI — https://v2.remix.run/docs/discussion/pending-ui/ — 2025-06-06 — "wait for a record to be created instead of using an optimistic UI since things like IDs and other fields are unknown" and "Side Effects: The action triggers side effects that involve critical processes, such as sending email"; AGENTS.md — Conventions, AI steps — repository — 2026 — "Numbers a user sees come from the database, never from model text."
- Confidence: high.
- Conflicts: none; the stepper in `data-and-actions.md` §5 shows the person's own value, which is allowed.

### L-29: Implement with `useOptimistic` inside an Action, read the optimistic value for repeated taps, and flag pending items
- Owner example: #7
- Why: The setter holds only inside an Action (outside one it flashes and reverts); optimistic and real state converge in a single render; reading from the optimistic value makes a quick second tap undo the first instead of repeating it; a flag per item shows which row is still saving.
- How:
  ```tsx
  'use client';
  import { startTransition, useOptimistic, useState } from 'react';
  import { setListingSavedAction } from '@/features/saved-listings/saved-listings-actions';

  export function SaveListingToggle({ listingId, saved }: { listingId: string; saved: boolean }) {
    const [shownSaved, setShownSaved] = useOptimistic(saved);
    const [failure, setFailure] = useState<string | null>(null);

    function handlePress() {
      const nextSaved = !shownSaved; // the optimistic value, so a quick second tap undoes the first
      setFailure(null);
      startTransition(async () => {
        setShownSaved(nextSaved);
        // the target state, not "toggle" (L-31); the action parses, authorises, writes and calls updateTag (L-30)
        const result = await setListingSavedAction({ listingId, saved: nextSaved });
        if (result.status === 'failed') setFailure(result.message); // the heart is already back to `saved`
      });
    }

    return (
      <>
        <button
          type="button"
          aria-pressed={shownSaved}
          aria-label="نشان کردن آگهی"
          onClick={handlePress}
          className="inline-flex size-11 items-center justify-center"
        >
          <HeartIcon filled={shownSaved} />
        </button>
        {/* the page's fixed toast region (an overlay), so the rollback message moves nothing (L-32) */}
        <ToastMessage message={failure} actionLabel="تلاش دوباره" onAction={handlePress} />
      </>
    );
  }
  ```
  For lists (saved searches), use the reducer form `useOptimistic(items, reducer)` with a `pending: true` flag per changed item, and share one pure reducer between the client and the action.
- Sources: React team — useOptimistic — https://react.dev/reference/react/useOptimistic — living — "The set function must be called inside an Action." and "There's no extra render to "clear" the optimistic state." and "Since each optimistic item has its own flag, you can show loading state for individual items."; Next.js team — Building interactive apps (16.3.5) — `…/02-guides/interactive-apps.md` — 16.3.5 — "Reading from optimisticPriority instead of the prop means rapid double-clicks cycle correctly rather than reading a stale closure value."; Next.js team — Single-page applications (16.3.5) — `…/02-guides/single-page-applications.md` — 16.3.5 — "The client passes the same reducer to useOptimistic, so the optimistic update and the server compute the next state identically."
- Confidence: high.
- Conflicts: react.dev's troubleshooting recommends relative updaters (`current + delta`) against stale values; that is for the display, while the server still receives the absolute target (L-31). Compatible.

### L-30: The action's response must carry the new truth: optimistic controls need `updateTag` (or `refresh()`), not stale-while-revalidate
- Owner example: #7
- Why: When the Action ends, `useOptimistic` returns its passthrough value. If the action response carries no re-render, that value is still the old prop, and the heart empties until some later read. `updateTag`, `revalidatePath`, `refresh()`, cookie writes and `redirect` include the re-render in the same response; `revalidateTag(tag, 'max')` does not.
- How: Every action behind an optimistic control calls `updateTag('<entity>:<id>')` (or `refresh()` for uncached reads), or the component renders from the action's returned state. An e2e test: tap the heart, wait for the response, assert it is still filled.
- Sources: Next.js team — Server Actions and Mutations (16.3.5) — `…/02-guides/server-actions.md` — 16.3.5 — "revalidateTag with a stale-while-revalidate profile is the exception" and "does not include a re-render in the action response"; React team — useOptimistic — https://react.dev/reference/react/useOptimistic — living — "It is equal to value unless an Action is pending"
- Confidence: medium (two official docs; the snap-back is our deduction from them).
- Conflicts: `server-actions-data.md` lists `revalidateTag(tag, 'max')` as the general alternative without this exception.

### L-31: Send the target state, not a toggle; make once-only effects idempotent; remember that actions queue
- Owner example: #7
- Why: Optimistic UIs invite fast repeated taps and retries. Next dispatches Server Actions one at a time per client; React queues `useActionState` calls, cancels the rest of the queue when one throws, and batches concurrent Actions, so optimistic values stay until the queue settles. Retrying an ambiguous failure is safe only against an idempotent endpoint.
- How: `setListingSavedAction({ listingId, saved })` (upsert or delete, safe to repeat) instead of `toggleSavedAction`; a once-only effect (a test Telegram alert) carries an idempotency key generated in the event handler (`crypto.randomUUID()`, never during render) and checked on the server; never `Promise.all` Server Actions.
- Sources: Leach — Designing robust and predictable APIs with idempotency — https://stripe.com/blog/idempotency — 2017-02-22 — "they can be called any number of times while guaranteeing that side effects only occur once"; Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "then disable during the in-flight request, show a spinner, & include an idempotency key."; Next.js team — Server Actions and Mutations (16.3.5) — 16.3.5 — "Next.js dispatches Server Actions one at a time per client."; React team — useActionState — https://react.dev/reference/react/useActionState — living — "React queues and executes multiple calls to dispatchAction sequentially." and "If there are multiple ongoing Actions, React batches them together."
- Confidence: high.
- Conflicts: Next's interactive-apps guide cycles a value on the server (`cyclePriority(id)`), which is not safe to repeat; `server-actions-data.md` already prefers setting values. Vercel says "disable" during the request; we keep `aria-disabled` so focus stays.

### L-32: Make the rollback visible, specific and recoverable, without moving the layout
- Owner example: #7
- Why: `useOptimistic` reverts silently; the person must learn what failed and be able to retry. An error inserted into a result row shifts the list.
- How: Expected failures come back as the result union (our rule): the control is already back to the true state, and the message goes to an overlaid toast region with a polite live region and «تلاش دوباره»; in forms, the reserved message line (L-7). Unknown errors throw to the boundary. For a removal from a list the person is looking at, keep the row visible, dimmed and marked «در حال حذف…» until the server confirms, as react.dev's delete example does.
- Sources: React team — useOptimistic — https://react.dev/reference/react/useOptimistic — living — "If the Action throws an error, the Transition still ends, and React renders with whatever value currently is."; Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "On failure, show an error & roll back or provide Undo."
- Confidence: high.
- Conflicts: none; `data-and-actions.md` §5 already renders the action's result, but inline under the stepper, where the new line shifts the form unless reserved.

### L-33: Prefer undo to confirmation for reversible removals, and give undo a second path
- Owner example: #7 (undo side)
- Why: People habituate to confirmation dialogs and click through them; undo removes the risk instead. Confirm only what is irreversible or costly.
- How: Deleting a saved search, unsaving, turning an alert off: act at once (optimistic), soft-delete on the server (restore is an idempotent action), show «جست‌وجوی «پژو ۲۰۶» حذف شد · بازگرداندن» for at least five seconds and while it has focus, and keep a lasting way back (the heart on the listing, a «حذف‌شده‌های اخیر» list), because a disappearing toast is a time limit unless another path exists. Account deletion: a specific confirmation.
- Sources: Raskin — Never Use a Warning When you Mean Undo — https://alistapart.com/article/neveruseawarning/ — 2007-07-21 — "Never use a warning when you mean undo." and "as long as it's possible to habituate to dismissing the message, we'll habituate, and then we'll make mistakes."; Nielsen — Confirmation Dialogs — https://www.nngroup.com/articles/confirmation-dialog/ — 2018-02-18 — "Do not use confirmation dialogs for routine actions."; Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — 2026-09-26 — "Require confirmation or provide Undo with a safe window."; W3C — Understanding SC 2.2.1 — https://github.com/w3c/wcag/blob/main/understanding/20/timing-adjustable.html — 2024-12-12 — "the disappearance of the message does not set a time limit"
- Confidence: high.
- Conflicts: none.

### L-34: Clear transient feedback when Next hides a route
- Owner example: #7
- Why: Under Cache Components, Next hides the previous route in `<Activity>` instead of unmounting it, so a success toast, an undo prompt or an error message held in page state is still there after Back.
- How: Reset transient status in a `useLayoutEffect` cleanup (it runs when the route is hidden) or derive it from the attempt; an unanswered undo simply lapses (the soft delete stays).
- Sources: Next.js team — Preserving UI state (16.3.5) — `…/02-guides/preserving-ui-state.md` — 16.3.5 — "If after submitting you set a status into state to render a feedback message, there's often not a reliable user-initiated event to clear it."
- Confidence: high.
- Conflicts: none.

### L-35: Expose pending state as `data-pending` on the control and style ancestors with `has-data-pending:`, instead of threading `isLoading` props
- Owner example: #7, #8
- Why: Only the control knows its action is pending; a `data-*` attribute lets any ancestor (the card, the results list) dim itself through CSS without lifting state, extra renders or boolean props.
- How: The control sets `data-pending` from `useOptimistic(false)` or `useFormStatus`; the card uses `has-data-pending:opacity-60` and the results wrapper `group-has-data-pending:opacity-50`, with `transition-opacity` and the delay token (never `transition-all`). Avoid broad `:has()` anchors on high-frequency changes (dragging, scrolling).
- Sources: Next.js team — Building interactive apps (16.3.5) — `…/02-guides/interactive-apps.md` — 16.3.5 — "lets ancestor components react through CSS without any coordination." and "Reach for client state instead when a broad :has() anchor toggles on a high-frequency interaction like dragging or scrolling"
- Confidence: high (official doc).
- Conflicts: the same guide's comment card uses `transition-all` and its delete button `disabled`; our motion rule forbids `transition: all` and our actions use `aria-disabled`.

## Recommended skeleton abstraction

**Pattern: a frame with slots, rendered by both the component and its skeleton, colocated in one module, streamed by a Suspense boundary placed where the loading sequence has a step.** It keeps data components total (they always have data), keeps skeleton geometry identical by construction, costs no client JavaScript, and needs no `isLoading` prop.

1. Primitives in `src/components/ui/skeleton.tsx` (Server Components): `SkeletonText` (lines as `1lh` boxes), `SkeletonBlock` (media), and the status sentence. Visual rules live in `globals.css` utilities so components contain only tokens.

   ```tsx
   // src/components/ui/skeleton.tsx: no hooks, no 'use client'
   const LINE_KEYS = ['line-1', 'line-2', 'line-3'] as const; // fixed keys: the lint rejects index keys

   type SkeletonTextProps = { lines?: 1 | 2 | 3; lastLineWidth?: string };

   /** Placeholder text: each line is one line box of the surrounding text style, so it is exactly as tall as the real text. */
   export function SkeletonText({ lines = 1, lastLineWidth = 'w-2/3' }: SkeletonTextProps) {
     return (
       <span aria-hidden="true" className="flex flex-col">
         {LINE_KEYS.slice(0, lines).map((key, position) => (
           <span key={key} className="flex block-lh items-center">
             <span className={`skeleton-bar ${position === lines - 1 ? lastLineWidth : 'w-full'}`} />
           </span>
         ))}
       </span>
     );
   }

   export function SkeletonBlock({ className = '' }: { className?: string }) {
     return <span aria-hidden="true" className={`skeleton-block block ${className}`} />;
   }
   ```

   ```css
   /* globals.css: token names are proposals until CS-3 */
   @utility skeleton-bar {
     display: block;
     block-size: var(--skeleton-bar-size); /* a bar centred inside the 1lh line box */
     border-radius: var(--radius-sm);
     background-color: var(--color-skeleton);
   }
   @utility skeleton-block {
     position: relative;
     overflow: hidden;
     background-color: var(--color-skeleton);
     @media (prefers-reduced-motion: no-preference) {
       &::after {
         content: '';
         position: absolute;
         inset: 0;
         translate: 100% 0;
         background-image: linear-gradient(to left, transparent, var(--color-skeleton-highlight), transparent); /* symmetric */
         /* 3 runs of 1.5 s end before 5 s (WCAG 2.2.2) */
         animation: skeleton-shimmer var(--duration-shimmer) ease-in-out 3;
       }
     }
   }
   @keyframes skeleton-shimmer {
     /* The app is right-to-left only (rtl: variants are linted out): the highlight travels right to left, the reading direction. */
     from { translate: 100% 0; }
     to { translate: -100% 0; }
   }
   @utility skeleton-delayed {
     /* fast streams never flash grey boxes; opacity does not touch layout, so the space stays reserved */
     animation: skeleton-appear var(--duration-popover) ease-out var(--transition-delay-pending) both;
   }
   @keyframes skeleton-appear { from { opacity: 0; } }
   @utility min-block-2lh { min-block-size: 2lh; }
   ```

2. The component, its frame and its skeleton in one module:

   ```tsx
   // src/features/listings/components/listing-card.tsx: Server Component
   import Image from 'next/image';
   import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
   import type { ListingCardView } from '@/features/listings/listings-types';

   type ListingCardSlots = { media: React.ReactNode; title: React.ReactNode; price: React.ReactNode; facts: React.ReactNode };

   /** The card's geometry in one place. ListingCard and ListingCardSkeleton both render it, so they cannot drift. */
   function ListingCardFrame({ media, title, price, facts }: ListingCardSlots) {
     return (
       <div className="flex gap-3 p-3">
         {/* first in source order = right-hand side in RTL: the thumbnail sits on the right */}
         <div className="relative aspect-4/3 w-28 shrink-0 overflow-hidden rounded-md bg-muted">{media}</div>
         <div className="flex min-w-0 flex-1 flex-col gap-1">
           <div className="min-block-2lh text-base font-bold">{title}</div>
           <div className="text-base tabular-nums">{price}</div>
           <div className="text-sm">{facts}</div>
         </div>
       </div>
     );
   }

   export function ListingCard({ listing }: { listing: ListingCardView }) {
     return (
       <ListingCardFrame
         media={listing.photoUrl === null ? <NoPhotoMark /> : <Image src={listing.photoUrl} alt={listing.title} fill sizes="7rem" className="object-cover" />}
         title={<h3 className="line-clamp-2">{listing.title}</h3>}
         price={listing.priceLabel}
         facts={listing.factsLabel}
       />
     );
   }

   export function ListingCardSkeleton() {
     return (
       <ListingCardFrame
         media={<SkeletonBlock className="size-full" />}
         title={<SkeletonText lines={2} />}
         price={<SkeletonText lastLineWidth="w-1/3" />}
         facts={<SkeletonText lastLineWidth="w-1/2" />}
       />
     );
   }
   ```

   The list module follows the same shape: a shared `LIST_CLASS`, `ListingList` rendering `<ol aria-label="نتایج جست‌وجو">`, and `ListingListSkeleton` rendering `<div className="skeleton-delayed">` with one `<p role="status" className="sr-only">در حال بارگذاری آگهی‌ها…</p>` and an `aria-hidden` `<ol>` of five `ListingCardSkeleton` rows keyed `row-1` to `row-5`. The empty state renders inside the same frame.

3. The page keeps the shell static and streams only the list:

   ```tsx
   // src/app/search/page.tsx: not async, so the shell prerenders
   import { Suspense } from 'react';
   import { SearchResults } from '@/features/search/components/search-results';
   import { ListingListSkeleton } from '@/features/listings/components/listing-list';
   import { ResultsErrorBoundary } from '@/features/search/components/results-error-boundary';

   export default function SearchPage({ searchParams }: PageProps<'/search'>) {
     return (
       <main className="flex flex-col gap-4 p-4">
         <h1 className="text-xl font-bold">جست‌وجوی خودرو</h1>
         {/* `group`: the filter chips inside set data-pending; the results dim instead of swapping to the skeleton */}
         <section aria-label="نتایج" className="group flex flex-col gap-3">
           {/* FilterChips (client, reads useSearchParams) sits here under its own Suspense */}
           <ResultsErrorBoundary title="نتایج باز نشد">
             <Suspense fallback={<ListingListSkeleton />}>
               <SearchResults searchParams={searchParams} />
             </Suspense>
           </ResultsErrorBoundary>
         </section>
       </main>
     );
   }
   ```

   `SearchResults` awaits the params, parses the filters, calls a cached query and wraps `ListingList` in `transition-opacity group-has-data-pending:opacity-50 group-has-data-pending:delay-stale`. `ResultsErrorBoundary` is `export const ResultsErrorBoundary = catchError(ResultsErrorFallback)` in a `'use client'` module (Next 16.3 `catchError(Fallback)`, fallback signature `(props, { error, retry })`), and its fallback uses the same min-height frame.

**Trade-offs.** For: geometry is written once and cannot drift; skeletons are Server Components (no client JavaScript); no optional data props or `isLoading` flags; streaming, PPR and transitions work unchanged; error and empty states reuse the same box. Against: one more indirection (a frame with slots) per component; slots must cover every variant; the skeleton row count is a measured guess; the shimmer and delay live in global CSS; React cannot enforce a minimum display time for streamed fallbacks, only its 300 ms reveal throttle and the CSS appearance delay. Rejected alternatives: `react-loading-skeleton`'s built-in states (`{title ?? <Skeleton />}`) need optional data props on a presentational component, which Suspense makes unnecessary and which brings back `isLoading` branching; Next.js Learn's separate `skeletons.tsx` duplicates markup and drifts.

**Evidence for the rubric.** (a) Layout shift is 0 across the first load and a filter change (L-1). (b) Skeleton rows and real rows have equal `getBoundingClientRect().height` at 412 px, within 1 px: capture the fallback with `@next/playwright`'s `instant()` (a dependency decision) or with a delayed fixture read. (c) `getComputedStyle(el).fontVariantNumeric` includes `tabular-nums` on every number that changes in place. (d) Each `img` has a non-zero box while its response is held back with `page.route`. (e) The skeleton's `::after` has no animation under forced reduced motion, and its iteration count is finite.

## Conflicts at a glance

1. `states-a11y.md` "Under 1 s show nothing" cannot hold for prerendered skeletons; sources give show-delays of 100 to 500 ms and minimum times of 200 to 500 ms (L-13).
2. `data-and-actions.md` §4 swaps the button label while pending, against `states-a11y.md` and Vercel (L-7); §5's `<output>` lacks `tabular-nums` and a reserved width (L-11).
3. `next-app-router.md` "`prefetch={false}` on large grids" versus Partial Prefetching's one shell per route (L-16).
4. `server-actions-data.md` offers `revalidateTag(tag, 'max')` without noting that it makes optimistic values snap back (L-30).
5. ADR-0008 "images are never re-hosted" versus the `next/image` optimizer's disk cache and `blurDataURL` generation (L-3).
6. The Next font docs promise no layout shift; the installed fallback metrics are Latin-only and use Arial, which Android lacks (L-9).
7. Vercel says React Suspense applies the loading delay automatically; React's docs say new fallbacks show immediately, with only a 300 ms reveal throttle (L-13).
8. Roselli and Viget question skeletons that the owner's #8 treats as the default; NN/g limits them to page loads (L-19).
9. Next.js Learn forces a skeleton per search with a keyed boundary; the 16.3 guide and React dim stale content (L-14, L-15).
10. Remix puts URL changes under busy indicators; Next makes the filter chip optimistic (L-27).
11. Next's interactive-apps examples use `transition-all`, `disabled` and a non-idempotent server cycle (L-31, L-35).
12. Pollard 2020 (`attr()` stylesheet) versus Archibald 2022 (presentational hint), settled by web.dev's 2025 update (L-2).
13. `next/image`: `loading="eager"`/`fetchPriority` (image reference) versus `preload` for an LCP image inside Suspense (streaming guide) (L-3).
14. Roselli's 3:1 contrast for skeleton shapes versus subtle skeletons with a text status (L-24).
15. The brief's "`spin-delay` by Kent C. Dodds's team": its author is Stephan Meijer; Dodds contributed and uses it in the Epic Stack (L-13).
