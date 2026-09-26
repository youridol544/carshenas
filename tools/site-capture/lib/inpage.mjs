// Functions in this file are serialised into the page with page.evaluate(), so each one must be
// self-contained: no imports, no references to module scope.

/** Installed before any page script runs: records React renderers the way React DevTools would. */
export function installProbes() {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;
  const renderers = new Map();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers,
    supportsFiber: true,
    inject(renderer) {
      const id = renderers.size + 1;
      renderers.set(id, renderer);
      return id;
    },
    onCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
}

/** Design tokens as they are actually used on the rendered page. */
export function extractTokens({ maxElements = 7000 } = {}) {
  const toHex = (value) => {
    const m =
      value && value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
    if (!m) return value && value !== 'transparent' ? value : null; // oklch(), color(), etc. are kept verbatim
    const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (alpha === 0) return null;
    const hex =
      '#' + [m[1], m[2], m[3]].map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('');
    return alpha < 1 ? `${hex} @${Math.round(alpha * 100)}%` : hex;
  };
  const bump = (map, key, weight = 1) => {
    if (key) map.set(key, (map.get(key) ?? 0) + weight);
  };
  const top = (map, n) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([value, count]) => ({ value, count: Math.round(count) }));
  const px = (value) => (value && value.endsWith('px') ? Math.round(parseFloat(value) * 100) / 100 : null);

  const textColors = new Map(),
    backgrounds = new Map(),
    backgroundArea = new Map(),
    borderColors = new Map();
  const families = new Map(),
    sizes = new Map(),
    weights = new Map(),
    lineHeights = new Map(),
    textStyles = new Map();
  const spacing = new Map(),
    gaps = new Map(),
    radii = new Map(),
    shadows = new Map(),
    borderWidths = new Map();
  const maxWidths = new Map(),
    transitions = new Map(),
    zIndexes = new Map();
  const display = { flex: 0, grid: 0 };
  const samples = new Map();

  const all = document.body ? document.body.querySelectorAll('*') : [];
  let visited = 0;
  for (const el of all) {
    if (visited >= maxElements) break;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    visited++;

    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (hasOwnText) {
      bump(textColors, toHex(cs.color));
      const family = cs.fontFamily;
      bump(families, family);
      bump(sizes, cs.fontSize);
      bump(weights, cs.fontWeight);
      bump(lineHeights, cs.lineHeight);
      const key = [
        family.split(',')[0].replace(/["']/g, '').trim(),
        cs.fontSize,
        cs.fontWeight,
        cs.lineHeight,
        cs.letterSpacing,
        cs.textTransform,
      ].join(' | ');
      bump(textStyles, key);
      if (!samples.has(key))
        samples.set(key, { tag: el.tagName.toLowerCase(), characters: el.textContent.trim().length });
    }
    const bg = toHex(cs.backgroundColor);
    if (bg) {
      bump(backgrounds, bg);
      bump(backgroundArea, bg, rect.width * rect.height);
    }
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') {
      bump(borderColors, toHex(cs.borderTopColor));
      bump(borderWidths, cs.borderTopWidth);
    }
    for (const prop of [
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
    ]) {
      const v = px(cs[prop]);
      if (v && v > 0 && v <= 256) bump(spacing, `${v}px`);
    }
    if (cs.display.includes('flex')) display.flex++;
    if (cs.display.includes('grid')) display.grid++;
    if (
      (cs.display.includes('flex') || cs.display.includes('grid')) &&
      cs.gap &&
      cs.gap !== 'normal' &&
      cs.gap !== '0px'
    )
      bump(gaps, cs.gap);
    if (cs.borderTopLeftRadius !== '0px')
      bump(radii, parseFloat(cs.borderTopLeftRadius) >= 999 ? 'pill (9999px)' : cs.borderTopLeftRadius);
    if (cs.boxShadow !== 'none') bump(shadows, cs.boxShadow);
    if (cs.maxWidth !== 'none' && rect.width >= 480) bump(maxWidths, cs.maxWidth);
    if (cs.transitionDuration !== '0s')
      bump(transitions, `${cs.transitionDuration} ${cs.transitionTimingFunction}`.slice(0, 80));
    if (cs.zIndex !== 'auto') bump(zIndexes, cs.zIndex);
  }

  // Declared custom properties reachable through CSSOM (same-origin sheets only).
  const customProperties = {};
  let unreadableSheets = 0;
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      unreadableSheets++;
      continue;
    }
    for (const rule of rules ?? []) {
      if (!rule.selectorText || !/(^|,)\s*(:root|html|body)\s*(,|$)/.test(rule.selectorText)) continue;
      for (const name of rule.style)
        if (name.startsWith('--')) customProperties[name] = rule.style.getPropertyValue(name).trim();
    }
  }

  const representative = {};
  for (const selector of ['h1', 'h2', 'h3', 'p', 'a', 'button', 'input', 'label', 'small']) {
    const el = [...document.querySelectorAll(selector)].find(
      (node) => node.getBoundingClientRect().width > 0,
    );
    if (!el) continue;
    const cs = getComputedStyle(el);
    representative[selector] = {
      fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      color: toHex(cs.color),
    };
  }

  return {
    sampledElements: visited,
    document: {
      lang: document.documentElement.lang || null,
      dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
      title: document.title,
    },
    colors: {
      text: top(textColors, 16),
      background: top(backgrounds, 16),
      backgroundByArea: top(backgroundArea, 8),
      border: top(borderColors, 10),
    },
    typography: {
      families: top(families, 8),
      sizes: top(sizes, 16),
      weights: top(weights, 8),
      lineHeights: top(lineHeights, 10),
      styles: top(textStyles, 24).map((entry) => ({ ...entry, ...samples.get(entry.value) })),
      representative,
    },
    spacing: top(spacing, 20),
    gaps: top(gaps, 10),
    radii: top(radii, 10),
    shadows: top(shadows, 8),
    borderWidths: top(borderWidths, 5),
    layout: {
      maxWidths: top(maxWidths, 8),
      flexContainers: display.flex,
      gridContainers: display.grid,
      zIndexes: top(zIndexes, 10),
    },
    motion: top(transitions, 8),
    customProperties,
    unreadableSheets,
    fonts: [...document.fonts]
      .map((f) => ({
        family: f.family.replace(/["']/g, ''),
        weight: f.weight,
        style: f.style,
        status: f.status,
      }))
      .filter((f) => f.status === 'loaded'),
  };
}

/** Tags up to `limit` distinct-looking components per kind so Node can screenshot them. */
export function tagComponents({ limit = 5 } = {}) {
  const kinds = {
    button: 'button, [role="button"], input[type="submit"], a[class*="btn" i], a[class*="button" i]',
    input:
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), select, textarea',
    card: 'article, li > a:has(img), [class*="card" i]',
    nav: 'header, nav',
  };
  const found = [];
  for (const [kind, selector] of Object.entries(kinds)) {
    const seen = new Set();
    let nodes = [];
    try {
      nodes = [...document.querySelectorAll(selector)];
    } catch {
      continue;
    }
    for (const el of nodes) {
      if (seen.size >= limit) break;
      const rect = el.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 16 || rect.width > innerWidth * 1.05 || rect.height > 900)
        continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const signature = [
        cs.backgroundColor,
        cs.color,
        cs.borderTopWidth,
        cs.borderTopColor,
        cs.borderTopLeftRadius,
        cs.paddingTop,
        cs.paddingLeft,
        cs.fontSize,
        cs.fontWeight,
        cs.boxShadow,
      ].join('|');
      if (seen.has(signature)) continue;
      seen.add(signature);
      const id = `${kind}-${seen.size}`;
      el.setAttribute('data-site-capture', id);
      found.push({
        id,
        kind,
        tag: el.tagName.toLowerCase(),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        style: {
          background: cs.backgroundColor,
          color: cs.color,
          border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
          radius: cs.borderTopLeftRadius,
          padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
          font: `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight}`,
          shadow: cs.boxShadow,
          minHeight: cs.minHeight,
        },
      });
    }
  }
  return found;
}

