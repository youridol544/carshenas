import { describeUrl } from './redact.mjs';

const HOST_VENDORS = [
  [/google-analytics\.com|analytics\.google\.com/, 'Google Analytics', 'analytics'],
  [/googletagmanager\.com/, 'Google Tag Manager', 'analytics'],
  [/doubleclick\.net|googlesyndication|googleadservices/, 'Google Ads', 'ads'],
  [/facebook\.(com|net)|fbcdn/, 'Meta Pixel', 'ads'],
  [/tiktok/, 'TikTok', 'ads'],
  [/pinimg|pinterest/, 'Pinterest', 'ads'],
  [/bing\.com|clarity\.ms/, 'Microsoft Ads / Clarity', 'ads'],
  [/criteo/, 'Criteo', 'ads'],
  [/segment\.(com|io)|cdn\.segment/, 'Segment', 'analytics'],
  [/amplitude\.com/, 'Amplitude', 'analytics'],
  [/mixpanel\.com/, 'Mixpanel', 'analytics'],
  [/heap(analytics)?\.(io|com)/, 'Heap', 'analytics'],
  [/posthog/, 'PostHog', 'analytics'],
  [/hotjar/, 'Hotjar', 'analytics'],
  [/fullstory/, 'FullStory', 'analytics'],
  [/sentry(-cdn)?\.(io|com)|ingest\.sentry/, 'Sentry', 'monitoring'],
  [/datadoghq|browser-intake-datadog/, 'Datadog', 'monitoring'],
  [/newrelic|nr-data/, 'New Relic', 'monitoring'],
  [/logrocket|lr-ingest/, 'LogRocket', 'monitoring'],
  [/bugsnag/, 'Bugsnag', 'monitoring'],
  [/stripe\.(com|network)/, 'Stripe', 'payments'],
  [/paypal/, 'PayPal', 'payments'],
  [/braintree/, 'Braintree', 'payments'],
  [/adyen/, 'Adyen', 'payments'],
  [/affirm|klarna|afterpay/, 'Buy-now-pay-later provider', 'payments'],
  [/algolia(net)?\.(com|net)/, 'Algolia', 'search'],
  [/typesense/, 'Typesense', 'search'],
  [/constructor\.io/, 'Constructor', 'search'],
  [/cloudinary/, 'Cloudinary', 'images'],
  [/imgix/, 'imgix', 'images'],
  [/cloudfront\.net/, 'Amazon CloudFront', 'cdn'],
  [/fastly/, 'Fastly', 'cdn'],
  [/akamai/, 'Akamai', 'cdn'],
  [/cdn\.jsdelivr|unpkg\.com|cdnjs/, 'Public JS CDN', 'cdn'],
  [/fonts\.(googleapis|gstatic)/, 'Google Fonts', 'fonts'],
  [/use\.typekit|typekit\.net/, 'Adobe Fonts', 'fonts'],
  [/intercom/, 'Intercom', 'support'],
  [/zendesk|zdassets/, 'Zendesk', 'support'],
  [/drift/, 'Drift', 'support'],
  [/optimizely/, 'Optimizely', 'experimentation'],
  [/launchdarkly/, 'LaunchDarkly', 'experimentation'],
  [/statsig/, 'Statsig', 'experimentation'],
  [/split\.io/, 'Split', 'experimentation'],
  [/onetrust|cookielaw/, 'OneTrust', 'consent'],
  [/cookiebot/, 'Cookiebot', 'consent'],
  [/braze/, 'Braze', 'messaging'],
  [/iterable/, 'Iterable', 'messaging'],
  [/klaviyo/, 'Klaviyo', 'messaging'],
  [/datadome/, 'DataDome', 'bot-protection'],
  [/perimeterx|px-cdn|px-cloud/, 'HUMAN (PerimeterX)', 'bot-protection'],
  [/challenges\.cloudflare/, 'Cloudflare challenge', 'bot-protection'],
  [/recaptcha|gstatic\.com\/recaptcha/, 'reCAPTCHA', 'bot-protection'],
  [/hcaptcha/, 'hCaptcha', 'bot-protection'],
  [/mapbox/, 'Mapbox', 'maps'],
  [/maps\.googleapis/, 'Google Maps', 'maps'],
  [/youtube|vimeo|wistia|mux\.com/, 'Video host', 'media'],
];

