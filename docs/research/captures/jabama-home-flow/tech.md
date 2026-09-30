# Technology: https://www.jabama.com/
Captured 2026-09-30T07:56:02.135Z. Every row names its evidence; absence of a row means "not detected", not "not used".
| Category | Technology | Version | Evidence |
| --- | --- | --- | --- |
| data | TanStack Query |  | query globals |
| framework | Next.js | 16.2.12 | /_next/ assets; x-nextjs-* headers |
| framework | Next.js App Router (RSC) |  | self.__next_f flight data |
| framework | React | 19.3.0-canary-3f0b9e61-20260317 | renderer registered with the DevTools hook |
| monitoring | Sentry |  | window.__SENTRY__ |
| protocol | content-encoding: gzip |  | response header |
| styling | Tailwind CSS |  | --tw-* custom properties |

## Page facts
- Main document: HTTP 200, text/html; security headers: CSP true, HSTS true, X-Frame-Options none
- Viewport meta: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=yes, viewport-fit=cover, interactive-widget=resizes-content`; theme colour none; manifest yes; service worker controlling the page: false
- Images: 61 `<img>` (43 lazy), 1 `<picture>`, 80 inline SVGs
- Robots: robots.txt has 0 rules for generic agents; this path is allowed

## Globals the site adds to `window`
`__next_s` `__next_f` `_debugIds` `TURBOPACK` `NEXT_DEPLOYMENT_ID` `next` `__webpack_hash__` `_sentryRouteManifest` `_sentryNextJsVersion` `__SENTRY__` `__sentry_instrumentation_handlers__` `__DEVICE_USER_AGENT__` `__IS_LOGGED_IN__` `_sentryWrappedDepth` `__NuqsAdapterContext` `DOMPurify` `setCookie` `__TANSTACK_QUERY_CLIENT__` `__zod_globalConfig` `__zod_globalRegistry` `yektanetAnalyticsObject` `yektanet` `ynWebpackJsonp` `regeneratorRuntime` `yektanet_ua-script-js2Idqpn_is_loaded` `iframeInjected` `getParameterByName` `adxPageLoaded` `__adexo_sdk_initialized__`

## Hosts allowed by the Content-Security-Policy
`www.jabama.com` `web.bale.ai` `rubika.ir` `*.rubika.ir`

## Source maps
Not probed. Re-run with `--sourcemaps` to list npm packages from public source maps.
