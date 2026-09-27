// Isolation for text that cannot carry markup. In JSX, isolate with markup instead: <bdi> for text from data (a
// listing title, a seller's name) and dir="ltr" lang="en" for text that is always left to right (a VIN, a URL).
// W3C allows these control characters "only where markup is not available": the document title and attribute
// values such as `title`, `alt` and `placeholder`, a native <option>, an SVG <title>. Keep them out of
// `aria-label`, where screen readers' handling is unverified. The characters are written as escapes, because
// literal bidi controls in source code are hidden and GitHub flags them (CVE-2021-42574).

const LEFT_TO_RIGHT_ISOLATE = '⁦';
const FIRST_STRONG_ISOLATE = '⁨';
const POP_DIRECTIONAL_ISOLATE = '⁩';

/** Text whose direction comes from its own first letter: «هیوندای Sonata» or «BMW X3». */
export function isolate(text: string): string {
  return FIRST_STRONG_ISOLATE + text + POP_DIRECTIONAL_ISOLATE;
}

/** Text that is always left to right, even when it starts with a digit or a symbol: a VIN, a URL, `+98 912 …`. */
export function isolateLtr(text: string): string {
  return LEFT_TO_RIGHT_ISOLATE + text + POP_DIRECTIONAL_ISOLATE;
}
