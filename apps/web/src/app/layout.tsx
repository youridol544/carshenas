import type { Metadata, Viewport } from 'next';
import { appFont } from '@/components/layout/app-font';
import { DIRECTION, LANGUAGE } from '@carshenas/locale/locale';
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
      <body>{children}</body>
    </html>
  );
}
