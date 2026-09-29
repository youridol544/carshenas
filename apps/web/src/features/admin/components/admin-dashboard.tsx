import { ActionLink } from '@/components/ui/action-link';
import { formatCount } from '@/lib/format-number';
import { CRAWL_STATE_LABEL, NOT_CRAWLED_LABEL, SOURCES_COPY } from '@/features/admin/admin-copy';
import type { DashboardData } from '@/features/admin/server/admin-queries';

// The superadmin's landing page after signing in (the owner's request of 2026-09-29): who is signed in, how many
// accounts there are, and each source's crawl state, from the database, with the way to the sources screen (CS-40).
// The section's other screens arrive with their tasks: the worker and the pipeline (CS-41), tracked models (CS-53).

export const ADMIN_COPY = {
  title: 'پنل مدیریت',
  signedInAs: 'وارد شده با',
  accounts: 'حساب‌ها',
  buyers: 'خریدار',
  superadmins: 'مدیر',
  sources: 'منبع‌ها',
  manageSources: 'توقف و ازسرگیری خزش منبع‌ها',
  comingTitle: 'بخش‌هایی که به این پنل اضافه می‌شوند',
  coming: ['کارگر و خط پردازش: وضعیت کارها و خطاها', 'مدل‌های پوشش‌داده‌شده'],
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-divider p-4">
      <h2 className="text-heading font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function AdminDashboard({ data }: { data: DashboardData }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-bold">{ADMIN_COPY.title}</h1>
        <p className="text-secondary text-muted">
          {ADMIN_COPY.signedInAs}{' '}
          <span dir="ltr" className="wrap-anywhere">
            {data.username}
          </span>
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title={ADMIN_COPY.accounts}>
          <dl className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-label font-medium text-muted">{ADMIN_COPY.buyers}</dt>
              <dd className="text-display font-bold">{formatCount(data.accounts.buyers)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-label font-medium text-muted">{ADMIN_COPY.superadmins}</dt>
              <dd className="text-display font-bold">{formatCount(data.accounts.superadmins)}</dd>
            </div>
          </dl>
        </Section>
        <Section title={ADMIN_COPY.sources}>
          {data.sources.length === 0 ? (
            <p className="text-body text-pretty text-muted">{SOURCES_COPY.empty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {data.sources.map((source) => (
                <li key={source.id} className="flex min-h-11 items-center justify-between gap-4">
                  <span className="text-control">{source.nameFa}</span>
                  <span className="text-secondary text-muted">
                    {source.crawled ? CRAWL_STATE_LABEL[source.crawlState] : NOT_CRAWLED_LABEL}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* The link's own padding widens its target; pulled back so its text lines up with the list. */}
          <div className="-ms-2">
            <ActionLink level="tertiary" href="/admin/sources">
              {ADMIN_COPY.manageSources}
            </ActionLink>
          </div>
        </Section>
      </div>
      <Section title={ADMIN_COPY.comingTitle}>
        <ul className="flex list-disc flex-col gap-1 ps-6 text-body text-muted">
          {ADMIN_COPY.coming.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
