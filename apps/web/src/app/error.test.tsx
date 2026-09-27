import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import RouteError from './error';

test('the error page explains in Farsi, retries on request and offers a way home', async () => {
  const user = userEvent.setup();
  const retry = vi.fn();
  render(<RouteError retry={retry} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('مشکلی پیش آمد');
  expect(screen.getByText('۵۰۰')).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveAttribute('data-error-screen');
  expect(screen.getByRole('link', { name: 'صفحهٔ اصلی' })).toHaveAttribute('href', '/');
  await user.click(screen.getByRole('button', { name: 'دوباره امتحان کنید' }));
  expect(retry).toHaveBeenCalledOnce();
});
