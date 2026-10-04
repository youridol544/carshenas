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
  const error = Object.assign(new Error('the root layout threw'), { digest: '1234567890' });
  const view = renderToStaticMarkup(<GlobalError error={error} retry={() => undefined} />);
  expect(view).toContain('<html lang="fa" dir="rtl" class="app-font-variable">');
  expect(view).toContain('data-error-screen=""');
  expect(view).toContain('۵۰۰');
  expect(view).toContain('تلاش دوباره');
  expect(view).toContain('کارشناس باز نشد');
  expect(view).toMatch(/<a [^>]*href="\/"[^>]*>صفحه‌ی اصلی<\/a>/);
});

test('the global error page shows the reference code and never the message', () => {
  const error = Object.assign(new Error('the root layout threw'), { digest: '1234567890' });
  const view = renderToStaticMarkup(<GlobalError error={error} retry={() => undefined} />);
  expect(view).toMatch(/کد پیگیری: <span dir="ltr" class="select-all">۱۲۳۴۵۶۷۸۹۰<\/span>/);
  expect(view).not.toContain('the root layout threw');
});