/** Technology fingerprints visible from inside the page. `baseline` is Object.keys(window) of about:blank. */
export function probeTechnology(baseline) {
  const has = (selector) => {
    try {
      return Boolean(document.querySelector(selector));
    } catch {
      return false;
    }
  };
  const w = window;
  const evidence = [];
  const add = (name, category, proof, version) =>
    evidence.push({ name, category, evidence: proof, version: version ? String(version) : undefined });

  const hook = w.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const renderer = hook && hook.renderers && [...hook.renderers.values()][0];
  const fiberKey =
    document.body &&
    Object.keys(document.body.firstElementChild ?? {})
      .concat(
        Object.keys(document.getElementById('__next') ?? {}),
        Object.keys(document.getElementById('root') ?? {}),
      )
      .find((k) => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
  if (renderer || fiberKey || has('[data-reactroot]'))
    add(
      'React',
      'framework',
      renderer ? 'renderer registered with the DevTools hook' : 'React fiber keys on DOM nodes',
      renderer && renderer.version,
    );
  if (w.__NEXT_DATA__ || has('script[src*="/_next/"]') || has('#__next'))
    add(
      'Next.js',
      'framework',
      w.__NEXT_DATA__ ? '__NEXT_DATA__ (pages router)' : '/_next/ assets',
      w.next && w.next.version,
    );
  if (w.__next_f || has('script[src*="/_next/static/chunks/app/"]'))
    add('Next.js App Router (RSC)', 'framework', 'self.__next_f flight data');
  if (w.__remixContext) add('Remix', 'framework', '__remixContext');
  if (w.__NUXT__ || has('#__nuxt')) add('Nuxt', 'framework', '__NUXT__');
  if (w.__VUE__ || has('[data-v-app]'))
    add('Vue', 'framework', '__VUE__ / data-v-app', w.Vue && w.Vue.version);
  if (has('[ng-version]'))
    add(
      'Angular',
      'framework',
      'ng-version attribute',
      document.querySelector('[ng-version]').getAttribute('ng-version'),
    );
  if (has('[class*="svelte-"]')) add('Svelte', 'framework', 'svelte-* scoped classes');
  if (has('script[src*="/_app/immutable/"], link[href*="/_app/immutable/"]'))
    add('SvelteKit', 'framework', '/_app/immutable assets');
  if (w.___gatsby) add('Gatsby', 'framework', '___gatsby');
  if (has('astro-island')) add('Astro', 'framework', 'astro-island elements');
  if (w.Shopify) add('Shopify', 'platform', 'window.Shopify');
  if (has('meta[name="generator"]'))
    add(document.querySelector('meta[name="generator"]').content, 'generator', 'meta generator');
  if (w.jQuery && w.jQuery.fn) add('jQuery', 'library', 'window.jQuery', w.jQuery.fn.jquery);
  if (w.__APOLLO_STATE__ || w.__APOLLO_CLIENT__)
    add('Apollo Client', 'data', '__APOLLO_STATE__ / __APOLLO_CLIENT__');
  if (w.__RELAY_STORE__ || w.__relay) add('Relay', 'data', 'relay globals');
  if (w.__REACT_QUERY_STATE__ || w.__TANSTACK_QUERY_CLIENT__) add('TanStack Query', 'data', 'query globals');

  const classTokens = new Set();
  for (const el of document.querySelectorAll('[class]')) {
    if (classTokens.size > 4000) break;
    for (const t of String(el.getAttribute('class')).split(/\s+/)) classTokens.add(t);
  }
  const tokens = [...classTokens];
  const count = (re) => tokens.filter((t) => re.test(t)).length;
  const twVars =
    getComputedStyle(document.documentElement).getPropertyValue('--tw-ring-offset-width') ||
    [...document.styleSheets].some((s) => {
      try {
        return [...s.cssRules].slice(0, 40).some((r) => r.cssText.includes('--tw-'));
      } catch {
        return false;
      }
    });
  if (twVars || count(/^(sm|md|lg|xl|2xl):[a-z]/) >= 5)
    add(
      'Tailwind CSS',
      'styling',
      twVars ? '--tw-* custom properties' : `${count(/^(sm|md|lg|xl|2xl):/)} responsive utility classes`,
    );
  if (count(/^Mui[A-Z]/) >= 3) add('MUI', 'ui-kit', `${count(/^Mui[A-Z]/)} Mui* classes`);
  if (count(/^chakra-/) >= 3) add('Chakra UI', 'ui-kit', 'chakra-* classes');
  if (count(/^ant-/) >= 3) add('Ant Design', 'ui-kit', 'ant-* classes');
  if (count(/^mantine-/) >= 3) add('Mantine', 'ui-kit', 'mantine-* classes');
  if (has('[data-radix-collection-item], [data-radix-popper-content-wrapper], [id^="radix-"]'))
    add('Radix UI', 'ui-kit', 'data-radix-* attributes');
  if (has('[data-headlessui-state]')) add('Headless UI', 'ui-kit', 'data-headlessui-state');
  if (count(/^(col|row|btn|navbar)(-|$)/) >= 6 && (w.bootstrap || has('link[href*="bootstrap"]')))
    add('Bootstrap', 'ui-kit', 'grid and btn classes');
  if (has('style[data-styled], style[data-styled-version]'))
    add(
      'styled-components',
      'styling',
      'style[data-styled]',
      document.querySelector('style[data-styled-version]')?.getAttribute('data-styled-version'),
    );
  if (has('style[data-emotion]')) add('Emotion', 'styling', 'style[data-emotion]');
  if (count(/^[A-Za-z][\w-]*_[\w-]+__[A-Za-z0-9_-]{4,}$/) >= 8)
    add(
      'CSS Modules',
      'styling',
      `${count(/^[A-Za-z][\w-]*_[\w-]+__[A-Za-z0-9_-]{4,}$/)} Component_name__hash classes`,
    );
  if (count(/^[a-z]{1,2}[0-9a-z]{5,7}$/) >= 40)
    add(
      'Atomic / hashed CSS-in-JS classes',
      'styling',
      `${count(/^[a-z]{1,2}[0-9a-z]{5,7}$/)} short hashed class names`,
    );

  const services = [
    ['__SENTRY__', 'Sentry', 'monitoring'],
    ['DD_RUM', 'Datadog RUM', 'monitoring'],
    ['newrelic', 'New Relic', 'monitoring'],
    ['LogRocket', 'LogRocket', 'monitoring'],
    ['dataLayer', 'Google Tag Manager / dataLayer', 'analytics'],
    ['gtag', 'Google gtag', 'analytics'],
    ['analytics', 'Segment-style analytics', 'analytics'],
    ['amplitude', 'Amplitude', 'analytics'],
    ['mixpanel', 'Mixpanel', 'analytics'],
    ['heap', 'Heap', 'analytics'],
    ['posthog', 'PostHog', 'analytics'],
    ['hj', 'Hotjar', 'analytics'],
    ['FS', 'FullStory', 'analytics'],
    ['fbq', 'Meta Pixel', 'ads'],
    ['ttq', 'TikTok Pixel', 'ads'],
    ['pintrk', 'Pinterest Tag', 'ads'],
    ['Intercom', 'Intercom', 'support'],
    ['zE', 'Zendesk', 'support'],
    ['drift', 'Drift', 'support'],
    ['Stripe', 'Stripe.js', 'payments'],
    ['paypal', 'PayPal', 'payments'],
    ['braintree', 'Braintree', 'payments'],
    ['optimizely', 'Optimizely', 'experimentation'],
    ['LDClient', 'LaunchDarkly', 'experimentation'],
    ['statsig', 'Statsig', 'experimentation'],
    ['OneTrust', 'OneTrust', 'consent'],
    ['Cookiebot', 'Cookiebot', 'consent'],
    ['grecaptcha', 'reCAPTCHA', 'security'],
    ['turnstile', 'Cloudflare Turnstile', 'security'],
    ['hcaptcha', 'hCaptcha', 'security'],
    ['algoliasearch', 'Algolia', 'search'],
    ['google', 'Google Maps / APIs', 'maps'],
    ['mapboxgl', 'Mapbox GL', 'maps'],
  ];
  for (const [key, name, category] of services)
    if (w[key] !== undefined && w[key] !== null) add(name, category, `window.${key}`);

  let known = new Set(baseline);
  try {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    document.documentElement.append(frame);
    known = new Set([...known, ...Object.keys(frame.contentWindow)]);
    frame.remove();
  } catch {
    /* a strict CSP can forbid the probe frame; fall back to the about:blank baseline */
  }
  const globals = Object.keys(w)
    .filter((k) => !known.has(k) && !/^(on|webkit|\d)/.test(k))
    .slice(0, 150);

  return {
    evidence,
    globals,
    meta: {
      viewport: document.querySelector('meta[name="viewport"]')?.content ?? null,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content ?? null,
      manifest: document.querySelector('link[rel="manifest"]')?.href ?? null,
      preconnect: [...document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]')]
        .map((l) => l.href)
        .slice(0, 20),
      inlineSvgs: document.querySelectorAll('svg').length,
      images: document.querySelectorAll('img').length,
      lazyImages: document.querySelectorAll('img[loading="lazy"]').length,
      pictureElements: document.querySelectorAll('picture').length,
      serviceWorker: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    },
    nextData: w.__NEXT_DATA__
      ? {
          buildId: w.__NEXT_DATA__.buildId,
          page: w.__NEXT_DATA__.page,
          locale: w.__NEXT_DATA__.locale ?? null,
          runtimeConfigKeys: Object.keys(w.__NEXT_DATA__.runtimeConfig ?? {}),
        }
      : null,
  };
}

/** Scrolls through the page once so lazy content loads, then returns to the top. */
export async function autoScroll({ step = 700, pause = 250, maxSteps = 40 } = {}) {
  for (let i = 0; i < maxSteps; i++) {
    const before = scrollY;
    scrollBy(0, step);
    await new Promise((resolve) => setTimeout(resolve, pause));
    if (scrollY === before) break;
  }
  scrollTo(0, 0);
  await new Promise((resolve) => setTimeout(resolve, pause));
  return document.documentElement.scrollHeight;
}
