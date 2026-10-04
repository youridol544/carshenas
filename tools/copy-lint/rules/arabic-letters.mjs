// Arabic letters where Persian ones belong. Many phones type the Arabic yeh and kaf, and a search for «کارشناس» does
// not find «كارشناس». Everything here is built from code points, so the file itself holds no look-alike letter.
import { matchesOf } from './util.mjs';

const ARABIC_YEH = String.fromCodePoint(0x064a); // Persian: U+06CC
const ARABIC_KAF = String.fromCodePoint(0x0643); // Persian: U+06A9
const ALEF_MAKSURA = String.fromCodePoint(0x0649); // Persian: U+06CC
const HEH_WITH_YEH_ABOVE = String.fromCodePoint(0x06c0); // Persian: «ه‌ی» (heh, ZWNJ, yeh)
const TEH_MARBUTA = String.fromCodePoint(0x0629); // Persian: «ه» or «ت»

const ARABIC_ONLY = new RegExp(
  `[${ARABIC_YEH}${ARABIC_KAF}${ALEF_MAKSURA}${HEH_WITH_YEH_ABOVE}${TEH_MARBUTA}]`,
  'g',
);

export default {
  id: 'arabic-letters',
  level: 'refuse',
  summary: 'Arabic letters (yeh, kaf, alef maksura, heh with yeh above, teh marbuta)',
  message:
    'An Arabic letter: yeh U+064A, kaf U+0643, alef maksura U+0649, heh with yeh above U+06C0 or teh marbuta U+0629.',
  fix: 'Use the Persian letters: yeh U+06CC, kaf U+06A9, and heh, ZWNJ, yeh («ه‌ی») for the heh with yeh above.',
  check: (unit) => matchesOf(ARABIC_ONLY, unit.text),
  samples: {
    pass: ['کارشناس خودرو', 'آگهی‌های تازه', 'تأیید شد'],
    fail: [
      `${ARABIC_KAF}ارشناس خودرو`,
      `آگه${ARABIC_YEH} تازه`,
      `صفح${HEH_WITH_YEH_ABOVE} اصلی`,
      `رحم${TEH_MARBUTA}`,
    ],
  },
};
