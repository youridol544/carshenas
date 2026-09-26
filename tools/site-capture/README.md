# site-capture

One command turns a public web page into reference material an agent can read: screenshots at phone and desktop widths, the page structure, the design tokens it actually uses, the technology behind it, and the shape of the API calls it makes. A flow script can click through the page and photograph each step. Built on the workspace's Playwright; no other dependencies. Run every command from the repo root: relative paths such as `--distill` resolve against the current directory.

```bash
pnpm capture https://www.cargurus.com/ --name cargurus-home   # phone + desktop, output in .captures/cargurus-home/<timestamp>/
pnpm capture https://example.com/pricing --name example-pricing --viewports mobile,tablet,desktop
pnpm capture https://example.com/search --flow my-flow.mjs    # click through the page, one screenshot per step (Flows, below)
pnpm capture http://127.0.0.1:4173/ --locale fa-IR --timezone Asia/Tehran   # our fixture site (`pnpm fixture` first) or the app on :3000
pnpm capture https://example.com/ --sourcemaps --distill docs/research/captures/example
pnpm capture:test                                  # the tool's own tests, against the fixture site and a local robots.txt site
```

The run prints the summary's header: title, viewports and page heights, the robots.txt verdict, any blocked flow navigation, the stack, hosting, bot-protection signals, fonts, colours, breakpoints and the request count. Then open `summary.md`.

## What you get

