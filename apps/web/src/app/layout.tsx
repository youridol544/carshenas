import { DirectionProvider } from '@base-ui/react/direction-provider';
import type { Metadata, Viewport } from 'next';
import { appFont } from '@/components/layout/app-font';
import { NavigationFocus } from '@/components/layout/navigation-focus';
import { DIRECTION, LANGUAGE } from '@carshenas/locale/locale';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'کارشناس', template: '%s | کارشناس' },
  description: 'آگهی‌های خودروی کارکرده، با ارزش بازار و ارزیابی قیمت هر آگهی.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang={LANGUAGE} dir={DIRECTION} className={appFont.variable}>
      <body>
        {/* Base UI reads direction from its own provider, not from <html dir> (design-language.md, section 6). */}
        <DirectionProvider direction={DIRECTION}>
          {children}
          <NavigationFocus />
        </DirectionProvider>
      </body>
    </html>
  );
}
