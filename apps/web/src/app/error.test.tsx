import {
  installBrowserErrorReporting,
  resetBrowserErrorReportingForTests,
  type BrowserErrorReport,
} from '@carshenas/observability/browser';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { ERROR_REFERENCE_LABEL } from '@/components/layout/error-reference';
import { toLatinDigits } from '@carshenas/locale/digits';
import RouteError from './error';

afterEach(() => {
  resetBrowserErrorReportingForTests();
});

// The network is the boundary: reports are captured where the page would send them.
function captureReports() {
  const reports: BrowserErrorReport[] = [];
  installBrowserErrorReporting({
    endpoint: '/api/client-errors',
    target: new EventTarget(),
    send: (_endpoint, body) => reports.push(JSON.parse(body) as BrowserErrorReport),
    currentPath: () => '/listings/42',
  });
  return reports;
}

function shownReference() {
  const line = screen.getByText(new RegExp(ERROR_REFERENCE_LABEL));
  // The label has no digits: what is left after converting and keeping digits is the code.
  return toLatinDigits(line.textContent).replace(/\D/g, '');
}

test('the error page explains in Farsi, retries on request and offers a way home', async () => {
  const user = userEvent.setup();
  const retry = vi.fn();
  render(<RouteError error={Object.assign(new Error('boom'), { digest: '2847193056' })} retry={retry} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('این صفحه باز نشد');
  expect(document.title).toBe('این صفحه باز نشد | کارشناس');
  expect(screen.getByText('۵۰۰')).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveAttribute('data-error-screen');
  expect(screen.getByRole('link', { name: 'صفحه‌ی اصلی' })).toHaveAttribute('href', '/');
  await user.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
  expect(retry).toHaveBeenCalledOnce();
});

test('a server error shows its digest as the reference code in Persian digits, and is not reported again', () => {
  const reports = captureReports();
  render(
    <RouteError
      error={Object.assign(new Error('An error occurred'), { digest: '2847193056' })}
      retry={vi.fn()}
    />,
  );
  expect(screen.getByText(new RegExp(ERROR_REFERENCE_LABEL))).toHaveTextContent('۲۸۴۷۱۹۳۰۵۶');
  expect(shownReference()).toBe('2847193056');
  expect(reports).toEqual([]);
});

test('an error thrown in the browser is reported once, with the reference code the screen shows', () => {
  const reports = captureReports();
  const error = new TypeError("Cannot read properties of undefined (reading 'price')");
  const { rerender } = render(<RouteError error={error} retry={vi.fn()} />);
  rerender(<RouteError error={error} retry={vi.fn()} />);
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ kind: 'boundary', path: '/listings/42', error: { type: 'TypeError' } });
  expect(shownReference()).toBe(reports[0]?.reference);
  expect(shownReference()).toMatch(/^\d{10}$/);
});

test('the page never shows the error message itself', () => {
  captureReports();
  render(<RouteError error={new Error('postgres://web:secret@db failed')} retry={vi.fn()} />);
  expect(screen.queryByText(/postgres|secret|failed/)).not.toBeInTheDocument();
});
