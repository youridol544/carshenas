// Alef stem width per weight, as a share of the font size: the reference for icon strokes (ui-design craft.md,
// icons). An icon beside a label should draw a stroke within about 0.25 px of this at the label's size and weight.
const { chromium } = require(require('./common').PW);
const { FONTS, fontFaceCss, setup } = require('./common');

(async () => {
  const browser = await chromium.launch();
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${fontFaceCss()}</style></head><body>ا</body></html>`;
  const { page } = await setup(browser, { html });
  const variableFonts = Object.values(FONTS).filter((font) => font.weight.startsWith('100 '));
  const rows = await page.evaluate(async (fonts) => {
    const out = [];
    const SIZE = 400;
    for (const { family, label } of fonts) {
      for (const weight of [300, 400, 500, 600, 700]) {
        await document.fonts.load(`${weight} ${SIZE}px '${family}'`, 'ا');
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 600, 600);
        context.fillStyle = '#000';
        context.font = `${weight} ${SIZE}px '${family}'`;
        context.fillText('ا', 200, 450);
        // the median ink width of rows through the middle of the stem, with antialiasing counted fractionally
        const widths = [];
        for (let y = 250; y <= 400; y += 10) {
          const row = context.getImageData(0, y, 600, 1).data;
          let ink = 0;
          for (let x = 0; x < 600; x++) ink += (255 - row[x * 4]) / 255;
          widths.push(ink);
        }
        widths.sort((a, b) => a - b);
        const share = widths[Math.floor(widths.length / 2)] / SIZE;
        out.push(`${label}, weight ${weight}: stem ${(share * 100).toFixed(2)} % of the font size, ${(share * 16).toFixed(2)} px at 16 px`);
      }
    }
    return out;
  }, variableFonts.map(({ family, label }) => ({ family, label })));
  console.log(rows.join('\n'));
  await browser.close();
})();
