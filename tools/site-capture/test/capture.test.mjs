// Runs the capture against the repo's Farsi RTL fixture site, whose stylesheet is the ground truth.
// node --test tools/site-capture/test/
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { capture } from '../capture.mjs';
import { challengeSign } from '../lib/challenge.mjs';
import { summarizeApi } from '../lib/network.mjs';
import { looksLikeCredential, pathPattern, shapeOf } from '../lib/redact.mjs';
import { decidingRule, genericRules } from '../lib/robots.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const PORT = 4179;
const ROBOTS_PORT = 4180;
const SECRETS = ['fixture-secret-query-123', 'fixture-secret-header-456', 'fixture-secret-cookie-789'];
let server, out, result;

before(
  async () => {
    server = spawn('node', [join(repo, 'e2e/site/serve.mjs')], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise((ok, fail) => {
      server.stdout.once('data', ok);
      server.once('error', fail);
    });
    out = await mkdtemp(join(tmpdir(), 'site-capture-'));
    result = await capture({
      url: `http://127.0.0.1:${PORT}/`,
      name: 'fixture',
      out,
      viewports: ['mobile', 'desktop'],
      locale: 'fa-IR',
      timezone: 'Asia/Tehran',
      wait: 0,
      delay: 0,
      timeout: 30_000,
      tiles: 2,
      scroll: true,
      raw: true,
      sourcemaps: true,
      distill: join(out, 'distilled'),
    });
  },
  { timeout: 120_000 },
);

after(async () => {
  server?.kill();
  if (out) await rm(out, { recursive: true, force: true });
});

test('captures both viewports with screenshots, tiles, HTML and an ARIA snapshot', async () => {
  const files = await readdir(result.outDir);
  for (const expected of [
    'mobile-viewport.png',
    'mobile-full.png',
    'mobile-tile-01.png',
    'desktop-viewport.png',
    'mobile-page.html',
    'mobile-aria.yml',
    'summary.md',
  ])
    assert.ok(files.includes(expected), `missing ${expected}`);
  assert.match(await readFile(join(result.outDir, 'mobile-aria.yml'), 'utf8'), /heading "خودروهای کارکرده"/);
  assert.equal(result.perViewport.mobile.viewport.width, 412);
  assert.equal(result.perViewport.desktop.viewport.width, 1440);
});

test('extracts the design tokens the fixture stylesheet declares', () => {
  const { tokens } = result.perViewport.mobile;
  assert.equal(tokens.document.dir, 'rtl');
  assert.ok(
    tokens.colors.background.some((c) => c.value === '#1f5c4d'),
    'primary background colour',
  );
  assert.ok(
    tokens.colors.text.some((c) => c.value === '#1d1d1b'),
    'text colour',
  );
  assert.ok(
    tokens.radii.some((r) => r.value === '12px') && tokens.radii.some((r) => r.value === '6px'),
    'radii',
  );
  assert.ok(
    tokens.typography.sizes.some((s) => s.value === '24px'),
    'mobile h1 size',
  );
  assert.ok(
    result.perViewport.desktop.tokens.typography.sizes.some((s) => s.value === '32px'),
    'desktop h1 size',
  );
  assert.equal(tokens.customProperties['--color-primary'], '#1f5c4d');
  assert.equal(result.css.customProperties['--radius-md'], '12px');
  assert.deepEqual(
    result.css.breakpoints.map((b) => b.value),
    ['min-width 768px'],
  );
  assert.ok(
    result.css.features.logicalProperties > 0 && result.css.features.physicalSides === 0,
    'fixture uses logical properties only',
  );
  assert.ok(
    result.perViewport.mobile.components.some((c) => c.kind === 'button' && c.screenshot),
    'component screenshot',
  );
});

test('maps the API as names and types only', () => {
  const endpoint = result.api.endpoints.find((e) => e.path === '/api/listings.json');
  assert.ok(endpoint, 'endpoint found');
  assert.equal(endpoint.method, 'GET');
  assert.deepEqual(endpoint.query, ['session']);
  assert.ok(endpoint.requestHeaders.includes('authorization'));
  assert.deepEqual(endpoint.responseShape, [
    {
      id: 'string',
      title: 'string',
      city: 'string',
      modelYear: 'integer',
      mileageKm: 'integer',
      askingPrice: 'integer',
    },
    '×4',
  ]);
});

test('keeps credentials out of every distilled file but leaves raw data in the ignored directory', async () => {
  for (const dir of [result.outDir, result.distilled]) {
    for (const file of [
      'summary.md',
      'tokens.md',
      'tech.md',
      'api.md',
      'tokens.json',
      'tech.json',
      'api.json',
    ]) {
      const text = await readFile(join(dir, file), 'utf8');
      for (const secret of SECRETS) assert.ok(!text.includes(secret), `${secret} leaked into ${file}`);
    }
  }
  assert.deepEqual((await readdir(result.distilled)).sort(), [
    'api.json',
    'api.md',
    'summary.md',
    'tech.json',
    'tech.md',
    'tokens.json',
    'tokens.md',
  ]);
  assert.match(await readFile(join(result.outDir, 'raw/mobile-bodies.json'), 'utf8'), /askingPrice/);
});

test('lists npm packages from a public source map without storing sources', () => {
  assert.deepEqual(result.tech.sourceMaps.packages, [
    { name: 'react-dom', files: 2 },
    { name: '@tanstack/query-core', files: 1 },
  ]);
  assert.equal(result.tech.sourceMaps.firstPartyFiles, 1);
  assert.ok(
    !JSON.stringify(result.tech.sourceMaps).includes('src/app.js'),
    'first-party file names are not recorded',
  );
});

test('summarises GraphQL by operation name and variable shape', () => {
  const entry = (postData) => ({
    method: 'POST',
    url: 'https://api.example.com/graphql?token=abc',
    type: 'fetch',
    status: 200,
    mime: 'application/json',
    requestHeaderNames: ['authorization', 'content-type'],
    responseHeaderNames: [],
    postData,
    body: '{"data":{"comparison":{"id":"c_123456789","state":"OPEN","listings":[{"listingId":"A1","position":2}]}}}',
  });
  const api = summarizeApi(
    [
      entry(
        JSON.stringify({
          operationName: 'GetComparison',
          query: 'query GetComparison($id: ID!) { comparison(id: $id) { id } }',
          variables: { id: 'c_123456789' },
        }),
      ),
      entry(
        JSON.stringify({
          operationName: 'AddToComparison',
          query:
            'mutation AddToComparison($listingId: String!) { addToComparison(listingId: $listingId) { id } }',
          variables: { listingId: 'A1', position: 2 },
        }),
      ),
    ],
    'https://www.example.com/',
  );
  assert.deepEqual(api.endpoints.map((e) => e.graphql).sort(), [
    'mutation AddToComparison',
    'query GetComparison',
  ]);
  const add = api.endpoints.find((e) => e.graphql === 'mutation AddToComparison');
  assert.deepEqual(add.requestShape, { listingId: 'string', position: 'integer' });
  assert.deepEqual(add.query, ['token']);
  assert.ok(
    !JSON.stringify(api).includes('abc') && !JSON.stringify(api).includes('c_123456789'),
    'no values',
  );
  assert.equal(add.firstParty, true);
});

test('applies a saved storage state (logged-in capture) when --own-account is given', async () => {
  const state = join(out, 'state.json');
  const seen = join(out, 'seen-cookie.txt');
  const flow = join(out, 'flow.mjs');
  await writeFile(
    state,
    JSON.stringify({
      cookies: [
        {
          name: 'fixture_login',
          value: 'buyer-42',
          domain: '127.0.0.1',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  );
  await writeFile(
    flow,
    `import { writeFile } from 'node:fs/promises';\nexport default async ({ page, step }) => { await writeFile(${JSON.stringify(seen)}, await page.evaluate(() => document.cookie)); await step('after login state'); };\n`,
  );
  const run = await capture({
    url: `http://127.0.0.1:${PORT}/`,
    name: 'state',
    out,
    viewports: ['mobile'],
    locale: 'fa-IR',
    wait: 0,
    delay: 0,
    timeout: 30_000,
    tiles: 1,
    scroll: false,
    storageState: state,
    ownAccount: true,
    flow,
  });
  assert.match(await readFile(seen, 'utf8'), /fixture_login=buyer-42/);
  assert.equal(run.meta.authenticated, true);
  assert.ok(
    (await readdir(run.outDir)).some((file) => file.startsWith('flow-mobile-01')),
    'flow step screenshot',
  );
});

test('attaches to an already running Chrome over CDP and leaves it running', async () => {
  const running = await chromium.launch({ args: ['--remote-debugging-port=9347'] });
  try {
    const keep = await (await running.newContext()).newPage();
    const run = await capture({
      url: `http://127.0.0.1:${PORT}/`,
      name: 'cdp',
      out,
      viewports: ['desktop'],
      locale: 'fa-IR',
      wait: 0,
      delay: 0,
      timeout: 30_000,
      tiles: 1,
      scroll: false,
      cdp: 'http://127.0.0.1:9347',
      ownAccount: true,
    });
    assert.equal(run.perViewport.desktop.viewport.width, 1440);
    assert.equal(run.perViewport.desktop.tokens.document.dir, 'rtl');
    assert.ok(running.isConnected(), "the human's browser must survive the capture");
    await keep.goto(`http://127.0.0.1:${PORT}/`);
    assert.equal(await keep.title(), 'کارشناس — سایت آزمایشی');
  } finally {
    await running.close();
  }
});

test('guardrails: logged-in modes need an explicit acknowledgement, and reports carry no page copy', async () => {
  await assert.rejects(
    capture({ url: `http://127.0.0.1:${PORT}/`, cdp: 'http://127.0.0.1:1', viewports: ['mobile'] }),
    /--own-account/,
  );
  await assert.rejects(
    capture({ url: `http://127.0.0.1:${PORT}/`, storageState: 'state.json', viewports: ['mobile'] }),
    /--own-account/,
  );
  const tokens = await readFile(join(result.outDir, 'tokens.md'), 'utf8');
  assert.ok(
    !tokens.includes('پژو') && !tokens.includes('اصفهان'),
    'listing titles and cities stay out of the token report',
  );
});

test('only opaque values count as credentials, so the page URL is never scrubbed', () => {
  assert.equal(looksLikeCredential('https://www.example.com/', 'www.example.com'), false);
  assert.equal(looksLikeCredential('example.com', 'www.example.com'), false);
  assert.equal(looksLikeCredential('homepage', 'www.example.com'), false);
  assert.equal(looksLikeCredential('fixture-secret-query-123', 'www.example.com'), true);
  assert.match(result.summary, /^# Capture: http:\/\/127\.0\.0\.1:4179\//);
  assert.equal(result.tech.page.globals.includes('caches'), false, 'browser built-ins are not site globals');
});

test('path patterns and shapes never carry identifiers or free text', () => {
  assert.equal(pathPattern('/dealer/d_9f8e7d6c5b/listings/991'), '/dealer/:d_id/listings/:id');
  assert.equal(pathPattern('/listings/3f2a1b4c-0d9e-4f7a-8b6c-5d4e3f2a1b0c'), '/listings/:uuid');
  assert.equal(
    pathPattern(
      '/cdn-cgi/challenge-platform/h/g/jsd/oneshot/330e41bb475c/0.4387:1789657515:Kgfg1U-tWAj5Ix_g',
    ),
    '/cdn-cgi/challenge-platform/h/g/jsd/oneshot/:hex/:token',
  );
  assert.deepEqual(
    shapeOf({
      email: 'sara@example.com',
      state: 'SOLD',
      fuel: 'DUAL_FUEL',
      trim: 'A1',
      code: 'VIN12345',
      token: 'abc',
      total: 12.5,
      note: 'سلام',
    }),
    {
      email: 'string(email)',
      state: 'enum(SOLD)',
      fuel: 'enum(DUAL_FUEL)',
      trim: 'string',
      code: 'string',
      token: 'redacted',
      total: 'number',
      note: 'string',
    },
  );
});

test('reads robots.txt as RFC 9309 does: shared groups, comments, CRLF, Allow and the longest match', () => {
  const rules = genericRules(
    [
      'User-agent: SomeBot',
      'Disallow: /',
      '',
      'User-agent: *',
      'User-agent: OtherBot',
      'Disallow: /private # members only',
      'Allow: /private/help',
      'Disallow: /*.json$',
      'Disallow: /search?*page=',
      'Sitemap: https://example.com/sitemap.xml',
    ].join('\r\n'),
  );
  const allowed = (path) => decidingRule(rules, path)?.allow !== false;
  assert.equal(allowed('/'), true, "another agent's Disallow: / does not apply");
  assert.equal(allowed('/private/listing/7'), false, 'a group that names * and another agent applies');
  assert.equal(allowed('/private/help/faq'), true, 'the longer Allow wins');
  assert.equal(allowed('/api/listings.json'), false);
  assert.equal(allowed('/api/listings.json?page=2'), true, '$ anchors the end');
  assert.equal(allowed('/search?model=pride&page=2'), false);
  assert.equal(allowed('/search?model=pride'), true);

  const farsi = genericRules('User-agent: *\rDisallow: /خودرو\rAllow: /%d8%ae%d9%88%d8%af%d8%b1%d9%88/help');
  assert.equal(farsi.length, 2, 'a bare CR ends a line too');
  assert.equal(
    decidingRule(farsi, new URL('https://example.ir/خودرو/7').pathname)?.allow,
    false,
    'a rule written in Farsi matches the percent-encoded path',
  );
  assert.equal(
    decidingRule(farsi, '/%D8%AE%D9%88%D8%AF%D8%B1%D9%88/help/faq')?.allow,
    true,
    'percent-escapes match whatever their case',
  );
});

const page = (body) =>
  `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>robots</title></head><body><h1>خودروهای کارکرده</h1>${body}</body></html>`;

/**
 * A site whose robots.txt disallows /private and, like CarGurus's CDN, answers a phone preset's bare request with
 * 406. Its start page links to every kind of navigation a flow can cause.
 */
async function robotsSite(run) {
  const site = { robotsStatus: 200, visited: [] };
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', `http://127.0.0.1:${ROBOTS_PORT}`);
    if (pathname === '/robots.txt') {
      const phone = /Mobile/.test(request.headers['user-agent'] ?? '');
      const status = site.robotsStatus === 200 && phone ? 406 : site.robotsStatus;
      response.writeHead(status, { 'content-type': 'text/plain' });
      return response.end(status === 200 ? 'User-agent: *\r\nDisallow: /private\r\n' : '');
    }
    site.visited.push(pathname);
    if (pathname === '/go') {
      response.writeHead(302, { location: '/private/landing' });
      return response.end();
    }
    if (pathname === '/refused') {
      response.writeHead(403, { 'content-type': 'text/html; charset=utf-8' });
      return response.end(page(''));
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    // Like DataDome on CarGurus: the page loads intact with HTTP 200, then a challenge takes over the screen.
    if (pathname === '/late-challenge')
      return response.end(
        page(
          `<script>setTimeout(() => { document.body.innerHTML = '<h1>Access is temporarily restricted</h1><p>We detected unusual activity from your device or network.</p>'; }, 1000);</script>`,
        ),
      );
    response.end(
      page(
        [
          '<a href="/private/next">آگهی ویژه</a>',
          `<a href="http://localhost:${ROBOTS_PORT}/elsewhere">سایت دیگر</a>`,
          '<a href="/private/popup" target="_blank">پنجره تازه</a>',
          '<a href="/go">پیوند کوتاه</a>',
          `<a href="/spa" onclick="event.preventDefault(); history.pushState(null, '', '/private/spa')">درون صفحه</a>`,
          '<a href="/refused">ممنوع</a>',
        ].join(' '),
      ),
    );
  });
  await new Promise((listening) => server.listen(ROBOTS_PORT, '127.0.0.1', listening));
  try {
    await run(site);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

const quick = () => ({
  name: 'robots',
  out,
  viewports: ['mobile'],
  locale: 'fa-IR',
  wait: 0,
  delay: 0,
  timeout: 30_000,
  tiles: 1,
  scroll: false,
});

test('refuses a path robots.txt disallows, whatever the device preset, and an unreadable robots.txt, before any page loads', async () => {
  await robotsSite(async (site) => {
    await assert.rejects(
      capture({ ...quick(), url: `http://127.0.0.1:${ROBOTS_PORT}/private/listing` }),
      /robots\.txt disallows this path for generic agents \(rule `\/private`\)\. Not capturing/,
    );
    site.robotsStatus = 503;
    await assert.rejects(
      capture({ ...quick(), url: `http://127.0.0.1:${ROBOTS_PORT}/` }),
      /robots\.txt could not be read \(HTTP 503\), so every path counts as disallowed/,
    );
    assert.deepEqual(site.visited, [], 'no page was loaded');
  });
});

/** Writes a flow script that clicks the given links in order and takes a step after each. */
const flowClicking = async (file, ...links) => {
  const path = join(out, file);
  await writeFile(
    path,
    `export default async ({ page, step }) => {\n${links
      .map(
        (name) =>
          `  await page.getByRole('link', { name: '${name}' }).click();\n  await step('after ${name}');\n`,
      )
      .join('')}};\n`,
  );
  return path;
};

test('a flow cannot open a page robots.txt disallows, another site or such a pop-up: the tab stays put and the summary says so', async () => {
  await robotsSite(async (site) => {
    const flow = await flowClicking('fenced-flow.mjs', 'آگهی ویژه', 'سایت دیگر', 'پنجره تازه');
    const run = await capture({ ...quick(), url: `http://127.0.0.1:${ROBOTS_PORT}/`, flow });
    assert.ok(
      !site.visited.some((path) => path.startsWith('/private') || path === '/elsewhere'),
      site.visited.join(' '),
    );
    assert.equal(run.meta.flowBlocked.length, 3, run.meta.flowBlocked.join('\n'));
    assert.match(
      run.meta.flowBlocked[0],
      /^mobile: http:\/\/127\.0\.0\.1:4180\/private\/next \(robots\.txt disallows this path/,
    );
    assert.match(run.meta.flowBlocked[1], /^mobile: http:\/\/localhost:4180\/elsewhere \(another site\)$/);
    assert.match(
      run.meta.flowBlocked[2],
      /^mobile: http:\/\/127\.0\.0\.1:4180\/private\/popup \(robots\.txt disallows/,
    );
    assert.equal(run.perViewport.mobile.tokens.document.title, 'robots', 'the tab stayed on the start page');
    assert.match(run.summary, /- Robots: robots\.txt has 1 rule for generic agents; this path is allowed/);
    assert.match(run.summary, /- Flow navigations blocked: mobile: /);
    const shots = (await readdir(run.outDir)).filter((file) => file.startsWith('flow-mobile-'));
    assert.equal(shots.length, 3, 'every flow step was photographed');
  });
});

test('stops, before photographing it, when a redirect or an in-page navigation reaches a disallowed page or the site refuses a page view', async () => {
  await robotsSite(async (site) => {
    const start = `http://127.0.0.1:${ROBOTS_PORT}/`;
    const cases = [
      {
        name: 'start-redirect',
        url: `${start}go`,
        error: /reached http:\/\/127\.0\.0\.1:4180\/private\/landing on load \(robots\.txt disallows/,
      },
      {
        name: 'flow-redirect',
        link: 'پیوند کوتاه',
        error: /reached http:\/\/127\.0\.0\.1:4180\/private\/landing during the flow \(robots\.txt disallows/,
      },
      {
        name: 'flow-in-page',
        link: 'درون صفحه',
        error: /reached http:\/\/127\.0\.0\.1:4180\/private\/spa during the flow \(robots\.txt disallows/,
      },
      {
        name: 'flow-refused',
        link: 'ممنوع',
        error: /answered HTTP 403 for http:\/\/127\.0\.0\.1:4180\/refused during the flow: it is blocking/,
      },
    ];
    for (const { name, url, link, error } of cases) {
      const flow = link ? await flowClicking(`${name}.mjs`, link) : undefined;
      await assert.rejects(capture({ ...quick(), name, url: url ?? start, flow }), error, name);
      const files = await readdir(join(out, name), { recursive: true });
      assert.ok(!files.some((file) => /flow-.*\.png$/.test(file)), `${name}: ${files.join(' ')}`);
      if (url) assert.ok(!files.some((file) => file.endsWith('.png')), `${name}: ${files.join(' ')}`);
    }
    // A redirect is followed by the browser before anything can judge it; the capture only refuses to use it.
    assert.deepEqual(
      site.visited.filter((path) => path.startsWith('/private')),
      ['/private/landing', '/private/landing'],
    );
  });
});

test("recognises a challenge by its title, a challenge-only host or a short page saying so, not by a site's everyday bot tag", () => {
  assert.equal(challengeSign({ title: 'Just a moment...' }), 'the title "Just a moment..."');
  assert.equal(
    challengeSign({ hosts: ['www.cargurus.com', 'js.datadome.co', 'api-js.datadome.co'] }),
    undefined,
    'DataDome watching an unchallenged page is no challenge',
  );
  assert.equal(
    challengeSign({ hosts: ['www.cargurus.com', 'static.captcha-delivery.com'] }),
    'a request to static.captcha-delivery.com',
  );
  assert.equal(
    challengeSign({ text: 'Access is temporarily restricted\nWe detected unusual activity.' }),
    'the page saying "Access is temporarily restricted"',
  );
  assert.equal(
    challengeSign({ text: 'Just a moment, loading the results…' }),
    undefined,
    'an ordinary short page may say it; only a title saying it counts',
  );
  assert.equal(
    challengeSign({ text: `${'A long article about car security. '.repeat(100)}Are you a robot?` }),
    undefined,
    'a long page that merely mentions the words',
  );
});

test('stops when a challenge takes over the page after it loaded, before any screenshot', async () => {
  await robotsSite(async (site) => {
    await assert.rejects(
      // The challenge arrives 1 s after load: after the check on load, well before the one after a 2 s wait.
      capture({
        ...quick(),
        name: 'late-challenge',
        wait: 2_000,
        url: `http://127.0.0.1:${ROBOTS_PORT}/late-challenge`,
      }),
      /bot challenge after loading \(the page saying "Access is temporarily restricted"\)\. This tool does not evade/,
    );
    assert.deepEqual(site.visited, ['/late-challenge'], 'one page view, no retry');
    const shots = await readdir(join(out, 'late-challenge'), { recursive: true });
    assert.ok(!shots.some((file) => file.endsWith('.png')), shots.join(' '));
  });
});
