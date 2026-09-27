const { chromium } = require(require('./common').PW);
const { FONTS, fontFaceCss, setup } = require('./common');
const { inkBounds } = require('./pixels');
const DSF = 2;
(async () => {
  const browser = await chromium.launch();
  const overrides = `@font-face{font-family:'LabVazirOv';src:url('/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2') format('woff2');font-weight:100 900;ascent-override:92%;descent-override:47%;line-gap-override:0%}
  @font-face{font-family:'LabEstedadOv';src:url('/estedad/Estedad-v8.5/Estedad[wght].woff2') format('woff2');font-weight:100 900;ascent-override:92%;descent-override:47%;line-gap-override:0%}`;
  const fams = Object.fromEntries(Object.entries(FONTS).filter(([, f]) => f.weight.startsWith('100 ')).map(([fk, f]) => [fk, f.family]));
  // The metric-override faces exist only for the fonts they override (the ascent-override experiment, T-7).
  const overrideFamilies = [];
  if (fams.vazirmatn) { fams.vazirOv = 'LabVazirOv'; overrideFamilies.push('LabVazirOv'); }
  if (fams.estedad) { fams.estedadOv = 'LabEstedadOv'; overrideFamilies.push('LabEstedadOv'); }
  const texts = { title: 'پژو ۲۰۶ تیپ ۲ مدل ۱۳۹۸', tall: 'آگهی‌های تأیید شده' };
  const trims = { none: 'none', 'trim-both cap alphabetic': 'trim-both cap alphabetic', 'trim-both text': 'trim-both text', 'trim-both ex alphabetic': 'trim-both ex alphabetic' };
  let body = '';
  const cases = [];
  for (const [fk, fam] of Object.entries(fams)) for (const [tk, t] of Object.entries(texts)) for (const [trk, tr] of Object.entries(trims)) {
    const i = cases.length; cases.push({ kind: 'heading', fk, fam, tk, trk });
    body += `<div class="wrap"><h2 id="x${i}" style="font:700 28px/1.4 '${fam}';text-box:${tr}">${t}</h2></div>`;
  }
  for (const [fk, fam] of Object.entries(fams)) for (const label of ['جستجو', 'مشاهده آگهی', 'تأیید']) for (const trk of ['none', 'trim-both cap alphabetic', 'trim-both text']) {
    const i = cases.length; cases.push({ kind: 'button', fk, fam, label, trk });
    body += `<div class="wrap"><button id="x${i}" style="font:500 16px/1.5 '${fam}';text-box:${trk}">${label}</button></div>`;
  }
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${fontFaceCss()}${overrides}
  body{margin:0;background:#fff;color:#000} .wrap{padding:40px 12px;height:140px;box-sizing:border-box} h2{margin:0;width:max-content;white-space:nowrap}
  button{all:unset;display:inline-block;padding:12px 16px;white-space:nowrap;background:#fff}
  </style></head><body>${body}${overrideFamilies.map((f) => `<span style="font-family:${f}">پ</span>`).join('')}</body></html>`;
  const { page } = await setup(browser, { html, dsf: DSF, width: 700, height: 900 });
  await page.evaluate(async (families) => { for (const f of families) await document.fonts.load(`400 16px ${f}`, 'پ'); await document.fonts.ready; }, overrideFamilies);
  const sup = await page.evaluate(() => ({ 'text-box trim-both cap alphabetic': CSS.supports('text-box', 'trim-both cap alphabetic'), 'text-box-edge text': CSS.supports('text-box-edge', 'text'), 'text-box-edge ex alphabetic': CSS.supports('text-box-edge', 'ex alphabetic'), 'ascent-override (FontFace)': 'ascentOverride' in FontFace.prototype }));
  console.log('supports', JSON.stringify(sup));
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const r = await page.evaluate((i) => { const el = document.getElementById('x' + i); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, i);
    const pad = 30;
    const buf = await page.screenshot({ clip: { x: Math.max(0, r.x - 4), y: r.y - pad, width: r.w + 8, height: r.h + 2 * pad } });
    const ink = inkBounds(buf);
    const inkTop = ink.top / DSF - pad, inkBottom = (ink.bottom + 1) / DSF - pad; // relative to element top
    if (c.kind === 'heading') console.log(`heading ${c.fk.padEnd(10)} ${c.tk.padEnd(6)} ${c.trk.padEnd(26)} boxH=${r.h.toFixed(2).padStart(6)}  ink above box=${(-inkTop).toFixed(1).padStart(5)}  ink below box=${(inkBottom - r.h).toFixed(1).padStart(5)}`);
    else console.log(`button  ${c.fk.padEnd(10)} ${c.label.padEnd(12)} ${c.trk.padEnd(26)} boxH=${r.h.toFixed(2).padStart(6)}  top gap=${inkTop.toFixed(1).padStart(5)}  bottom gap=${(r.h - inkBottom).toFixed(1).padStart(5)}`);
  }
  await browser.close();
})();
