#!/usr/bin/env node
// Capture one page of a public site into a distilled design, technology and API reference.
// Usage: pnpm capture <url> [options]   (see README.md). One polite page load per viewport, no crawling,
// no stealth: if robots.txt refuses the page or the site blocks or challenges automation, the tool stops and says so.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium, devices, request as httpClient } from 'playwright';
import { challengeSign } from './lib/challenge.mjs';
import { analyzeCss } from './lib/css.mjs';
import { autoScroll, extractTokens, installProbes, probeTechnology, tagComponents } from './lib/inpage.mjs';
import { recordNetwork, summarizeApi } from './lib/network.mjs';
import { describeUrl, isSensitiveName, looksLikeCredential, pathPattern } from './lib/redact.mjs';
import { apiReport, summaryReport, techReport, tokensReport } from './lib/report.mjs';
import { decidingRule, genericRules } from './lib/robots.mjs';
import {
  analyzeBanners,
  analyzeCookies,
  analyzeHeaders,
  analyzeHosts,
  analyzePaths,
  analyzeSourceMaps,
  mergeEvidence,
  nextRoutes,
} from './lib/tech.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const DISTILLED = ['summary.md', 'tokens.md', 'tech.md', 'api.md', 'tokens.json', 'tech.json', 'api.json'];

