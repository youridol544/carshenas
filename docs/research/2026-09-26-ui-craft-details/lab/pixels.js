const path = require('path');
const { PW } = require('./common');
// The PNG decoder bundled with playwright-core, so nothing is installed.
const corePackage = require.resolve('playwright-core/package.json', { paths: [path.dirname(PW)] });
const { PNG } = require(path.join(path.dirname(corePackage), 'lib', 'utilsBundle.js'));
// Returns first/last rows (and cols) containing ink (pixel darker than threshold) in a PNG buffer.
function inkBounds(buf, threshold = 160) {
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  let top = -1, bottom = -1, left = width, right = -1, count = 0;
  for (let y = 0; y < height; y++) {
    let rowHas = false;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < threshold) { rowHas = true; count++; if (x < left) left = x; if (x > right) right = x; }
    }
    if (rowHas) { if (top < 0) top = y; bottom = y; }
  }
  return { top, bottom, left, right, count, width, height };
}
function rowProfile(buf, threshold = 160) {
  const png = PNG.sync.read(buf);
  const { width, height, data } = png; const rows = [];
  for (let y = 0; y < height; y++) { let c = 0; for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; if (lum < threshold) c++; } rows.push(c); }
  return { rows, width, height };
}
function diffRows(bufA, bufB, threshold = 60) {
  const a = PNG.sync.read(bufA), b = PNG.sync.read(bufB);
  const { width, height } = a; const rows = [];
  for (let y = 0; y < height; y++) { let c = 0; for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i+1] - b.data[i+1]) + Math.abs(a.data[i+2] - b.data[i+2]); if (d > threshold) c++; } rows.push(c); }
  return { rows, width, height };
}
module.exports = { inkBounds, rowProfile, diffRows, PNG };
