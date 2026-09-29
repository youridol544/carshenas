import { SiteHeader } from '@/components/layout/site-header';

// The sign-in and sign-up pages: the header with the name only, no account slot, since these pages are that slot.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      {children}
    </div>
  );
}
