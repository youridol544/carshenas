const { chromium } = require(require('./common').PW);
const { FONTS, fontFaceCss, setup } = require('./common');
const FAMILIES = Object.entries(FONTS).filter(([, f]) => f.weight.startsWith('100 ')).map(([fk, f]) => [fk, f.family]);
const { rowProfile } = require('./pixels');
const fa = 'پژو ۲۰۶ تیپ ۲ مدل ۱۳۹۸، بدون رنگ و بدون تصادف. کارکرد ۴۵ هزار کیلومتر، بیمه‌ی شخص ثالث تا اسفند، فنی سالم و لاستیک‌ها نو. قیمت کارشناسی‌شده‌ی بازار حدود ۶۸۰ میلیون تومان است و این آگهی «منصفانه» ارزیابی شده؛ آیا با فروشنده تماس می‌گیرید؟';
const en = 'Peugeot 206 Type 2, model 2019, no paint and no accidents. Mileage 45,000 km, third-party insurance until March, mechanically sound with new tyres. The market value is about 680 million toman and this listing is rated fair; will you call the seller?';
// Latin reference line heights: Material 3 baseline (small language height) where it has the size, Tailwind 4.3 otherwise
const REF = { 12: 16 / 12, 14: 20 / 14, 16: 24 / 16, 20: 28 / 20, 24: 32 / 24, 28: 36 / 28, 32: 40 / 32 };
(async () => {
  const browser = await chromium.launch();
  const LH = []; for (let v = 1.1; v <= 2.21; v += 0.05) LH.push(+v.toFixed(2));
  const cases = [];
  for (const [fk, fam] of FAMILIES) for (const size of Object.keys(REF).map(Number)) {
    cases.push({ fk, fam, size, lh: +REF[size].toFixed(4), text: en, dir: 'ltr', kind: 'latin' });
    for (const lh of LH) cases.push({ fk, fam, size, lh, text: fa, dir: 'rtl', kind: 'persian' });
  }
  const body = cases.map((c, i) => `<div class="w"><p id="p${i}" dir="${c.dir}" style="font:400 ${c.size}px/${c.lh} '${c.fam}';width:${c.size <= 16 ? 380 : Math.round(380 * c.size / 16)}px">${c.text}</p></div>`).join('');
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${fontFaceCss()} body{margin:0;background:#fff;color:#000} .w{padding:10px} p{margin:0}</style></head><body>${body}</body></html>`;
  const { page } = await setup(browser, { html, dsf: 2, width: 900, height: 900 });
  const out = [];
  for (let i = 0; i < cases.length; i++) {
    const el = await page.$('#p' + i);
    const buf = await el.screenshot();
    const { rows } = rowProfile(buf);
    const first = rows.findIndex(c => c > 0), last = rows.length - 1 - [...rows].reverse().findIndex(c => c > 0);
    const bands = []; let run = 0;
    for (let y = first; y <= last; y++) { if (rows[y] === 0) run++; else { if (run > 0) bands.push(run / 2); run = 0; } }
    const c = cases[i];
    const h = await el.evaluate(e => e.getBoundingClientRect().height);
    const lines = Math.round(h / (c.size * c.lh));
    const main = bands.sort((a, b) => b - a).slice(0, lines - 1);
    const mean = main.length ? main.reduce((a, b) => a + b, 0) / main.length : NaN;
    out.push({ ...c, mean, lines });
  }
  console.log('Persian line-height that gives the same mean white band between lines as Latin text at the reference line-height (same font, same size)');
  console.log('font       size  latin-ref-lh  latin band(px)  persian-equivalent-lh (interpolated)');
  for (const [fk] of FAMILIES) for (const size of Object.keys(REF).map(Number)) {
    const L = out.find(o => o.fk === fk && o.size === size && o.kind === 'latin');
    const P = out.filter(o => o.fk === fk && o.size === size && o.kind === 'persian' && !isNaN(o.mean)).sort((a, b) => a.lh - b.lh);
    let eq = NaN;
    for (let k = 1; k < P.length; k++) if (P[k - 1].mean <= L.mean && P[k].mean >= L.mean) { const t = (L.mean - P[k - 1].mean) / (P[k].mean - P[k - 1].mean || 1); eq = P[k - 1].lh + t * (P[k].lh - P[k - 1].lh); break; }
    console.log(`${fk.padEnd(10)} ${String(size).padEnd(5)} ${L.lh.toFixed(3).padEnd(13)} ${L.mean.toFixed(1).padEnd(15)} ${eq.toFixed(2)}   (lines: latin ${L.lines}, persian ~${P[Math.floor(P.length / 2)].lines})`);
  }
  await browser.close();
})();