const PRESETS = {
  mobile: { ...devices['Pixel 7'] },
  tablet: { ...devices['iPad (gen 7)'] },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'capture';

// robots.txt is read with Playwright's plain HTTP client rather than an emulated device: some CDNs answer a phone
// preset's bare request with 406 (CarGurus does). 404 and 410 mean there are no rules. The tool is stricter than
// RFC 9309, which lets a crawler treat any other 4xx as "no rules" too: here any answer but a 2xx, 404 or 410, and
// any network error, disallows every path, so a file that cannot be read never passes for permission.
async function readRobots(url, proxy) {
  const client = await httpClient.newContext({ proxy: proxy ? { server: proxy } : undefined });
  try {
    const response = await client.get(new URL('/robots.txt', url).href, { timeout: 10_000 });
    const status = response.status();
    if (status === 404 || status === 410) return { rules: [], note: `no robots.txt (HTTP ${status})` };
    if (!response.ok()) return { note: `robots.txt could not be read (HTTP ${status})` };
    const rules = genericRules(await response.text());
    return {
      rules,
      note: `robots.txt has ${rules.length} rule${rules.length === 1 ? '' : 's'} for generic agents`,
    };
  } catch (error) {
    return { note: `robots.txt could not be fetched (${error.message.split('\n')[0]})` };
  } finally {
    await client.dispose();
  }
}

/** Why robots.txt refuses `target`, or undefined when it allows it. */
function robotsRefusal(robots, target) {
  if (!robots.rules) return `${robots.note}, so every path counts as disallowed`;
  const { pathname, search } = new URL(target);
  const rule = decidingRule(robots.rules, pathname + search);
  return rule && !rule.allow
    ? `robots.txt disallows this path for generic agents (rule \`${rule.rule}\`)`
    : undefined;
}

/** Where a URL points, as reports show it: origin and path pattern, without identifiers or query. */
const placeOf = (raw) => {
  try {
    const { origin, pathname } = new URL(raw);
    return `${origin}${pathPattern(pathname)}`;
  } catch {
    return String(raw).slice(0, 80);
  }
};

const STOP = 'This tool does not evade bot protection. Stop here and study the page by hand.';
/** A reason to end the whole capture at once; a flow never swallows one. */
class Stop extends Error {}

export async function capture(options) {
  const url = new URL(options.url).href;
  const pageHost = new URL(url).host;
  if (!/^https?:$/.test(new URL(url).protocol)) throw new Error('only http(s) URLs are supported');
  if ((options.cdp || options.storageState) && !options.ownAccount)
    throw new Error(
      "logged-in capture needs --own-account: it confirms the session is your own account, obtained under the site's terms, and that those terms allow tools other than a plain browser. When in doubt, browse by hand with DevTools instead.",
    );
  if (options.cdp && options.har) {
    console.error('note: --har is ignored with --cdp (an attached context cannot record one)');
    options.har = false;
  }
  const robots = await readRobots(url, options.proxy);
  // Read once per origin: a redirect (to www., through a short link) is judged by the robots.txt of where it lands.
  const robotsByOrigin = new Map([[new URL(url).origin, robots]]);
  const robotsOf = async (origin) => {
    if (!robotsByOrigin.has(origin)) robotsByOrigin.set(origin, await readRobots(origin, options.proxy));
    return robotsByOrigin.get(origin);
  };
  const refusal = robotsRefusal(robots, url);
  if (refusal && !options.allowDisallowed)
    throw new Error(
      `${refusal}. Not capturing. A person may still look at the page in a browser; pass --allow-disallowed only if the site owner permits automated access to it.`,
    );
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const outDir = resolve(options.out ?? join(repoRoot, '.captures'), options.name ?? slug(url), stamp);
  const rawDir = join(outDir, 'raw');
  await mkdir(join(outDir, 'components'), { recursive: true });
  if (options.raw || options.har) await mkdir(rawDir, { recursive: true });

  const browser = options.cdp
    ? await chromium.connectOverCDP(options.cdp)
    : await chromium.launch({
        headless: !options.headed,
        channel: options.channel,
        proxy: options.proxy ? { server: options.proxy } : undefined,
      });

  const perViewport = {};
  const allEntries = [];
  const failures = [];
  const consoleLog = [];
  const secrets = new Set();
  const files = [];
  const flowBlocked = [];
  const flowStopped = [];
  let openPage;
  let stylesheets = [],
    scripts = [],
    main,
    pageProbe,
    cookies = [],
    sourceMaps,
    routes = [],
    finalUrl = url;

  try {
    for (const name of options.viewports) {
      const preset = PRESETS[name];
      if (!preset) throw new Error(`unknown viewport "${name}" (use ${Object.keys(PRESETS).join(', ')})`);
      const context = options.cdp
        ? browser.contexts()[0]
        : await browser.newContext({
            ...preset,
            locale: options.locale,
            timezoneId: options.timezone,
            storageState: options.storageState,
            serviceWorkers: 'block',
            recordHar: options.har ? { path: join(rawDir, `${name}.har`), content: 'embed' } : undefined,
          });
      const page = await context.newPage();
      openPage = page;
      if (options.cdp) await page.setViewportSize(preset.viewport);
      const baseline = await page.evaluate(() => Object.keys(window));
      await page.addInitScript(installProbes);
      const net = recordNetwork(page, { keepRaw: options.raw });
      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type()))
          consoleLog.push(`[${name}] ${message.type()}: ${message.text().slice(0, 240)}`);
      });
      page.on('pageerror', (error) => consoleLog.push(`[${name}] pageerror: ${error.message.slice(0, 240)}`));
      const hostsSeen = new Set();
      page.on('request', (request) => {
        for (const [header, value] of Object.entries(request.headers()))
          if (isSensitiveName(header))
            value
              .split(/[\s;,=]+/)
              .filter((part) => looksLikeCredential(part, pageHost))
              .forEach((part) => secrets.add(part));
        try {
          const { hostname, searchParams } = new URL(request.url());
          hostsSeen.add(hostname);
          for (const [key, value] of searchParams)
            if (isSensitiveName(key) && looksLikeCredential(value, pageHost)) secrets.add(value);
        } catch {
          /* ignore */
        }
      });
      let refusedStatus;
      page.on('response', (response) => {
        if (![401, 403, 429, 503].includes(response.status())) return;
        try {
          if (response.request().isNavigationRequest() && response.frame() === page.mainFrame())
            refusedStatus ??= `HTTP ${response.status()} for ${placeOf(response.url())}`;
        } catch {
          /* a response without a frame is no page view */
        }
      });
      // What ends the capture, looked for again at every stage because each can arrive late: the tab now shows a
      // path robots.txt disallows, or leaves the flow's site (a redirect or an in-page navigation, which the
      // flow's fence cannot see coming); the site refused a page view; or a bot challenge covers the page.
      // It runs before every screenshot, so nothing past that point is photographed.
      let siteOrigin;
      const checkpoint = async (moment) => {
        const here = new URL(page.url());
        const away = !/^https?:$/.test(here.protocol)
          ? 'not a web page'
          : siteOrigin && here.origin !== siteOrigin
            ? 'another site'
            : !options.allowDisallowed && robotsRefusal(await robotsOf(here.origin), here.href);
        if (away)
          throw new Stop(`the tab reached ${placeOf(here.href)} ${moment} (${away}). Not capturing it.`);
        if (refusedStatus)
          throw new Stop(
            `the site answered ${refusedStatus} ${moment}: it is blocking or challenging automation. ${STOP}`,
          );
        const sign = challengeSign({
          title: await page.title().catch(() => ''),
          hosts: [...hostsSeen],
          text: await page.evaluate(() => (document.body?.innerText ?? '').slice(0, 3_001)).catch(() => ''),
        });
        if (sign) throw new Stop(`the site showed a bot challenge ${moment} (${sign}). ${STOP}`);
      };

      const response = await page.goto(url, { waitUntil: 'load', timeout: options.timeout });
      if ([401, 403, 429, 503].includes(response?.status() ?? 0))
        throw new Error(
          `the site answered HTTP ${response.status()} "${(await page.title().catch(() => '')).slice(0, 60)}": it is blocking or challenging automation. ${STOP}`,
        );
      await checkpoint('on load');
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      if (options.wait) await page.waitForTimeout(options.wait);
      await checkpoint('after loading');
      // First view exactly as a visitor gets it, before any scrolling wakes up sign-up walls or lazy content.
      await page.screenshot({ path: join(outDir, `${name}-viewport.png`), scale: 'css' });
      files.push({ path: `${name}-viewport.png`, what: `first view before scrolling, ${name}` });

      let pageHeight = options.scroll
        ? await page.evaluate(autoScroll, {})
        : await page.evaluate(() => document.documentElement.scrollHeight);
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
      await checkpoint('while scrolling');
      finalUrl = page.url();

      // Modal walls are reference material too: keep a picture, then get out of the way like a person would.
      const dialog = page
        .locator('[role="dialog"]:visible, [aria-modal="true"]:visible, dialog[open]')
        .first();
      if (await dialog.isVisible().catch(() => false)) {
        await page.screenshot({ path: join(outDir, `${name}-dialog.png`), scale: 'css' });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        if (await dialog.isVisible().catch(() => false))
          await page
            .locator('[role="dialog"] [aria-label*="close" i], [aria-modal="true"] [aria-label*="close" i]')
            .first()
            .click({ timeout: 2_000 })
            .catch(() => {});
        await page.waitForTimeout(300);
        const dismissed = !(await dialog.isVisible().catch(() => false));
        files.push({
          path: `${name}-dialog.png`,
          what: `modal dialog that appeared after scrolling (${name}); ${dismissed ? 'dismissed before the full-page shots' : 'could not be dismissed, it overlays the shots below'}`,
        });
        pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      }

      if (options.flow) {
        const flow = (await import(pathToFileURL(resolve(options.flow)).href)).default;
        siteOrigin = new URL(page.url()).origin;
        const siteRobots = await robotsOf(siteOrigin);
        // A flow clicks and types like a person, but never opens a page robots.txt disallows, nor another site.
        // Such a navigation gets an empty 204, so the tab stays where it was (aborting it would strand the tab on
        // an error page), and the summary reports it. Pop-ups are fenced too, except with --cdp, where routing the
        // whole context would reach into the human's other tabs. What the fence cannot see coming, a redirect or
        // an in-page navigation, the checkpoint at the next step catches.
        const fenced = (request) => {
          if (!request.isNavigationRequest()) return undefined;
          let topLevel = true;
          try {
            topLevel = !request.frame().parentFrame();
          } catch {
            // A pop-up's first navigation starts before its frame exists: it is a top-level page.
          }
          if (!topLevel) return undefined;
          const target = new URL(request.url());
          if (target.origin !== siteOrigin) return 'another site';
          return options.allowDisallowed ? undefined : robotsRefusal(siteRobots, target.href);
        };
        const guard = (route) => {
          const request = route.request();
          let why;
          try {
            why = fenced(request);
          } catch (error) {
            why = `the fence could not judge it: ${error.message.split('\n')[0]}`; // fail closed
          }
          if (!why) return route.fallback();
          flowBlocked.push(`${name}: ${placeOf(request.url())} (${why})`);
          return route.fulfill({ status: 204 });
        };
        const routed = options.cdp ? page : context;
        await routed.route('**/*', guard);
        let n = 0;
        try {
          await flow({
            page,
            viewport: name,
            step: async (label) => {
              await checkpoint('during the flow');
              const file = `flow-${name}-${String(++n).padStart(2, '0')}-${slug(label)}.png`;
              await page.screenshot({ path: join(outDir, file), scale: 'css' });
              files.push({ path: file, what: `flow step "${label}" (${name})` });
            },
          });
        } catch (error) {
          // A flow that waited for a page the fence held back fails on its next action. The flow ends there, the
          // summary says so and the capture goes on; any other error, and every Stop, ends the capture.
          if (error instanceof Stop || !flowBlocked.some((line) => line.startsWith(`${name}: `))) throw error;
          flowStopped.push(`${name}: ${error.message.split('\n')[0].slice(0, 200)}`);
        }
        await routed.unroute('**/*', guard);
        await checkpoint('after the flow');
        pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      }

      const { width, height } = page.viewportSize();
      await page.screenshot({
        path: join(outDir, `${name}-full.png`),
        fullPage: true,
        scale: 'css',
        clip: { x: 0, y: 0, width, height: Math.min(pageHeight, 16_000) },
      });
      files.push({
        path: `${name}-full.png`,
        what: `full page, ${name} (overview only; read the tiles for detail)`,
      });
      const tiles = Math.min(options.tiles, Math.ceil(pageHeight / height));
      for (let i = 0; i < tiles; i++) {
        const file = `${name}-tile-${String(i + 1).padStart(2, '0')}.png`;
        await page.screenshot({
          path: join(outDir, file),
          fullPage: true,
          scale: 'css',
          clip: { x: 0, y: i * height, width, height: Math.min(height, pageHeight - i * height) },
        });
        files.push({
          path: file,
          what: `${name} rows ${i * height}–${Math.min((i + 1) * height, pageHeight)}px at readable size`,
        });
      }
      if (tiles && tiles * height < pageHeight)
        files.at(-1).what +=
          `; the tiles stop here, --tiles ${Math.ceil(pageHeight / height)} reaches the end of the page`;

      await writeFile(join(outDir, `${name}-page.html`), await page.content());
      const aria = await page
        .locator('body')
        .ariaSnapshot({ timeout: 15_000 })
        .catch((error) => `# aria snapshot failed: ${error.message}`);
      await writeFile(join(outDir, `${name}-aria.yml`), aria);
      files.push(
        { path: `${name}-page.html`, what: 'rendered DOM (raw: may contain session data, never commit)' },
        { path: `${name}-aria.yml`, what: 'accessibility tree: the page structure in roles and names' },
      );

      const tokens = await page.evaluate(extractTokens, {});
      const components = await page.evaluate(tagComponents, { limit: 5 });
      for (const component of components) {
        const file = `components/${name}-${component.id}.png`;
        const ok = await page
          .locator(`[data-site-capture="${component.id}"]`)
          .first()
          .screenshot({ path: join(outDir, file), scale: 'css', timeout: 4_000 })
          .then(
            () => true,
            () => false,
          );
        if (ok) component.screenshot = file;
      }
      const inlineCss = await page.evaluate(() =>
        [...document.styleSheets]
          .filter((sheet) => !sheet.href)
          .map((sheet) => {
            try {
              return [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
            } catch {
              return '';
            }
          })
          .join('\n')
          .slice(0, 3_000_000),
      );

      await net.settle();
      perViewport[name] = { viewport: { width, height }, pageHeight, tokens, components };
      allEntries.push(...net.entries);
      failures.push(...net.failures);
      if (!main) {
        main = {
          status: response?.status() ?? 0,
          mime: (response?.headers()['content-type'] ?? '').split(';')[0],
          headers: response?.headers() ?? {},
        };
        pageProbe = await page.evaluate(probeTechnology, baseline);
        pageProbe.globals = pageProbe.globals.filter((key) => key !== '__REACT_DEVTOOLS_GLOBAL_HOOK__');
        stylesheets = [...net.stylesheets, { url: 'inline', text: inlineCss }];
        scripts = net.scripts;
        cookies = await context.cookies();
        if (options.sourcemaps)
          sourceMaps = await analyzeSourceMaps(
            scripts.filter(
              (s) =>
                describeUrl(s.url).host.split('.').slice(-2).join('.') ===
                new URL(url).host.split('.').slice(-2).join('.'),
            ),
            context.request,
          );
        routes = await nextRoutes(new URL(finalUrl).origin, pageProbe.nextData?.buildId, context.request);
      }
      for (const cookie of await context.cookies())
        if (looksLikeCredential(cookie.value, pageHost)) secrets.add(cookie.value);
      if (options.raw) await writeFile(join(rawDir, `${name}-bodies.json`), JSON.stringify(net.raw, null, 2));

      await page.close();
      openPage = undefined;
      if (!options.cdp) await context.close();
      if (name !== options.viewports.at(-1)) await new Promise((r) => setTimeout(r, options.delay));
    }
  } finally {
    // An attached browser belongs to the human: close only the tab this run opened, even after a stop, then
    // disconnect; never close the browser.
    if (!options.cdp) await browser.close();
    else {
      await openPage?.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }

  const css = analyzeCss(stylesheets);
  const api = summarizeApi(allEntries, finalUrl);
  const headers = analyzeHeaders(main.headers);
  const tech = {
    main: { status: main.status, mime: main.mime },
    headers,
    page: pageProbe,
    robots: refusal
      ? `${refusal}; captured with --allow-disallowed`
      : `${(robotsByOrigin.get(new URL(finalUrl).origin) ?? robots).note}; this path is allowed`,
    routes,
    sourceMaps,
    evidence: mergeEvidence(
      pageProbe.evidence,
      headers.evidence,
      analyzeHosts(api.hosts),
      analyzeCookies(cookies),
      analyzePaths(allEntries),
      analyzeBanners(scripts),
    ),
  };
  const meta = {
    url,
    finalUrl: describeUrl(finalUrl).display,
    capturedAt: new Date().toISOString(),
    tool: 'carshenas site-capture',
    authenticated: Boolean(options.storageState || options.cdp),
    viewports: options.viewports,
    pageLoads: options.viewports.length,
    ...(options.flow ? { flowBlocked, flowStopped } : {}),
  };

  const outputs = {
    'tokens.json': JSON.stringify({ meta, viewports: perViewport, css }, null, 2),
    'tech.json': JSON.stringify({ meta, ...tech }, null, 2),
    'api.json': JSON.stringify({ meta, ...api, failures }, null, 2),
    'tokens.md': tokensReport(meta, perViewport, css),
    'tech.md': techReport(meta, tech),
    'api.md': apiReport(meta, api, failures, consoleLog),
  };
  outputs['summary.md'] = summaryReport(meta, perViewport, tech, api, css, [
    ...DISTILLED.filter((f) => f !== 'summary.md').map((f) => ({
      path: f,
      what: 'distilled and redacted; safe to commit',
    })),
    ...files,
  ]);

  // Belt and braces: nothing that looked like a credential during the capture may appear in a distilled file.
  let scrubbed = 0;
  for (const [file, text] of Object.entries(outputs)) {
    let clean = text;
    for (const secret of secrets)
      if (clean.includes(secret)) {
        clean = clean.split(secret).join('«redacted»');
        scrubbed++;
      }
    clean = clean
      .replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, () => {
        scrubbed++;
        return '«jwt»';
      })
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, () => {
        scrubbed++;
        return '«email»';
      });
    await writeFile(join(outDir, file), clean);
  }

  if (options.distill) {
    const target = resolve(options.distill);
    await mkdir(target, { recursive: true });
    for (const file of DISTILLED) await cp(join(outDir, file), join(target, file));
  }
  return {
    outDir,
    distilled: options.distill ? resolve(options.distill) : undefined,
    scrubbed,
    meta,
    summary: await readFile(join(outDir, 'summary.md'), 'utf8'),
    tech,
    api,
    css,
    perViewport,
  };
}

