import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import NotFound from './not-found';

test('the not-found page says so in Farsi, with its status in Persian digits and a way home', () => {
  render(<NotFound />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('این صفحه پیدا نشد');
  expect(screen.getByText('۴۰۴')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'بازگشت به صفحه‌ی اصلی' })).toHaveAttribute('href', '/');
});
