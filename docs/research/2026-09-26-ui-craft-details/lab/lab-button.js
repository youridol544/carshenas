const fs = require('fs');
const { chromium } = require(require('./common').PW);
const { FONTS, fontFaceCss, setup } = require('./common');
const { inkBounds } = require('./pixels');
const DSF = 2;
const LABELS = { search: 'جستجو', view: 'مشاهده آگهی', call: 'تماس با فروشنده', save: 'ذخیره جستجو', great: 'معامله‌ی عالی', over: 'خیلی گران', count: '۱۲ آگهی', confirm: 'تأیید' };
const BTNS = [ { size: 16, h: 48, w: 500 }, { size: 14, h: 44, w: 500 }, { size: 12, h: 28, w: 500 } ];
const LHS = [1, 1.2, 1.4, 1.5, 1.6, 1.8];
(async () => {
  const browser = await chromium.launch();
  const cases = [];
  for (const [fk, f] of Object.entries(FONTS)) for (const b of BTNS) for (const lh of LHS) for (const [lk, label] of Object.entries(LABELS)) cases.push({ fk, fam: f.family, ...b, w: fk === 'vazirmatnUI' ? 400 : b.w, lh, lk, label });
  const body = cases.map((c, i) => `<div class="row"><button id="b${i}" style="height:${c.h}px;font:${c.w} ${c.size}px/${c.lh} '${c.fam}'">${c.label}</button></div>`).join('\n');
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${fontFaceCss()}
  body{margin:0;background:#fff;color:#000}
  .row{height:64px;padding:8px 12px;box-sizing:border-box}
  button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;padding-inline:16px;color:#000;background:#fff;white-space:nowrap}
  </style></head><body>${body}</body></html>`;
  const { page, status } = await setup(browser, { html, dsf: DSF, width: 700, height: 900 });
  console.log('fonts', JSON.stringify(status));
  const res = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const r = await page.evaluate((i) => { const el = document.getElementById('b' + i); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, i);
    const buf = await page.screenshot({ clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
    const ink = inkBounds(buf);
    const inkTop = ink.top / DSF, inkBottom = (ink.bottom + 1) / DSF;
    const inkCenter = (inkTop + inkBottom) / 2;
    res.push({ fk: c.fk, size: c.size, h: c.h, lh: c.lh, lk: c.lk, inkTop: +inkTop.toFixed(1), inkBottom: +inkBottom.toFixed(1), gapTop: +inkTop.toFixed(1), gapBottom: +(c.h - inkBottom).toFixed(1), offset: +(inkCenter - c.h / 2).toFixed(2) });
  }
  fs.writeFileSync('results-button.json', JSON.stringify(res, null, 1));
  for (const fk of Object.keys(FONTS)) for (const b of BTNS) {
    console.log(`\n=== ${fk} ${b.size}px label in ${b.h}px flex-centred box: ink centre minus box centre, px (+ = ink sits low). Columns: line-height`);
    console.log('label'.padEnd(16) + LHS.map(l => String(l).padEnd(7)).join('') + ' | ink top gap / bottom gap at lh 1.5');
    for (const lk of Object.keys(LABELS)) {
      const rs = LHS.map(lh => res.find(r => r.fk === fk && r.size === b.size && r.lh === lh && r.lk === lk));
      const r15 = res.find(r => r.fk === fk && r.size === b.size && r.lh === 1.5 && r.lk === lk);
      console.log(`${lk}`.padEnd(16) + rs.map(r => String(r.offset).padEnd(7)).join('') + ` | ${r15.gapTop} / ${r15.gapBottom}`);
    }
  }
  await browser.close();
})();
