# Technology: https://app.cal.com/signup
Captured 2026-09-29T14:12:21.502Z. Every row names its evidence; absence of a row means "not detected", not "not used".
| Category | Technology | Version | Evidence |
| --- | --- | --- | --- |
| ads | Google Ads |  | requests to googleads.g.doubleclick.net, ad.doubleclick.net, stats.g.doubleclick.net; cookie name _gcl_au |
| ads | Meta Pixel |  | window.fbq; requests to connect.facebook.net, www.facebook.com; cookie name _fbp |
| analytics | Google Analytics |  | requests to region1.analytics.google.com; cookie name «redacted» |
| analytics | Google Tag Manager |  | requests to www.googletagmanager.com |
| analytics | Google Tag Manager / dataLayer |  | window.dataLayer |
| bot-protection | Cloudflare bot management (JavaScript detections) |  | requests to /cdn-cgi/challenge-platform/ |
| bot-protection | Cloudflare challenge |  | requests to challenges.cloudflare.com |
| cdn | Cloudflare |  | cf-ray / server header; cookie name __cf_bm |
| framework | Next.js | 16.3.6 | /_next/ assets |
| framework | Next.js App Router (RSC) |  | self.__next_f flight data |
| framework | React | 19.3.0-canary-cbb046ab-20260731 | renderer registered with the DevTools hook |
| hosting | server: cloudflare |  | response header |
| hosting | Vercel |  | x-vercel-* headers |
| hosting | x-powered-by: Next.js |  | response header |
| monitoring | Sentry |  | window.__SENTRY__; requests to o574544.ingest.us.sentry.io |
| protocol | content-encoding: gzip |  | response header |
| security | Cloudflare Turnstile |  | window.turnstile |
| styling | Tailwind CSS |  | --tw-* custom properties |
| support | Intercom |  | window.Intercom; requests to widget.intercom.io, js.intercomcdn.com |

## Page facts
- Main document: HTTP 200, text/html; security headers: CSP false, HSTS true, X-Frame-Options DENY
- Viewport meta: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`; theme colour #f9fafb; manifest yes; service worker controlling the page: false
- Images: 14 `<img>` (0 lazy), 0 `<picture>`, 7 inline SVGs
- Robots: robots.txt has 6 rules for generic agents; this path is allowed

## Globals the site adds to `window`
`__next_f` `TURBOPACK` `NEXT_DEPLOYMENT_ID` `next` `__webpack_hash__` `__SENTRY__` `__sentry_instrumentation_handlers__` `V_C` `_sentryWrappedDepth` `isEmbed` `getEmbedTheme` `getEmbedNamespace` `CalEmbed` `regeneratorRuntime` `__PosthogExtensions__` `dataLayer` `Intercom` `DubAnalytics` `_dubAnalytics` `__intercomAssignLocation` `__intercomReloadLocation` `google_tag_data` `google_tag_manager` `twq` `_linkedin_data_partner_ids` `_already_called_lintrk` `fbq` `_fbq` `oaiq` `gaGlobal` `GooglebQhCsO` `twttr` `lintrk` `ORIBILI` `turnstile`

## Source maps
Not probed. Re-run with `--sourcemaps` to list npm packages from public source maps.