const COOKIE_VENDORS = [
  [/^datadome$/i, 'DataDome', 'bot-protection'],
  [/^_px/i, 'HUMAN (PerimeterX)', 'bot-protection'],
  [/^(__cf_bm|cf_clearance|__cfruid|_cfuvid)$/i, 'Cloudflare', 'cdn / bot-protection'],
  [/^(_abck|bm_sz|ak_bmsc)$/i, 'Akamai Bot Manager', 'bot-protection'],
  [/^incap_ses|^visid_incap/i, 'Imperva', 'bot-protection'],
  [/^(AWSALB|AWSALBCORS)$/i, 'AWS load balancer', 'hosting'],
  [/^_ga|^_gid$/i, 'Google Analytics', 'analytics'],
  [/^_gcl_/i, 'Google Ads', 'ads'],
  [/^ajs_/i, 'Segment', 'analytics'],
  [/^amp_|^AMP_/, 'Amplitude', 'analytics'],
  [/^mp_/i, 'Mixpanel', 'analytics'],
  [/^optimizely/i, 'Optimizely', 'experimentation'],
  [/^_fbp$/i, 'Meta Pixel', 'ads'],
  [/^intercom-/i, 'Intercom', 'support'],
  [/^__stripe_/i, 'Stripe', 'payments'],
  [/^OptanonConsent/i, 'OneTrust', 'consent'],
  [/^_shopify|^_secure_session/i, 'Shopify', 'platform'],
];

