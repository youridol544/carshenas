import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { NumericText } from '@/components/ui/numeric-text';
import { formatToman, toToman } from '@/lib/toman';

test('only the digits may break as a last resort; the unit and every Persian word stay whole', () => {
  render(
    <p>
      <NumericText>{formatToman(toToman(1_250_000_000))}</NumericText>
    </p>,
  );
  expect(screen.getByText('۱٬۲۵۰٬۰۰۰٬۰۰۰')).toHaveClass('wrap-anywhere');
  expect(screen.getByText(/تومان/)).toHaveTextContent('۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان');
});

test('every digit run in a sentence is marked, and the text reads exactly as given', () => {
  render(
    <p>
      <NumericText>{'از ۱٫۲ تا ۱٫۳۵ میلیارد'}</NumericText>
    </p>,
  );
  expect(screen.getByText('۱٫۲')).toHaveClass('wrap-anywhere');
  expect(screen.getByText('۱٫۳۵')).toHaveClass('wrap-anywhere');
  expect(screen.getByText(/میلیارد/)).toHaveTextContent('از ۱٫۲ تا ۱٫۳۵ میلیارد');
});
