'use client';

import { useRouter } from 'next/navigation';
import { actionClasses } from '@/components/ui/action-link';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';

// The two states of a file's page that are not its matches: a stored search this build can no longer read (the file is
// listed and can be deleted, its cars are not guessed), and matches the database could not give (the file itself is
// there; a retry reads them again).

export function FileUnreadable() {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-6">
      <h2 className="text-heading font-bold">{SEARCH_FILES_COPY.file.unreadableTitle}</h2>
      <p className="max-w-reading text-body text-pretty text-muted">
        {SEARCH_FILES_COPY.file.unreadableBody}
      </p>
    </div>
  );
}

export function FileResultsFailed() {
  const router = useRouter();
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface p-6"
    >
      <h2 className="text-heading font-bold">{SEARCH_FILES_COPY.file.resultsFailedTitle}</h2>
      <p className="max-w-reading text-body text-pretty text-muted">
        {SEARCH_FILES_COPY.file.resultsFailedBody}
      </p>
      <button
        type="button"
        onClick={() => {
          router.refresh();
        }}
        className={actionClasses('secondary')}
      >
        {SEARCH_FILES_COPY.file.retry}
      </button>
    </div>
  );
}
