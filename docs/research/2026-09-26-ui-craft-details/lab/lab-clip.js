const fs = require('fs');
const { chromium } = require(require('./common').PW);
const { FONTS, fontFaceCss, setup } = require('./common');
const { inkBounds } = require('./pixels');
const DSF = 2;
const SAMPLES = {
  S1: 'پژو ۲۰۶ تیپ ۲ بدون رنگ، کارکرد ۴۵ هزار کیلومتر',
  S2: 'گ ژ ی ؛ ؟',
  S3: 'تأیید آگهی؛ پراید غ',
};
const SIZES = [12, 14, 16, 20, 28];
const LHS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9];
(async () => {
  const browser = await chromium.launch();
  const cases = [];
  for (const [fk, f] of Object.entries(FONTS)) for (const w of (fk === 'vazirmatnUI' ? [400] : [400, 700])) for (const size of SIZES) for (const lh of LHS) for (const [sk, text] of Object.entries(SAMPLES)) cases.push({ fk, w, fam: f.family, size, lh, sk, text });
  const body = cases.map((c, i) => `<div class="wrap" style="height:${Math.ceil(c.size * 4)}px;padding-top:${Math.ceil(c.size * 1.2)}px"><div id="c${i}" class="case" style="font:${c.w} ${c.size}px/${c.lh} '${c.fam}'">${c.text}<span class="bl"></span></div></div>`).join('\n');
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${fontFaceCss()}
  body{margin:0;background:#fff;color:#000}
  .wrap{box-sizing:border-box;padding-inline:12px}
  .case{white-space:nowrap;width:max-content}
  .bl{display:inline-block;width:0;height:0;vertical-align:baseline}
  </style></head><body>${body}</body></html>`;
  const { page, status } = await setup(browser, { html, dsf: DSF, width: 900, height: 900 });
  console.log('fonts', JSON.stringify(status), 'chromium', browser.version());
  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const geo = await page.evaluate((i) => {
      const el = document.getElementById('c' + i);
      el.parentElement.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const bl = el.querySelector('.bl').getBoundingClientRect().top;
      return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height, baseline: bl };
    }, i);
    const pad = Math.ceil(c.size * 1.2);
    const clip = { x: Math.max(0, Math.floor(geo.left) - 6), y: geo.top - pad, width: Math.ceil(geo.width) + 12, height: Math.ceil(geo.height) + 2 * pad };
    const buf = await page.screenshot({ clip });
    const ink = inkBounds(buf);
    const inkTopCss = clip.y + ink.top / DSF, inkBottomCss = clip.y + (ink.bottom + 1) / DSF;
    results.push({ fk: c.fk, w: c.w, size: c.size, lh: c.lh, sk: c.sk, boxTop: geo.top, boxH: +geo.height.toFixed(3), baselineFromTop: +(geo.baseline - geo.top).toFixed(3),
      inkTopFromBoxTop: +(inkTopCss - geo.top).toFixed(2), inkBottomFromBoxTop: +(inkBottomCss - geo.top).toFixed(2),
      overTop: +(geo.top - inkTopCss).toFixed(2), overBottom: +(inkBottomCss - geo.bottom).toFixed(2) });
  }
  fs.writeFileSync('results-clip.json', JSON.stringify(results, null, 1));
  const fmt = v => v >= 0.5 ? v.toFixed(1) : '·';
  for (const fk of Object.keys(FONTS)) for (const w of (fk === 'vazirmatnUI' ? [400] : [400, 700])) for (const group of [['S1', 'S2'], ['S3']]) {
    console.log(`\n=== ${fk} ${w} samples ${group.join('+')}: ink outside line box, px top/bottom ('·' = < 0.5 px)`);
    console.log('size\\lh  ' + LHS.map(l => String(l).padEnd(10)).join(''));
    for (const size of SIZES) {
      console.log(String(size).padEnd(9) + LHS.map(lh => {
        const rs = results.filter(r => r.fk === fk && r.w === w && r.size === size && r.lh === lh && group.includes(r.sk));
        return `${fmt(Math.max(...rs.map(r => r.overTop)))}/${fmt(Math.max(...rs.map(r => r.overBottom)))}`.padEnd(10);
      }).join(''));
    }
  }
  await browser.close();
})();
