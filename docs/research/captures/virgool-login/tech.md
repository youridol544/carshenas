# Technology: https://virgool.io/login
Captured 2026-09-29T14:15:51.895Z. Every row names its evidence; absence of a row means "not detected", not "not used".
| Category | Technology | Version | Evidence |
| --- | --- | --- | --- |
| analytics | Cloudflare Web Analytics |  | requests to /cdn-cgi/rum |
| analytics | Google Analytics |  | requests to region1.google-analytics.com; cookie name _ga |
| analytics | Google gtag |  | window.gtag |
| analytics | Google Tag Manager |  | requests to www.googletagmanager.com |
| analytics | Google Tag Manager / dataLayer |  | window.dataLayer |
| bot-protection | Cloudflare bot management (JavaScript detections) |  | requests to /cdn-cgi/challenge-platform/ |
| cdn | Cloudflare |  | cf-ray / server header; cookie name cf_clearance |
| framework | Next.js | 16.3.2 | /_next/ assets |
| framework | Next.js App Router (RSC) |  | self.__next_f flight data |
| framework | React | 19.3.0-canary-cbb046ab-20260731 | renderer registered with the DevTools hook |
| hosting | server: cloudflare |  | response header |
| hosting | x-powered-by: Next.js |  | response header |
| monitoring | Sentry |  | window.__SENTRY__ |
| protocol | content-encoding: br |  | response header |
| styling | CSS Modules |  | 31 Component_name__hash classes |
| styling | Emotion |  | style[data-emotion] |

## Page facts
- Main document: HTTP 200, text/html; security headers: CSP true, HSTS true, X-Frame-Options none
- Viewport meta: `width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1`; theme colour #107ABE; manifest yes; service worker controlling the page: false
- Images: 1 `<img>` (0 lazy), 0 `<picture>`, 3 inline SVGs
- Robots: robots.txt has 5 rules for generic agents; this path is allowed

## Globals the site adds to `window`
`__next_f` `_debugIds` `TURBOPACK` `NEXT_DEPLOYMENT_ID` `next` `__webpack_hash__` `_sentryRouteManifest` `_sentryNextJsVersion` `__SENTRY__` `__sentry_instrumentation_handlers__` `_sentryWrappedDepth` `__cfBeacon` `gtag` `dataLayer` `google_tag_data` `google_tag_manager` `gaGlobal`

## Hosts allowed by the Content-Security-Policy
`files.virgool.io` `*.clarity.ms` `c.bing.com` `countly.virgool.io` `native-removal.triboon.net` `jamssp.yektanet.com` `audience.yektanet.com` `event.yektanet.com` `ua.yektanet.com` `cdn.triboon.net` `*.arcaptcha.co` `*.arcaptcha.ir` `brandon.arcaptcha.co` `vod.virgool.io` `static.cloudflareinsights.com` `sentry.hamravesh.com` `*.analytics.google.com` `*.google-analytics.com` `stats.vstat.ir` `cdn.iframe.ly` `open.iframe.ly` `iframely.com` `geoip-db.com` `sentry.virgool.io` `*.googletagmanager.com` `pagead2.googlesyndication.com` `static.virgool.io` `virgool.io` `cdn.virgool.io` `manifest.json` `partner.googleadservices.com` `tpc.googlesyndication.com` `www.googletagservices.com` `googleads.g.doubleclick.net` `pelikan.media`

## Source maps
Not probed. Re-run with `--sourcemaps` to list npm packages from public source maps.
