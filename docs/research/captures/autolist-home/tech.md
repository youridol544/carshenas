# Technology: https://www.autolist.com/
Captured 2026-09-30T07:46:05.942Z. Every row names its evidence; absence of a row means "not detected", not "not used".
| Category | Technology | Version | Evidence |
| --- | --- | --- | --- |
| ads | Google Ads |  | requests to pagead2.googlesyndication.com, www.googleadservices.com, cm.g.doubleclick.net; cookie name _gcl_au |
| ads | Meta Pixel |  | window.fbq; requests to connect.facebook.net, www.facebook.com; cookie name _fbp |
| analytics | Google Analytics |  | requests to region1.analytics.google.com; cookie name _ga_KKZ1EQJKEV |
| analytics | Google Tag Manager |  | requests to www.googletagmanager.com |
| analytics | Google Tag Manager / dataLayer |  | window.dataLayer |
| cdn | Amazon CloudFront |  | x-amz-cf-id / via |
| cdn | Public JS CDN |  | requests to cdnjs.cloudflare.com |
| experimentation | Optimizely |  | cookie name OPTIMIZELY_USER_ID |
| framework | Next.js | 15.5.24 | __NEXT_DATA__ (pages router) |
| framework | React | 19.2.5 | renderer registered with the DevTools hook |
| hosting | server: CloudFront |  | response header |
| hosting | x-powered-by: Next.js |  | response header |
| library | prebid.js | 8.52.1 | licence banner in ads.pubmatic.com/…/pwt.js |
| maps | Google Maps |  | requests to maps.googleapis.com |
| maps | Google Maps / APIs |  | window.google |
| monitoring | Sentry |  | window.__SENTRY__; requests to sentry.io |
| protocol | content-encoding: gzip |  | response header |

## Page facts
- Main document: HTTP 200, text/html; security headers: CSP false, HSTS false, X-Frame-Options SAMEORIGIN
- Viewport meta: `width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=1.0, maximum-scale=2.0`; theme colour none; manifest yes; service worker controlling the page: false
- Images: 7 `<img>` (4 lazy), 0 `<picture>`, 0 inline SVGs
- Next.js data: page `/`, locale en, runtime config keys: none
- Robots: robots.txt has 1 rule for generic agents; this path is allowed

## Globals the site adds to `window`
`alSentryConfig` `__ENV__` `_sentryDebugIds` `_sentryDebugIdIdentifier` `webpackChunk_N_E` `googletag` `jagvars` `jSite` `jAdUnit` `__next_set_public_path__` `_sentryRewritesTunnelPath` `SENTRY_RELEASE` `_sentryBasePath` `_sentryNextJsVersion` `_sentryRewriteFramesAssetPrefixPath` `_sentryAssetPrefix` `_sentryExperimentalThirdPartyOriginStackFrames` `_sentryRouteManifest` `next` `__NEXT_DATA__` `__SSG_MANIFEST_CB` `__NEXT_P` `_N_E` `__SENTRY__` `__sentry_instrumentation_handlers__` `__NEXT_PRELOADREADY` `__MIDDLEWARE_MATCHERS` `__BUILD_MANIFEST` `__SSG_MANIFEST` `_sentryWrappedDepth` `__JOTAI_DEFAULT_STORE__` `google` `initMap` `dataLayer` `PWT` `GlobalSnowplowNamespace` `snowplow` `default_gsi` `_F_toggles_default_gsi` `google_tag_manager` `google_tag_data` `rtbhEvents` `fbq` `_fbq` `ggeac` `google_js_reporting_queue` `module$exports$google3$maps$api$javascript$geometry$lat_lng_bounds` `module$exports$google3$maps$api$javascript$marker$marker` `litHtmlVersions` `litElementVersions` `reactiveElementVersions` `gaGlobal` `GooglebQhCsO` `google_measure_js_timing` `google_reactive_ads_global_state` `google_unique_id` `getCustomDimensionsDataFromPublisher` `owpbjsChunk` `owpbjs` `regeneratorRuntime` `partnersWithoutErrorAndBids` `matchedimpressions` `ucTag` `OWT` `partnerName` `key` `liQ_instances` `GoogleGcLKhOms` `launchPad` `launchPadConfiguration` `nodeScript` `__launchpad` `google_image_requests`

## Routes published in the Next.js build manifest
`/` `/404` `/ccpa/opt-out` `/comparisons/[slug]` `/contact-feedback` `/dealers/[slug]` `/guides` `/help` `/lead-feedback` `/listings` `/listings/[vin]` `/news-and-analysis` `/pages/privacy` `/pages/terms` `/sponsored` `/thank-you` `/used-cars-welcome` `/user/favorites` `/user/saved` `/user/settings` `/user/settings/unsubscribe` `/[parentPage]` `/[parentPage]/[slug]`

## Source maps
Not probed. Re-run with `--sourcemaps` to list npm packages from public source maps.
