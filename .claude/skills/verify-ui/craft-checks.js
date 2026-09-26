// Craft measurements for one open page (ui-design references/craft.md), used by /verify-ui and the design-reviewer.
// From the repo root, with a page open in the agent browser:
//   npx playwright cli run-code --filename=.claude/skills/verify-ui/craft-checks.js
// It returns numbers, not verdicts: lists are capped, and whoever reads them decides what is a finding.
// It scrolls the page, and emulates reduced motion for a moment at the end. Layout shift is Chromium only.
// The CLI wraps this file in parentheses, so it stays one function expression without a trailing semicolon, and
// only `page` and JavaScript built-ins exist out here (no console, no timers); page code runs in page.evaluate.
async (page) => {
  const measured = await page.evaluate(() => {
    const LIMIT = 15;
    const persian = /[؀-ۿ]/;
    const visible = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const ownText = (el) =>
      [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    const nameOf = (el) =>
      (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30) ||
      el.tagName.toLowerCase();
    const all = [...document.body.querySelectorAll('*')];
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const readColour = (css) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#000';
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      return { r, g, b, alpha };
    };

    // Layout shift since navigation that no input caused (craft.md section 2). Buffered entries are available at once.
    const shiftObserver = new PerformanceObserver(() => {});
    shiftObserver.observe({ type: 'layout-shift', buffered: true });
    const layoutShift = shiftObserver
      .takeRecords()
      .filter((entry) => !entry.hadRecentInput)
      .reduce((sum, entry) => sum + entry.value, 0);
    shiftObserver.disconnect();

    // Hit areas (section 5): a 44 px target still answers 21 px from its centre in all four directions. The probe
    // also sees pseudo-element hit areas. Inline links inside running text are exempt (WCAG 2.5.8).
    const controls = [
      ...document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"]',
      ),
    ].filter(visible);
    const smallTargets = [];
    let inlineLinks = 0;
    for (const el of controls) {
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') {
        inlineLinks += 1;
        continue;
      }
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const box = el.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const probes = [
        [x + 21, y],
        [x - 21, y],
        [x, y + 21],
        [x, y - 21],
      ];
      const missed = probes.filter(([px, py]) => {
        const hit = document.elementFromPoint(px, py);
        if (!hit) return true;
        const labels = [...(el.labels ?? [])];
        return !(el.contains(hit) || labels.some((label) => label.contains(hit)));
      }).length;
      if (missed > 0)
        smallTargets.push(
          `${nameOf(el)}: ${Math.round(box.width)}×${Math.round(box.height)}, ${missed}/4 probes missed`,
        );
    }
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Persian line heights by role (section 7): counts per element, size and ratio, with the rule each one breaks.
    const clips = (node) => {
      if (!node) return false;
      const s = getComputedStyle(node);
      return (
        ['hidden', 'clip'].includes(s.overflowX) ||
        ['hidden', 'clip'].includes(s.overflowY) ||
        s.textOverflow === 'ellipsis' ||
        s.webkitLineClamp !== 'none'
      );
    };
    const lineHeights = new Map();
    const alphaText = []; // an alpha text colour leaves dark spots where Persian letters join (section 7)
    for (const el of all) {
      const text = ownText(el);
      if (!persian.test(text) || !visible(el)) continue;
      const style = getComputedStyle(el);
      if (readColour(style.color).alpha < 255) alphaText.push(`${el.tagName.toLowerCase()} «${text.slice(0, 20)}»: ${style.color}`);
      const size = parseFloat(style.fontSize);
      const ratio =
        style.lineHeight === 'normal' ? 'normal' : Number((parseFloat(style.lineHeight) / size).toFixed(2));
      const lineTops = new Set();
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) lineTops.add(Math.round(rect.top));
      }
      let problem = '';
      if (ratio === 'normal') problem = 'line-height normal';
      else if (ratio < 1.3) problem = 'below 1.3';
      else if (ratio < 1.5 && (clips(el) || clips(el.parentElement)))
        problem = 'clipped or truncated text below 1.5';
      else if (lineTops.size >= 3 && ratio < 1.6) problem = 'paragraph below 1.6';
      const key = `${problem ? `${problem}: ` : ''}${el.tagName.toLowerCase()} ${size}px/${ratio}`;
      lineHeights.set(key, (lineHeights.get(key) ?? 0) + 1);
    }

    // Numbers (sections 2 and 7): tabular figures belong on numbers that change in place and on aligned columns,
    // never on a static price. Short texts with at least two digits; the reader decides which kind each one is.
    const numbers = all
      .filter((el) => /[۰-۹0-9][^۰-۹0-9]*[۰-۹0-9]/.test(ownText(el)) && ownText(el).length <= 24 && visible(el))
      .map((el) => {
        const tabular = getComputedStyle(el).fontVariantNumeric.includes('tabular-nums');
        return `${tabular ? 'tabular' : 'proportional'}: ${ownText(el).slice(0, 30)}`;
      });

    // Icon strokes against the stem of their label (section 6). Stems are Vazirmatn 33.003's alef as a share of the
    // font size, measured for CS-26; re-measure when CS-3 picks the font.
    const stemShare = { 400: 0.0825, 500: 0.104, 600: 0.113, 700: 0.122 };
    const icons = [];
    for (const svg of document.querySelectorAll('svg')) {
      const box = svg.getBoundingClientRect();
      if (!visible(svg) || box.width === 0 || box.width > 32) continue;
      const shape = svg.querySelector('path, line, polyline, polygon, circle, rect, ellipse');
      if (!shape) continue;
      const shapeStyle = getComputedStyle(shape);
      if (shapeStyle.stroke === 'none') continue; // a filled glyph has no stroke to match
      const viewBoxWidth = svg.viewBox.baseVal?.width || box.width;
      const scale = shapeStyle.vectorEffect === 'non-scaling-stroke' ? 1 : box.width / viewBoxWidth;
      const stroke = parseFloat(shapeStyle.strokeWidth) * scale;
      const holder = svg.parentElement;
      const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => (node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
      });
      const textNode = walker.nextNode();
      if (!textNode) {
        icons.push(
          `${nameOf(holder)}: ${Math.round(box.width)} px icon, stroke ${stroke.toFixed(2)} px, no label`,
        );
        continue;
      }
      const textStyle = getComputedStyle(textNode.parentElement);
      const weight = Math.min(700, Math.max(400, Math.round(parseInt(textStyle.fontWeight, 10) / 100) * 100));
      const stem = parseFloat(textStyle.fontSize) * stemShare[weight];
      const off = Math.abs(stroke - stem) > 0.25 ? 'OFF ' : '';
      icons.push(
        `${off}${nameOf(holder)}: ${Math.round(box.width)} px icon, stroke ${stroke.toFixed(2)} px, label stem ${stem.toFixed(2)} px (${textStyle.fontSize}, ${weight})`,
      );
    }

    // Hue budget (section 6): computed colours of visible elements, through a 1×1 canvas to sRGB, then OKLCH;
    // chroma above 0.04, bucketed by 30° of hue. Expect the action hue plus the states on screen.
    const toOklch = (css) => {
      const { r, g, b, alpha } = readColour(css);
      if (alpha === 0) return null;
      const linear = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
      const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
      const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
      const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
      const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
      const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
      const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
      const hue = (Math.atan2(okB, okA) * 180) / Math.PI;
      return { lightness, chroma: Math.hypot(okA, okB), hue: (hue + 360) % 360 };
    };
    const hues = new Map();
    const addColour = (el, property, css) => {
      const colour = toOklch(css);
      if (!colour || colour.chroma <= 0.04) return;
      const bucket = `${Math.floor(colour.hue / 30) * 30}°`;
      const entry = hues.get(bucket) ?? { count: 0, example: '' };
      entry.count += 1;
      entry.example ||= `${property} of ${nameOf(el)}: oklch(${colour.lightness.toFixed(2)} ${colour.chroma.toFixed(3)} ${Math.round(colour.hue)})`;
      hues.set(bucket, entry);
    };
    for (const el of all) {
      if (!visible(el)) continue;
      const s = getComputedStyle(el);
      if (ownText(el)) addColour(el, 'color', s.color);
      addColour(el, 'background', s.backgroundColor);
      if (parseFloat(s.borderTopWidth) + parseFloat(s.borderInlineStartWidth) > 0)
        addColour(el, 'border', s.borderTopColor);
      if (el instanceof SVGElement) {
        if (s.fill !== 'none') addColour(el, 'fill', s.fill);
        if (s.stroke !== 'none') addColour(el, 'stroke', s.stroke);
      }
    }

    const cap = (list) =>
      list.length > LIMIT ? [...list.slice(0, LIMIT), `… and ${list.length - LIMIT} more`] : list;
    return {
      url: location.href,
      viewport: `${innerWidth}×${innerHeight}`,
      // the body's first font family and whether it has loaded; the stem table below is for Vazirmatn 33 until
      // CS-3 re-measures the bought font
      font: (() => {
        const family = getComputedStyle(document.body).fontFamily.split(',')[0].trim();
        return `${family}, loaded: ${document.fonts.check(`16px ${family}`)}`;
      })(),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      layoutShift: Number(layoutShift.toFixed(4)),
      targets: { checked: controls.length, inlineLinksExempt: inlineLinks, smallerThan44: cap(smallTargets) },
      lineHeights: cap(
        [...lineHeights]
          .sort(([a], [b]) => Number(b.includes(':')) - Number(a.includes(':')) || a.localeCompare(b))
          .map(([key, count]) => `${key} ×${count}`),
      ),
      alphaTextColours: cap(alphaText),
      numbers: cap(numbers),
      icons: cap(icons.sort((a, b) => Number(b.startsWith('OFF')) - Number(a.startsWith('OFF')))),
      hues: Object.fromEntries([...hues].sort(([, a], [, b]) => b.count - a.count)),
    };
  });

  // Reduced motion (section 1): what still runs once the preference is set. A spinner may keep turning (progress);
  // shimmer, slides, scale and staggers must not.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  measured.runningUnderReducedMotion = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
      .map((animation) => {
        const target = animation.effect?.target;
        const what = animation.animationName ?? animation.transitionProperty ?? 'script animation';
        return `${what} on ${target ? target.tagName.toLowerCase() : 'unknown'}${target?.className ? `.${String(target.className.baseVal ?? target.className).split(' ')[0]}` : ''}`;
      })
      .slice(0, 15),
  );
  await page.emulateMedia({ reducedMotion: null });
  return measured;
}
