'use client';

import { appFont } from '@/components/layout/app-font';
import { StatusScreen } from '@/components/layout/status-screen';
import { DIRECTION, LANGUAGE } from '@/lib/locale';
import './globals.css';

// The root layout itself threw, so this replaces it: it repeats the document's language, direction, typeface and
// styles. Metadata exports are not supported here, so React's <title> names the page.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang={LANGUAGE} dir={DIRECTION} className={appFont.variable}>
      <body>
        <title>مشکلی پیش آمد | کارشناس</title>
        <StatusScreen
          status={500}
          title="مشکلی پیش آمد"
          description="کارشناس باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، چند دقیقه بعد سر بزنید."
          errorScreen
        >
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-12 items-center justify-center rounded-control bg-action px-6 text-control font-semibold text-on-action transition-colors hover:bg-action-hover"
          >
            دوباره امتحان کنید
          </button>
        </StatusScreen>
      </body>
    </html>
  );
}
