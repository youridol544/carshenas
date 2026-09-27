import localFont from 'next/font/local';

// The one typeface: Yekan Bakh 4 (Reza Bakhtiarifard and Mahan Jafarzadeh, sold by Fontiran), variable weight
// 100 to 950 (docs/design/design-language.md). The file is licensed per site and prepared for its buyer, so it is
// never committed: docs/runbooks/licensed-font.md says how a machine gets its copy. It is served exactly as
// delivered, because the licence does not allow changing the file (no subsetting, no patched metrics).
export const appFont = localFont({
  src: './fonts/YekanBakh-VF.woff2',
  weight: '100 950',
  display: 'swap',
  // Next.js measures its automatic fallback on Latin letters against Arial, which Android does not have; the
  // Persian-capable system fonts follow instead.
  adjustFontFallback: false,
  fallback: ['system-ui', 'Segoe UI', 'Tahoma', 'Geeza Pro', 'Noto Naskh Arabic', 'sans-serif'],
  variable: '--font-yekan-bakh',
});
