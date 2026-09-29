// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { NumericText } from '@/components/ui/numeric-text';
import { formatCount } from '@carshenas/locale/format-number';
import {
  formatToman,
  formatTomanCompactRange,
  formatTomanEstimateRange,
  toToman,
} from '@carshenas/locale/toman';

const NBSP = '\u00A0';
const unit = (...groups: string[]) =>
  `<span data-slot="numeric-text" class="wrap-anywhere">${groups
    .map((group) => `<span class="whitespace-nowrap">${group}</span>`)
    .join('')}</span>`;

test('a long amount may break only after a thousands mark, and its last group stays with its unit', () => {
  expect(renderToStaticMarkup(<NumericText>{formatToman(toToman(1_250_000_000))}</NumericText>)).toBe(
    unit('۱٬', '۲۵۰٬', '۰۰۰٬', `۰۰۰${NBSP}تومان`),
  );
});

test('each end of a range breaks on its own, and the words between them stay ordinary text', () => {
  const range = formatTomanEstimateRange(toToman(1_196_000_000), toToman(1_352_000_000));
  expect(renderToStaticMarkup(<NumericText>{range}</NumericText>)).toBe(
    `${unit('۱٬', '۲۰۰٬', '۰۰۰٬', '۰۰۰')} تا ${unit('۱٬', '۳۵۰٬', '۰۰۰٬', `۰۰۰${NBSP}تومان`)}`,
  );
});

test('text without a grouped number is left exactly as it is', () => {
  const chip = formatTomanCompactRange(toToman(1_200_000_000), toToman(1_350_000_000));
  expect(renderToStaticMarkup(<NumericText>{chip}</NumericText>)).toBe(chip);
  expect(renderToStaticMarkup(<NumericText>{formatCount(950)}</NumericText>)).toBe('۹۵۰');
});
