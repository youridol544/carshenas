import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { actionClasses } from '@/components/ui/action-link';
import { BrowserFailures } from '@/features/diagnostics/components/browser-failures';
import { DIAGNOSTIC_MESSAGE, isDiagnosticFailure } from '@/features/diagnostics/diagnostics';
import { failOnPurposeAction } from '@/features/diagnostics/diagnostics-actions';
import { env } from '@/server/env';

export const metadata: Metadata = { title: 'بررسی گزارش خطا', robots: { index: false } };

// It reads its params before rendering anything, which the build accepts only for a route marked as blocking.
// Next.js still streams it, so a not-found or an error here is sent with status 200 and noindex (the bundled
// streaming guide, "The HTTP contract"); the log line carries the failure.
export const instant = false;

// Failures on purpose, to check error reporting on a deployment (features/diagnostics, ADR-0016).
export default async function DiagnosticsPage({ params }: PageProps<'/diagnostics/[failure]'>) {
  const { failure } = await params;
  if (!env.diagnosticsEnabled || !isDiagnosticFailure(failure)) notFound();
  if (failure === 'server-render') throw new Error(DIAGNOSTIC_MESSAGE);
  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-title font-bold">بررسی گزارش خطا</h1>
      {failure === 'server-action' ? (
        <form action={failOnPurposeAction}>
          <button type="submit" className={actionClasses('primary')}>
            خطا در کار سرور
          </button>
        </form>
      ) : (
        <BrowserFailures />
      )}
    </main>
  );
}