| File | Content | Commit it? |
|---|---|---|
| `summary.md` | Headlines and a reading order. Start here. | yes (via `--distill`) |
| `tokens.md` / `.json` | Colours, font stacks, type scale, weights, spacing, gaps, radii, shadows, container widths, motion, with frequencies per viewport; declared custom properties, breakpoints, `@font-face`, container queries, colour functions, and logical vs physical direction properties from the CSS text; component style signatures | yes |
| `tech.md` / `.json` | Framework, styling and UI libraries, data layer, hosting and CDN, third-party services, bot protection signals, each with its evidence; globals the site adds to `window`; CSP hosts; Next.js route table when published; npm packages from public source maps with `--sourcemaps` | yes |
| `api.md` / `.json` | Hosts, request mix, endpoints as `METHOD host/path/:id` patterns with status codes and query **names**, GraphQL operation names, JSON shapes as key names and types | yes |
| `<viewport>-viewport.png`, `-full.png`, `-tile-NN.png`, `-dialog.png`, `components/*.png` | First view before scrolling, full page, readable tiles (the summary says when `--tiles` stops short of the page's end), any modal wall, cropped buttons, inputs, cards and navigation | no |
| `flow-<viewport>-NN-<label>.png` | One screenshot per `step(label)` of a `--flow` script, the label turned into a file-name slug | no |
| `<viewport>-page.html`, `-aria.yml` | Rendered DOM and accessibility tree | no |
| `raw/` (`--raw`, `--har`) | Response bodies, HAR. May hold personal or session data | never |

`.captures/` is gitignored. `--distill <dir>` copies only the first four rows into the repository.

Redaction is by construction, not by filter: reports hold no header, cookie, query or body **values**, no page copy, listing titles or seller names, only names, types, patterns and measurements. A final pass also scrubs anything that looked like a credential during the run, JWT-shaped strings and email addresses. `pnpm capture:test` plants three fake secrets in the fixture and fails if one reaches a report.

## Options

`--name slug` (folder name; default from the URL) · `--out <dir>` (instead of `.captures/`) · `--viewports mobile,tablet,desktop` · `--locale en-US` · `--timezone Area/City` · `--tiles 6` · `--no-scroll` · `--wait 1500` (ms after load) · `--delay 8000` (ms between page loads) · `--timeout 60000` · `--headed` · `--channel chrome` (system Chrome instead of the bundled build) · `--proxy http://host:port` or `socks5://host:port` (SOCKS authentication is not supported by Playwright; run a local forwarder) · `--flow script.mjs` · `--sourcemaps` · `--raw` · `--har` · `--distill <dir>`.

## Flows

`--flow <script.mjs>` runs once per viewport, after the first view, the scroll and any modal wall. Its default export receives Playwright's `page`, the `viewport` name and `step(label)`, which saves `flow-<viewport>-NN-<label>.png` (the label as a file-name slug). Keep flow scripts outside the tracked tree (`.captures/` is gitignored) unless a teardown note should keep one.

```js
// Open the sort menu of a results page and photograph it.
export default async ({ page, step }) => {
  await step('results');
  await page.getByRole('combobox', { name: /sort/i }).click();
  await step('sort open');
};
```

A flow may click, type and open further pages on the same site that robots.txt allows. A navigation to a page robots.txt disallows, or to another site, gets an empty response, so the tab stays where it was, and the summary lists it under "Flow navigations blocked"; if the flow then fails waiting for that page, it ends there and the summary says so. Pop-ups are fenced the same way, except with `--cdp`, where routing the whole browser context would reach into your other tabs. The fence cannot see two things coming: a redirect from an allowed page, and an in-page navigation (a Next.js or Remix link changes the address without loading a document). The tool catches both before the next screenshot and stops the capture rather than photograph the page. On CarGurus, for example, listing pages (`/details/…`) and the saved-cars page are disallowed, so a flow on a results page can open menus and filters but not a listing. A bot challenge, or a 401, 403, 429 or 503 for a page the flow opens, stops the capture as it does anywhere else.

## Boundaries (they are enforced, not just written down)

- **One polite page view per viewport.** No crawling, no pagination, no parallel tabs. Eight seconds between loads by default.
- **robots.txt is respected.** It is read once, before a browser starts, with a plain HTTP client rather than the emulated phone (CarGurus's CDN answers a phone preset's bare request with 406), and matched as RFC 9309 says: the rules for `*`, the longest matching `Allow` or `Disallow` wins. A disallowed path is refused, and so is every path when robots.txt answers anything but a 2xx, 404 or 410, stricter than the RFC, which lets a crawler treat any 4xx as "no rules". A redirect is judged by the robots.txt of the site it lands on. The same rules fence a `--flow`. `--allow-disallowed` exists for sites whose owner permits it.
- **No evasion.** Default browser fingerprint, no stealth plugins, no CAPTCHA solving, no IP rotation. On HTTP 401/403/429/503 or any sign of a challenge the tool stops and says so. Challenges often arrive after the page has loaded, as an overlay on an intact page, so it looks again after loading, after scrolling and at every flow step: a challenge title, a request to a challenge-only host (DataDome's `captcha-delivery.com`, HUMAN's `captcha.px-cdn.net`), or a short page saying access is restricted. A stopped capture is not retried with other flags, user agents, proxies or tools; study that page by hand. A July 2026 US ruling (Reddit v. SerpApi) treats bot detection as a protected access control; working around it is the line not to cross.
- **Logged-in capture needs `--own-account`** together with `--storage-state <file>` or `--cdp <endpoint>`. It means: the account is yours, obtained under the site's terms with accurate information, and those terms allow tools other than a plain browser. Some do not: Divar's terms forbid copying ads at all (ADR-0008). For such sites, browse by hand and take notes, and use public help pages and API documentation for the domain model.
- **Learn, do not lift.** Measurements, patterns and flows are reference material. Images, copy, logos, icons and commercial fonts (a reference site's licensed typefaces, such as IRANYekan) are someone else's property and never enter this repository. Carshenas has its own brand, its own Persian typeface and an RTL layout; pixel parity with a reference site is the wrong goal.

## Attaching to your own Chrome

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.cache/carshenas-capture-profile"   # Chrome 136+ refuses the default profile
pnpm capture https://your-own-site.example/account --cdp http://127.0.0.1:9222 --own-account --viewports desktop
```

The tool opens one tab, captures, closes that tab and disconnects; it never closes your browser. Viewport size is emulated, device pixel ratio and mobile user agent are not. Anything listening on a debug port can drive that browser, so use a dedicated profile and close it afterwards.

## Known limits

Computed styles describe one page in one state: hover, focus and dark mode are not sampled. `var()` aliases survive only in the declared custom properties, not in computed values. Library detection reports what left evidence; absence of a row is not proof of absence. Traffic-derived API shapes cover only what this page requested: no optionality, error shapes or authorization rules. Pages that deliver data as React Server Component payloads inside HTML show few API calls.
