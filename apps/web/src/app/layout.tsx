import { DirectionProvider } from '@base-ui/react/direction-provider';
import type { Metadata, Viewport } from 'next';
import { appFont } from '@/components/layout/app-font';
import { DIRECTION, LANGUAGE } from '@/lib/locale';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'کارشناس', template: '%s | کارشناس' },
  description: 'آگهی‌های خودروی کارکرده از سایت‌های مختلف، با ارزش بازار و ارزیابی قیمت هر آگهی.',
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
        <DirectionProvider direction={DIRECTION}>{children}</DirectionProvider>
      </body>
    </html>
  );
}
