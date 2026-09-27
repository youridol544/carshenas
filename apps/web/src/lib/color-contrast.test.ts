// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { contrastRatio, isInSrgb, parseOklch, relativeLuminance, type Oklch } from '@/lib/color-contrast';

test('contrast runs from 1 to 21 and matches sRGB for a known colour', () => {
  const white = parseOklch('oklch(1 0 0)');
  const black = parseOklch('oklch(0 0 0)');
  expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
  expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  // oklch(0.53 0.2 262) is #2261dd, 5.49:1 against white.
  expect(contrastRatio(parseOklch('oklch(0.53 0.2 262)'), white)).toBeCloseTo(5.49, 1);
});

test('a colour outside sRGB is refused, because browsers clip it per channel and would paint another colour', () => {
  expect(() => relativeLuminance(parseOklch('oklch(0.9 0.065 25)'))).toThrow(RangeError);
  expect(() => parseOklch('oklch(0.5 0.1 20 / 0.5)')).toThrow(SyntaxError);
});

// The design tokens as the browser reads them: every custom property in globals.css, roles resolved through the
// var() they point at.
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const declared = new Map(
  [...css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]),
);

function token(name: string): Oklch {
  const value = declared.get(name);
  if (value === undefined) throw new Error(`${name} is not declared in globals.css`);
  const reference = /^var\((--[a-z0-9-]+)\)$/.exec(value.trim());
  return reference?.[1] ? token(reference[1]) : parseOklch(value);
}

test('every colour token is inside sRGB, so every browser paints the colour these tests compute', () => {
  const outside = [...declared]
    .filter(
      ([, value]) => value !== undefined && value.trim().startsWith('oklch(') && !isInSrgb(parseOklch(value)),
    )
    .map(([name]) => name);
  expect(outside).toEqual([]);
});

// The pairs docs/design/design-language.md records: Persian text needs 4.5:1 wherever it can sit (there is no
// large-text exemption for Persian); control borders and the focus ring need 3:1 (WCAG 1.4.11).
const TEXT_PAIRS = [
  ['--text-color-default', '--background-color-canvas'],
  ['--text-color-default', '--background-color-surface-muted'],
  ['--text-color-muted', '--background-color-canvas'],
  ['--text-color-muted', '--background-color-surface-muted'],
  ['--text-color-muted', '--background-color-surface-hover'],
  ['--text-color-subtle', '--background-color-canvas'],
  ['--text-color-subtle', '--background-color-surface-muted'],
  ['--text-color-link', '--background-color-canvas'],
  ['--text-color-link', '--background-color-surface-muted'],
  ['--text-color-on-action', '--background-color-action'],
  ['--text-color-on-action', '--background-color-action-hover'],
  ['--text-color-on-action-subtle', '--background-color-action-subtle'],
  ['--text-color-danger', '--background-color-canvas'],
  ['--text-color-danger', '--background-color-danger-subtle'],
  ['--text-color-on-danger', '--background-color-danger'],
  ['--text-color-success', '--background-color-canvas'],
  ['--text-color-success', '--background-color-success-subtle'],
  ['--text-color-warning', '--background-color-canvas'],
  ['--text-color-warning', '--background-color-warning-subtle'],
  ['--color-on-deal-great', '--color-deal-great'],
  ['--color-on-deal-good', '--color-deal-good'],
  ['--color-on-deal-fair', '--color-deal-fair'],
  ['--color-on-deal-high', '--color-deal-high'],
  ['--color-on-deal-overpriced', '--color-deal-overpriced'],
  ['--color-on-deal-none', '--color-deal-none'],
] as const;

const NON_TEXT_PAIRS = [
  ['--border-color-control', '--background-color-canvas'],
  ['--border-color-control', '--background-color-surface-muted'],
  ['--outline-color-focus', '--background-color-canvas'],
  ['--outline-color-focus', '--background-color-surface-muted'],
] as const;

test.each(TEXT_PAIRS)('%s on %s meets 4.5:1', (foreground, background) => {
  expect(contrastRatio(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
});

test.each(NON_TEXT_PAIRS)('%s against %s meets 3:1', (foreground, background) => {
  expect(contrastRatio(token(foreground), token(background))).toBeGreaterThanOrEqual(3);
});

test('the five deal ratings are one ramp whose lightness only rises from great to overpriced', () => {
  const ramp = ['great', 'good', 'fair', 'high', 'overpriced'].map((rating) =>
    relativeLuminance(token(`--color-deal-${rating}`)),
  );
  expect(ramp).toEqual([...ramp].sort((a, b) => a - b));
  expect(new Set(ramp).size).toBe(ramp.length);
});
