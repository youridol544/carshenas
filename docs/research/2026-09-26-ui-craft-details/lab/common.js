const path = require('path');
const fs = require('fs');
// The repository's pinned Playwright, resolved through the e2e package (docs/research/<note>/lab → repo root).
const PW = require.resolve('@playwright/test', { paths: [path.join(__dirname, '..', '..', '..', '..', 'e2e')] });
const LAB = __dirname;
const FONTS = {
  vazirmatn: { family: 'LabVazirmatn', file: 'vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2', weight: '100 900', label: 'Vazirmatn 33.003 (variable)' },
  vazirmatnUI: { family: 'LabVazirmatnUI', file: 'vazirmatn/misc/UI-Non-Latin/fonts/webfonts/Vazirmatn-UI-NL-Regular.woff2', weight: '400', label: 'Vazirmatn UI NL 33.003 Regular' },
  estedad: { family: 'LabEstedad', file: 'estedad/Estedad-v8.5/Estedad[wght].woff2', weight: '100 900', label: 'Estedad 8.5 (variable)' },
};
function fontFaceCss(extra = {}) {
  return Object.entries(FONTS).map(([k, f]) => `@font-face{font-family:'${f.family}';src:url('/${f.file}') format('woff2');font-weight:${f.weight};font-display:block;${extra[k] || ''}}`).join('\n');
}
async function setup(browser, opts = {}) {
  const context = await browser.newContext({ deviceScaleFactor: opts.dsf || 2, viewport: { width: opts.width || 1200, height: opts.height || 900 } });
  const page = await context.newPage();
  await page.route('http://lab.test/**', async (route) => {
    const u = new URL(route.request().url());
    const p = decodeURIComponent(u.pathname);
    if (p === '/' || p === '/index.html') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: opts.html });
    const fp = path.join(LAB, p);
    if (!fs.existsSync(fp)) return route.fulfill({ status: 404, body: 'nf' });
    const ct = fp.endsWith('.woff2') ? 'font/woff2' : fp.endsWith('.ttf') ? 'font/ttf' : 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: ct, body: fs.readFileSync(fp) });
  });
  await page.goto('http://lab.test/');
  await page.evaluate(async (fams) => {
    for (const f of fams) { await document.fonts.load(`400 16px '${f}'`, 'پژو'); }
    await document.fonts.ready;
  }, Object.values(FONTS).map(f => f.family));
  const status = await page.evaluate((fams) => fams.map(f => [f, document.fonts.check(`400 16px '${f}'`, 'پژو')]), Object.values(FONTS).map(f => f.family));
  return { context, page, status };
}
module.exports = { PW, LAB, FONTS, fontFaceCss, setup };
