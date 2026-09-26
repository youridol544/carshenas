const table = (headers, rows) =>
  rows.length
    ? [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(
          (row) =>
            `| ${row
              .map((cell) =>
                String(cell ?? '')
                  .replace(/\|/g, '\\|')
                  .replace(/\n/g, ' '),
              )
              .join(' | ')} |`,
        ),
      ].join('\n')
    : '_none found_';
const counts = (list, n = 12) =>
  (list ?? [])
    .slice(0, n)
    .map((item) => `\`${item.value}\` ×${item.count}`)
    .join(' · ') || '_none_';
const kb = (bytes) => `${Math.round((bytes ?? 0) / 1024)} KB`;

export function tokensReport(meta, perViewport, css) {
  const out = [
    `# Design tokens: ${meta.url}`,
    '',
    `Captured ${meta.capturedAt}. Values are computed styles sampled from visible elements, so they describe what this page uses, with frequencies. Declared tokens come from the CSS text. Measurements only: no page copy, names or prices are recorded here; look at the local screenshots for context.`,
    '',
  ];
  for (const [name, data] of Object.entries(perViewport)) {
    const t = data.tokens;
    out.push(
      `## Viewport: ${name} (${data.viewport.width}×${data.viewport.height}, ${t.sampledElements} elements sampled)`,
      '',
      `Document: lang \`${t.document.lang}\`, dir \`${t.document.dir}\`. Page height ${data.pageHeight}px.`,
      '',
      '### Colours',
      '',
      `- Text: ${counts(t.colors.text)}`,
      `- Backgrounds (by element count): ${counts(t.colors.background)}`,
      `- Backgrounds (by painted area): ${counts(t.colors.backgroundByArea, 6)}`,
      `- Borders: ${counts(t.colors.border, 8)}`,
      '',
      '### Typography',
      '',
      `- Font stacks: ${counts(t.typography.families, 6)}`,
      `- Sizes: ${counts(t.typography.sizes, 14)}`,
      `- Weights: ${counts(t.typography.weights)}`,
      `- Line heights: ${counts(t.typography.lineHeights, 8)}`,
      '',
      table(
        ['Role', 'Family', 'Size', 'Weight', 'Line height', 'Letter spacing', 'Colour'],
        Object.entries(t.typography.representative).map(([role, s]) => [
          role,
          s.fontFamily,
          s.fontSize,
          s.fontWeight,
          s.lineHeight,
          s.letterSpacing,
          s.color,
        ]),
      ),
      '',
      'Most used text styles (family | size | weight | line-height | letter-spacing | transform):',
      '',
      table(
        ['Style', 'Uses', 'First seen on'],
        t.typography.styles.slice(0, 14).map((s) => [s.value, s.count, `<${s.tag}>`]),
      ),
      '',
      '### Spacing, shape and depth',
      '',
      `- Padding and margin values: ${counts(t.spacing, 18)}`,
      `- Gaps: ${counts(t.gaps)}`,
      `- Radii: ${counts(t.radii)}`,
      `- Border widths: ${counts(t.borderWidths)}`,
      `- Shadows: ${
        (t.shadows ?? [])
          .slice(0, 5)
          .map((s) => `\`${s.value}\` ×${s.count}`)
          .join('<br>') || '_none_'
      }`,
      '',
      '### Layout and motion',
      '',
      `- Container max-widths: ${counts(t.layout.maxWidths)}`,
      `- Flex containers: ${t.layout.flexContainers}, grid containers: ${t.layout.gridContainers}`,
      `- z-index values: ${counts(t.layout.zIndexes)}`,
      `- Transitions: ${counts(t.motion, 6)}`,
      '',
      `### Loaded fonts`,
      '',
      table(
        ['Family', 'Weight', 'Style'],
        [
          ...new Map(
            t.fonts.map((f) => [`${f.family}|${f.weight}|${f.style}`, [f.family, f.weight, f.style]]),
          ).values(),
        ].slice(0, 16),
      ),
      '',
    );
    if (data.components?.length)
      out.push(
        '### Component samples',
        '',
        table(
          ['Id', 'Size', 'Background', 'Colour', 'Border', 'Radius', 'Padding', 'Font', 'Screenshot'],
          data.components.map((c) => [
            c.id,
            `${c.width}×${c.height}`,
            c.style.background,
            c.style.color,
            c.style.border,
            c.style.radius,
            c.style.padding,
            c.style.font,
            c.screenshot ?? '',
          ]),
        ),
        '',
      );
  }
  out.push(
    '## Declared in CSS',
    '',
    `${css.stylesheets} stylesheets, ${kb(css.bytes)} of CSS.`,
    '',
    `- Breakpoints: ${counts(css.breakpoints, 16)}`,
    `- Font faces: ${css.fontFaces.total} (${css.fontFaces.families.map((f) => f.value).join(', ') || 'none'}); formats ${css.fontFaces.formats.join(', ') || 'n/a'}; variable ${css.fontFaces.variable}; subsetted ${css.fontFaces.subsetted}; font-display ${css.fontFaces.display.join(', ') || 'n/a'}`,
    `- Features: container queries ${css.features.containerQueries}, @supports ${css.features.supports}, layers ${css.features.layers.join(', ') || 'none'}, dark mode ${css.features.darkMode}, reduced motion ${css.features.reducedMotion}`,
    `- Colour functions: ${counts(css.features.colorFunctions)}`,
    `- Direction readiness: ${css.features.logicalProperties} logical properties vs ${css.features.physicalSides} physical left/right declarations; ${css.features.rtlSelectors} explicit RTL selectors`,
    '',
    '### Custom properties',
    '',
  );
  const props = { ...css.customProperties };
  for (const data of Object.values(perViewport)) Object.assign(props, data.tokens.customProperties);
  const names = Object.keys(props).sort();
  out.push(
    names.length
      ? table(
          ['Name', 'Value'],
          names.slice(0, 250).map((name) => [`\`${name}\``, `\`${props[name]}\``]),
        )
      : '_none declared on :root, html or body_',
    names.length > 250 ? `\n…and ${names.length - 250} more in tokens.json` : '',
    '',
  );
  return out.join('\n');
}

