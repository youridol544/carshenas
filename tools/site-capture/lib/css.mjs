// CSS text analysis. Cross-origin stylesheets cannot be read through CSSOM, so the capture keeps the
// text of every stylesheet response (and inline <style>) and reads declarations from there.

const bump = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
const top = (map, n) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));

export function analyzeCss(sheets) {
  const media = new Map(),
    breakpoints = new Map(),
    customProperties = {},
    fontFaces = [],
    layers = new Set();
  const colorFunctions = new Map();
  let bytes = 0,
    containerQueries = 0,
    logicalProperties = 0,
    physicalSides = 0,
    supports = 0,
    darkMode = false,
    reducedMotion = false,
    rtlSelectors = 0;

  for (const { text } of sheets) {
    if (!text) continue;
    bytes += text.length;
    const css = text.replace(/\/\*[\s\S]*?\*\//g, '');

    for (const match of css.matchAll(/@media\s*([^{]+)\{/g)) {
      const condition = match[1].trim().replace(/\s+/g, ' ');
      bump(media, condition);
      if (/prefers-color-scheme:\s*dark/.test(condition)) darkMode = true;
      if (/prefers-reduced-motion/.test(condition)) reducedMotion = true;
      for (const bp of condition.matchAll(
        /\(\s*(min|max)-width\s*:\s*([\d.]+)(px|em|rem)\s*\)|\(\s*width\s*(>=|<=|>|<)\s*([\d.]+)(px|em|rem)\s*\)/g,
      )) {
        const kind = bp[1] ?? (bp[4].startsWith('>') ? 'min' : 'max');
        const amount = parseFloat(bp[2] ?? bp[5]);
        const unit = bp[3] ?? bp[6];
        const px = unit === 'px' ? amount : amount * 16;
        bump(
          breakpoints,
          `${kind}-width ${Math.round(px * 100) / 100}px${unit === 'px' ? '' : ` (${amount}${unit})`}`,
        );
      }
    }
    containerQueries += (css.match(/@container\b/g) ?? []).length;
    supports += (css.match(/@supports\b/g) ?? []).length;
    for (const layer of css.matchAll(/@layer\s+([^;{]+)[;{]/g))
      for (const name of layer[1].split(',')) layers.add(name.trim());

    for (const block of css.matchAll(
      /(?:^|[}\s,])((?::root|html|body|\[data-theme[^\]]*\])[^{}]*)\{([^{}]*)\}/g,
    )) {
      for (const decl of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) {
        if (!(decl[1] in customProperties)) customProperties[decl[1]] = decl[2].trim().slice(0, 160);
      }
    }

    for (const face of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const get = (name) => face[1].match(new RegExp(`${name}\\s*:\\s*([^;]+)`, 'i'))?.[1]?.trim();
      const formats = [...(get('src') ?? '').matchAll(/format\(\s*["']?([\w-]+)/g)].map((m) => m[1]);
      fontFaces.push({
        family: (get('font-family') ?? '').replace(/["']/g, ''),
        weight: get('font-weight') ?? 'normal',
        style: get('font-style') ?? 'normal',
        display: get('font-display') ?? null,
        formats: [...new Set(formats)],
        subsetted: /unicode-range/i.test(face[1]),
      });
    }

    for (const fn of css.matchAll(/\b(oklch|oklab|lch|lab|color-mix|hsl|hsla|rgb|rgba|hwb|light-dark)\(/g))
      bump(colorFunctions, fn[1]);
    logicalProperties += (
      css.match(
        /\b(margin|padding|border|inset)-(inline|block)(-start|-end)?\b|\binline-size\b|\bblock-size\b|text-align\s*:\s*(start|end)/g,
      ) ?? []
    ).length;
    physicalSides += (css.match(/\b(margin|padding)-(left|right)\b|\b(left|right)\s*:/g) ?? []).length;
    rtlSelectors += (css.match(/\[dir=["']?rtl|:dir\(rtl\)/g) ?? []).length;
  }

  const families = new Map();
  for (const face of fontFaces) bump(families, face.family);

  return {
    stylesheets: sheets.length,
    bytes,
    breakpoints: top(breakpoints, 16),
    mediaConditions: top(media, 12),
    customProperties,
    fontFaces: {
      families: top(families, 10),
      total: fontFaces.length,
      variable: fontFaces.some((f) => /\d+\s+\d+/.test(f.weight)),
      formats: [...new Set(fontFaces.flatMap((f) => f.formats))],
      subsetted: fontFaces.some((f) => f.subsetted),
      display: [...new Set(fontFaces.map((f) => f.display).filter(Boolean))],
    },
    features: {
      containerQueries,
      supports,
      layers: [...layers].slice(0, 12),
      darkMode,
      reducedMotion,
      colorFunctions: top(colorFunctions, 8),
      logicalProperties,
      physicalSides,
      rtlSelectors,
    },
  };
}
