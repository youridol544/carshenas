import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import GlobalError from './global-error';

// next/font/local is a build-time transform; outside Next.js it throws, so the loader is replaced by the shape it
// produces.
vi.mock('@/components/layout/app-font', () => ({
  appFont: { className: 'app-font', variable: 'app-font-variable', style: { fontFamily: 'appFont' } },
}));
vi.mock('./globals.css', () => ({}));

test('the global error page repeats the language, direction and typeface of the root layout, with a way home', () => {
  // It renders its own <html>, which only a document can hold, so it is checked as markup.
  const view = renderToStaticMarkup(<GlobalError retry={() => undefined} />);
  expect(view).toContain('<html lang="fa" dir="rtl" class="app-font-variable">');
  expect(view).toContain('data-error-screen=""');
  expect(view).toContain('۵۰۰');
  expect(view).toContain('دوباره امتحان کنید');
  expect(view).toMatch(/<a [^>]*href="\/"[^>]*>صفحه‌ی اصلی<\/a>/);
});