export function techReport(meta, tech) {
  const out = [
    `# Technology: ${meta.url}`,
    '',
    `Captured ${meta.capturedAt}. Every row names its evidence; absence of a row means "not detected", not "not used".`,
    '',
    table(
      ['Category', 'Technology', 'Version', 'Evidence'],
      tech.evidence.map((e) => [e.category, e.name, e.version ?? '', e.evidence]),
    ),
    '',
    '## Page facts',
    '',
    `- Main document: HTTP ${tech.main.status}, ${tech.main.mime}; security headers: CSP ${tech.headers.security.csp}, HSTS ${tech.headers.security.hsts}, X-Frame-Options ${tech.headers.security.frameOptions ?? 'none'}`,
    `- Viewport meta: \`${tech.page.meta.viewport}\`; theme colour ${tech.page.meta.themeColor ?? 'none'}; manifest ${tech.page.meta.manifest ? 'yes' : 'no'}; service worker controlling the page: ${tech.page.meta.serviceWorker}`,
    `- Images: ${tech.page.meta.images} \`<img>\` (${tech.page.meta.lazyImages} lazy), ${tech.page.meta.pictureElements} \`<picture>\`, ${tech.page.meta.inlineSvgs} inline SVGs`,
    tech.page.nextData
      ? `- Next.js data: page \`${tech.page.nextData.page}\`, locale ${tech.page.nextData.locale}, runtime config keys: ${tech.page.nextData.runtimeConfigKeys.join(', ') || 'none'}`
      : '',
    `- Robots: ${tech.robots}`,
    '',
    '## Globals the site adds to `window`',
    '',
    tech.page.globals.length ? tech.page.globals.map((g) => `\`${g}\``).join(' ') : '_none_',
    '',
  ];
  if (tech.headers.cspHosts.length)
    out.push(
      '## Hosts allowed by the Content-Security-Policy',
      '',
      tech.headers.cspHosts.map((h) => `\`${h}\``).join(' '),
      '',
    );
  if (tech.routes?.length)
    out.push(
      '## Routes published in the Next.js build manifest',
      '',
      tech.routes.map((r) => `\`${r}\``).join(' '),
      '',
    );
  if (tech.sourceMaps) {
    out.push(
      '## Packages seen in public source maps',
      '',
      `${tech.sourceMaps.maps.filter((m) => m.status === 200).length} of ${tech.sourceMaps.maps.length} probed maps were public; ${tech.sourceMaps.firstPartyFiles} first-party source files referenced (names and contents not stored).`,
      '',
      table(
        ['Package', 'Files'],
        tech.sourceMaps.packages.map((p) => [p.name, p.files]),
      ),
      '',
    );
  } else
    out.push(
      '## Source maps',
      '',
      'Not probed. Re-run with `--sourcemaps` to list npm packages from public source maps.',
      '',
    );
  return (
    out
      .filter((line) => line !== '')
      .join('\n')
      .replace(/\n(#+ )/g, '\n\n$1') + '\n'
  );
}

export function apiReport(meta, api, failures, consoleLog) {
  const out = [
    `# Network and API map: ${meta.url}`,
    '',
    `Captured ${meta.capturedAt}. Redacted by construction: no cookie, header, query or body values; JSON is reduced to key names, types and SCREAMING_CASE enum constants.`,
    '',
    `${api.totals.requests} requests to ${api.totals.hosts} hosts.`,
    '',
    table(
      ['Type', 'Requests', 'Transferred'],
      api.totals.byType.map((t) => [t.type, t.requests, kb(t.bytes)]),
    ),
    '',
    '## Hosts',
    '',
    table(
      ['Host', 'Party', 'Requests', 'Types'],
      api.hosts
        .slice(0, 40)
        .map((h) => [h.host, h.firstParty ? 'first' : 'third', h.requests, h.types.join(', ')]),
    ),
    '',
    '## Endpoints',
    '',
    table(
      ['Method', 'Host', 'Path pattern', 'GraphQL', 'Calls', 'Status', 'Query names'],
      api.endpoints
        .slice(0, 80)
        .map((e) => [
          e.method,
          e.host,
          `\`${e.path}\``,
          e.graphql ?? '',
          e.calls,
          e.statuses.join(','),
          e.query.join(', '),
        ]),
    ),
    '',
  ];
  const shaped = api.endpoints
    .filter((e) => e.responseShape !== undefined || e.requestShape !== undefined)
    .slice(0, 40);
  if (shaped.length) out.push('## Shapes', '');
  for (const e of shaped) {
    out.push(
      `### ${e.method} ${e.host}${e.path}${e.graphql ? ` — ${e.graphql}` : ''}`,
      '',
      `Request headers of note: ${e.requestHeaders.join(', ') || 'none'}.`,
      '',
    );
    if (e.requestShape !== undefined)
      out.push('Request:', '', '```json', JSON.stringify(e.requestShape, null, 2).slice(0, 3000), '```', '');
    if (e.responseShape !== undefined)
      out.push(
        'Response:',
        '',
        '```json',
        JSON.stringify(e.responseShape, null, 2).slice(0, 6000),
        '```',
        '',
      );
  }
  if (failures.length)
    out.push(
      '## Failed requests',
      '',
      table(
        ['Method', 'URL', 'Reason'],
        failures.slice(0, 30).map((f) => [f.method, f.url, f.reason]),
      ),
      '',
    );
  if (consoleLog.length)
    out.push('## Console errors and warnings', '', ...consoleLog.slice(0, 30).map((line) => `- ${line}`), '');
  return out.join('\n');
}

export function summaryReport(meta, perViewport, tech, api, css, files) {
  const first = Object.values(perViewport)[0].tokens;
  const stack = tech.evidence
    .filter((e) => ['framework', 'styling', 'ui-kit', 'data', 'platform'].includes(e.category))
    .map((e) => `${e.name}${e.version ? ` ${e.version}` : ''}`);
  const firstParty = api.endpoints.filter((e) => e.firstParty);
  return [
    `# Capture: ${meta.url}`,
    '',
    `- Captured: ${meta.capturedAt} with ${meta.tool}`,
    `- Final URL: ${meta.finalUrl}`,
    `- Title: ${first.document.title}`,
    `- Language and direction: \`${first.document.lang}\`, \`${first.document.dir}\``,
    `- Viewports: ${Object.entries(perViewport)
      .map(([n, d]) => `${n} ${d.viewport.width}×${d.viewport.height} (page ${d.pageHeight}px tall)`)
      .join('; ')}`,
    `- Authenticated: ${meta.authenticated}`,
    `- Robots: ${tech.robots}`,
    ...(meta.flowBlocked?.length ? [`- Flow navigations blocked: ${meta.flowBlocked.join('; ')}`] : []),
    ...(meta.flowStopped?.length
      ? [`- Flow ended early after a blocked navigation: ${meta.flowStopped.join('; ')}`]
      : []),
    '',
    '## Headlines',
    '',
    `- Stack: ${stack.join(', ') || 'no framework fingerprint found'}`,
    `- Hosting and CDN: ${
      tech.evidence
        .filter((e) => ['hosting', 'cdn'].includes(e.category))
        .map((e) => e.name)
        .join(', ') || 'unknown'
    }`,
    `- Bot protection signals: ${
      tech.evidence
        .filter((e) => /bot-protection/.test(e.category))
        .map((e) => e.name)
        .join(', ') || 'none seen'
    }`,
    `- Primary fonts: ${
      first.typography.families
        .slice(0, 2)
        .map((f) => f.value.split(',')[0])
        .join(' and ') || 'n/a'
    }`,
    `- Dominant text colours: ${first.colors.text
      .slice(0, 4)
      .map((c) => c.value)
      .join(', ')}; dominant surfaces: ${first.colors.backgroundByArea
      .slice(0, 4)
      .map((c) => c.value)
      .join(', ')}`,
    `- Breakpoints: ${
      css.breakpoints
        .slice(0, 8)
        .map((b) => b.value)
        .join(', ') || 'none found'
    }`,
    `- Network: ${api.totals.requests} requests, ${api.totals.hosts} hosts, ${firstParty.length} first-party API endpoints${api.endpoints.some((e) => e.graphql) ? ', GraphQL in use' : ''}`,
    '',
    '## Files',
    '',
    ...files.map((f) => `- \`${f.path}\` — ${f.what}`),
    '',
    '## Reading order for an agent',
    '',
    '1. This file. 2. `tokens.md` and the tiled screenshots (open the PNGs, do not guess). 3. `tech.md`. 4. `api.md`. Raw data under `raw/` may contain personal or session data: never copy it into the repository.',
    '',
  ].join('\n');
}