export function analyzeHeaders(headers = {}) {
  const evidence = [];
  const add = (name, category, proof) => evidence.push({ name, category, evidence: proof });
  const h = (name) => headers[name];
  if (h('server')) add(`server: ${h('server')}`, 'hosting', 'response header');
  if (h('x-powered-by')) add(`x-powered-by: ${h('x-powered-by')}`, 'hosting', 'response header');
  if (h('cf-ray') || /cloudflare/i.test(h('server') ?? ''))
    add('Cloudflare', 'cdn', 'cf-ray / server header');
  if (h('x-vercel-id') || h('x-vercel-cache')) add('Vercel', 'hosting', 'x-vercel-* headers');
  if (h('x-amz-cf-id') || /cloudfront/i.test(h('via') ?? ''))
    add('Amazon CloudFront', 'cdn', 'x-amz-cf-id / via');
  if (h('x-served-by') || h('x-fastly-request-id')) add('Fastly', 'cdn', 'x-served-by / x-fastly-request-id');
  if (h('x-akamai-transformed') || /akamai/i.test(h('server') ?? '')) add('Akamai', 'cdn', 'akamai headers');
  if (h('x-nextjs-cache') || h('x-nextjs-prerender') || h('x-nextjs-stale-time'))
    add('Next.js', 'framework', 'x-nextjs-* headers');
  if (h('x-shopify-stage') || h('x-shopid')) add('Shopify', 'platform', 'x-shopify headers');
  if (h('fly-request-id')) add('Fly.io', 'hosting', 'fly-request-id');
  if (h('x-render-origin-server')) add('Render', 'hosting', 'x-render-origin-server');
  if (h('x-envoy-upstream-service-time') || /envoy/i.test(h('server') ?? ''))
    add('Envoy proxy', 'hosting', 'envoy headers');
  if (h('alt-svc') && /h3/.test(h('alt-svc'))) add('HTTP/3 advertised', 'protocol', 'alt-svc');
  if (h('content-encoding')) add(`content-encoding: ${h('content-encoding')}`, 'protocol', 'response header');
  const csp = h('content-security-policy') ?? h('content-security-policy-report-only');
  const cspHosts = csp
    ? [
        ...new Set(
          [...csp.matchAll(/(?:https?:\/\/)?((?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)].map((m) => m[1]),
        ),
      ].slice(0, 60)
    : [];
  return {
    evidence,
    cspHosts,
    security: {
      csp: Boolean(csp),
      hsts: Boolean(h('strict-transport-security')),
      frameOptions: h('x-frame-options') ?? null,
    },
  };
}

export function analyzeHosts(hosts) {
  const found = new Map();
  for (const { host, requests } of hosts) {
    for (const [pattern, name, category] of HOST_VENDORS) {
      if (!pattern.test(host)) continue;
      const record = found.get(name) ?? { name, category, evidence: [], requests: 0 };
      record.evidence.push(host);
      record.requests += requests;
      found.set(name, record);
    }
  }
  return [...found.values()].map((r) => ({
    ...r,
    evidence: `requests to ${[...new Set(r.evidence)].slice(0, 3).join(', ')}`,
  }));
}

/** Signals that only show up as request paths. */
export function analyzePaths(entries) {
  const found = [];
  if (entries.some((entry) => entry.url.includes('/cdn-cgi/challenge-platform/')))
    found.push({
      name: 'Cloudflare bot management (JavaScript detections)',
      category: 'bot-protection',
      evidence: 'requests to /cdn-cgi/challenge-platform/',
    });
  if (entries.some((entry) => /\/cdn-cgi\/rum|cloudflareinsights/.test(entry.url)))
    found.push({
      name: 'Cloudflare Web Analytics',
      category: 'analytics',
      evidence: 'requests to /cdn-cgi/rum',
    });
  if (
    entries.some(
      (entry) => entry.url.includes('/_vercel/insights') || entry.url.includes('/_vercel/speed-insights'),
    )
  )
    found.push({ name: 'Vercel Analytics', category: 'analytics', evidence: 'requests to /_vercel/*' });
  return found;
}

export function analyzeCookies(cookies) {
  const found = new Map();
  for (const cookie of cookies) {
    for (const [pattern, name, category] of COOKIE_VENDORS) {
      if (pattern.test(cookie.name))
        found.set(name, {
          name,
          category,
          evidence: `cookie name ${cookie.name.replace(/[0-9a-f]{8,}/gi, '…')}`,
        });
    }
  }
  return [...found.values()];
}

/** Library names and versions from licence banners such as `/*! name v1.2.3`. */
export function analyzeBanners(scripts) {
  const found = new Map();
  for (const { url, text } of scripts) {
    const head = text.length > 400_000 ? text.slice(0, 200_000) + text.slice(-50_000) : text;
    for (const match of head.matchAll(
      /\/\*[!*]?[\s*]*(?:@license\s+|@preserve\s+)?([A-Za-z@][\w.@/-]{1,40})(?:\s+|\s*-\s*)v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/g,
    )) {
      const name = match[1].replace(/[,:;]+$/, '');
      if (/^(version|copyright|license|licensed|the|and|for|http)/i.test(name)) continue;
      const key = `${name}@${match[2]}`;
      if (!found.has(key))
        found.set(key, {
          name,
          version: match[2],
          category: 'library',
          evidence: `licence banner in ${describeUrl(url).host}/…/${describeUrl(url).path.split('/').pop()?.slice(0, 40)}`,
        });
    }
  }
  return [...found.values()].slice(0, 40);
}

/** Opt-in: read public source maps and list npm package names only. Source contents are never stored. */
export async function analyzeSourceMaps(scripts, request, { limit = 12 } = {}) {
  const packages = new Map();
  const maps = [];
  let firstPartyFiles = 0;
  for (const { url, text } of scripts) {
    if (maps.length >= limit) break;
    const ref = text.slice(-400).match(/\/\/[#@]\s*sourceMappingURL=(\S+)/)?.[1];
    if (!ref || ref.startsWith('data:')) continue;
    let mapUrl;
    try {
      mapUrl = new URL(ref, url).href;
    } catch {
      continue;
    }
    try {
      const response = await request.get(mapUrl, { timeout: 15_000 });
      if (!response.ok()) {
        maps.push({ script: describeUrl(url).path, status: response.status() });
        continue;
      }
      const sources = (JSON.parse(await response.text()).sources ?? []).map(String);
      let mine = 0;
      for (const source of sources) {
        const pkg = source
          .match(/node_modules\/((?:@[^/]+\/)?[^/]+)/g)
          ?.pop()
          ?.replace('node_modules/', '');
        if (pkg) packages.set(pkg, (packages.get(pkg) ?? 0) + 1);
        else mine++;
      }
      firstPartyFiles += mine;
      maps.push({
        script: describeUrl(url).path,
        status: 200,
        sources: sources.length,
        firstPartySources: mine,
      });
    } catch {
      maps.push({ script: describeUrl(url).path, status: 'error' });
    }
  }
  return {
    maps,
    firstPartyFiles,
    packages: [...packages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([name, files]) => ({ name, files })),
  };
}

/** Next.js publishes its route table in the build manifest. */
export async function nextRoutes(origin, buildId, request) {
  if (!buildId) return [];
  try {
    const response = await request.get(`${origin}/_next/static/${buildId}/_buildManifest.js`, {
      timeout: 15_000,
    });
    if (!response.ok()) return [];
    return [...new Set([...(await response.text()).matchAll(/"(\/[^"]*)":\s*\[/g)].map((m) => m[1]))]
      .filter((route) => !route.startsWith('/_'))
      .slice(0, 300);
  } catch {
    return [];
  }
}

export function mergeEvidence(...lists) {
  const merged = new Map();
  for (const item of lists.flat()) {
    if (!item?.name) continue;
    const existing = merged.get(item.name);
    if (!existing) {
      merged.set(item.name, { ...item });
      continue;
    }
    existing.version ??= item.version;
    if (!existing.evidence.includes(item.evidence)) existing.evidence += `; ${item.evidence}`;
  }
  return [...merged.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}
