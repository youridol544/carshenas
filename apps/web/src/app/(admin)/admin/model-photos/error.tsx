'use client';

import { actionClasses } from '@/components/ui/action-link';
import { MODEL_PHOTOS_COPY as COPY } from '@/features/admin/model-photos-admin-copy';

// The model-photos screen when its reads fail (CS-97): the failure stays inside the page, says nothing was changed and
// offers one retry. The error itself is reported by the framework's boundary; its text is never shown.
export default function ModelPhotosError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 pt-8 pb-16">
      <h1 className="text-title font-bold">{COPY.title}</h1>
      <div
        role="alert"
        className="flex max-w-reading flex-col items-start gap-3 rounded-card border border-divider bg-surface p-6"
      >
        <h2 className="text-control font-semibold">{COPY.errorTitle}</h2>
        <p className="text-body text-pretty text-muted">{COPY.errorBody}</p>
        <button type="button" onClick={reset} className={actionClasses('secondary')}>
          {COPY.retry}
        </button>
      </div>
    </main>
  );
}