function cli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      name: { type: 'string' },
      out: { type: 'string' },
      viewports: { type: 'string', default: 'mobile,desktop' },
      locale: { type: 'string', default: 'en-US' },
      timezone: { type: 'string' },
      'storage-state': { type: 'string' },
      cdp: { type: 'string' },
      proxy: { type: 'string' },
      channel: { type: 'string' },
      headed: { type: 'boolean', default: false },
      wait: { type: 'string', default: '1500' },
      delay: { type: 'string', default: '8000' },
      timeout: { type: 'string', default: '60000' },
      tiles: { type: 'string', default: '6' },
      'no-scroll': { type: 'boolean', default: false },
      sourcemaps: { type: 'boolean', default: false },
      har: { type: 'boolean', default: false },
      raw: { type: 'boolean', default: false },
      flow: { type: 'string' },
      distill: { type: 'string' },
      'own-account': { type: 'boolean', default: false },
      'allow-disallowed': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || positionals.length !== 1) {
    console.log(
      'Usage: pnpm capture <url> [--name slug] [--out dir] [--viewports mobile,desktop,tablet] [--locale en-US] [--timezone Area/City]\n  [--storage-state file.json | --cdp http://localhost:9222] --own-account [--proxy http://host:port] [--channel chrome] [--headed]\n  [--no-scroll] [--wait ms] [--timeout ms] [--tiles n] [--sourcemaps] [--raw] [--har] [--flow script.mjs] [--delay ms] [--allow-disallowed]\n  [--distill docs/research/captures/<name>]\nOutput: .captures/<name>/<timestamp>/ (gitignored), or <out>/<name>/<timestamp>/. Run from the repo root. See tools/site-capture/README.md.',
    );
    process.exit(values.help ? 0 : 1);
  }
  return {
    url: positionals[0],
    name: values.name,
    out: values.out,
    viewports: values.viewports
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    locale: values.locale,
    timezone: values.timezone,
    storageState: values['storage-state'],
    cdp: values.cdp,
    proxy: values.proxy,
    channel: values.channel,
    headed: values.headed,
    wait: Number(values.wait),
    delay: Number(values.delay),
    timeout: Number(values.timeout),
    tiles: Number(values.tiles),
    scroll: !values['no-scroll'],
    sourcemaps: values.sourcemaps,
    har: values.har,
    raw: values.raw,
    flow: values.flow,
    distill: values.distill,
    ownAccount: values['own-account'],
    allowDisallowed: values['allow-disallowed'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await capture(cli());
    const rel = relative(process.cwd(), result.outDir) || '.';
    // Deliberately short: the agent reads the files it needs instead of a wall of stdout.
    console.log(result.summary.split('## Files')[0].trim());
    console.log(
      `\nOutput: ${rel}/  (read summary.md first${result.distilled ? `; distilled copy in ${relative(process.cwd(), result.distilled)}/` : ''})`,
    );
    if (result.scrubbed)
      console.log(`Note: ${result.scrubbed} credential-like value(s) were scrubbed from the reports.`);
  } catch (error) {
    console.error(`capture failed: ${error.message}`);
    process.exit(1);
  }
}
