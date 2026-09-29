# Technology: https://torob.com/
Captured 2026-09-29T14:17:33.108Z. Every row names its evidence; absence of a row means "not detected", not "not used".
| Category | Technology | Version | Evidence |
| --- | --- | --- | --- |
| ads | Google Ads |  | requests to stats.g.doubleclick.net |
| analytics | Google Analytics |  | requests to region1.analytics.google.com; cookie name _ga_RWKMFFVXJX |
| analytics | Google gtag |  | window.gtag |
| analytics | Google Tag Manager |  | requests to www.googletagmanager.com |
| analytics | Google Tag Manager / dataLayer |  | window.dataLayer |
| framework | Next.js | 16.2.7 | __NEXT_DATA__ (pages router) |
| framework | React | 19.2.7 | renderer registered with the DevTools hook |
| hosting | server: Torob |  | response header |
| monitoring | Sentry |  | window.__SENTRY__ |
| protocol | content-encoding: gzip |  | response header |
| styling | CSS Modules |  | 70 Component_name__hash classes |

## Page facts
- Main document: HTTP 200, text/html; security headers: CSP true, HSTS true, X-Frame-Options none
- Viewport meta: `width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover`; theme colour #ffffff; manifest yes; service worker controlling the page: false
- Images: 45 `<img>` (20 lazy), 13 `<picture>`, 10 inline SVGs
- Next.js data: page `/`, locale null, runtime config keys: none
- Robots: robots.txt has 1 rule for generic agents; this path is allowed

## Globals the site adds to `window`
`dataLayer` `_sentryDebugIds` `_sentryDebugIdIdentifier` `webpackChunk_N_E` `NEXT_DEPLOYMENT_ID` `__next_set_public_path__` `_sentryRewritesTunnelPath` `SENTRY_RELEASE` `_sentryBasePath` `_sentryNextJsVersion` `_sentryRewriteFramesAssetPrefixPath` `_sentryAssetPrefix` `_sentryExperimentalThirdPartyOriginStackFrames` `_sentryRouteManifest` `__SENTRY__` `next` `__NEXT_DATA__` `__SSG_MANIFEST_CB` `__NEXT_P` `_N_E` `__NEXT_PRELOADREADY` `__MIDDLEWARE_MATCHERS` `__BUILD_MANIFEST` `__SSG_MANIFEST` `_sentryWrappedDepth` `gtag` `google_tag_data` `google_tag_manager` `gaGlobal` `__sentry_instrumentation_handlers__`

## Hosts allowed by the Content-Security-Policy
`assets.torob.com` `tapi.bale.ai` `www.googletagmanager.com` `www.clarity.ms` `scripts.clarity.ms` `posthog.torob.ir` `www.gstatic.com` `telegram.org` `*.bale.ai` `*.telegram.org` `sentry.torob.ir`

## Routes published in the Next.js build manifest
`/` `/404` `/browse` `/browse/[category]/[[...others]]` `/category-root/[[...cat_id]]` `/chatbot` `/chatbot/[random_key]/[base_prk]` `/feedback` `/feedback/complaints/[[...others]]` `/install` `/landings/[page_name]` `/map` `/map-sellers` `/offline/vlp` `/p/[random_key]/[[...product_name]]` `/pages/support` `/pages/[page]` `/price-list/[[...others]]` `/search` `/search-by-image` `/sell` `/sell/login` `/sell/register/[[...others]]` `/sell/select-shop` `/shop/[shop_id]/[[...others]]` `/shop-list` `/special-offers/[[...others]]` `/user/[[...others]]` `/view/[provider]`

## Source maps
Not probed. Re-run with `--sourcemaps` to list npm packages from public source maps.
