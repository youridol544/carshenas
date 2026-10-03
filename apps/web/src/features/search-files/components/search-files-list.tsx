import { connection } from 'next/server';
import { FileCard } from '@/features/search-files/components/file-card';
import { FilesEmpty } from '@/features/search-files/components/files-states';
import { groupHeading } from '@/features/search-files/search-files-copy';
import { SEARCH_FILE_STATES } from '@/features/search-files/search-files-rules';
import { listSearchFiles } from '@/features/search-files/server/file-queries';
import { SEARCH_FILES_PATH } from '@/lib/return-path';
import { requireAccount } from '@/server/auth/current-account';

// The signed-in buyer's search files (CS-70 #4): grouped by state, watching first, each with its matches and what is
// new. The session decides whose files these are. It reads the clock for «۳ روز پیش», after connection(), inside the
// page's Suspense, and the counts are read live (a file's matches are never stored).

export async function SearchFilesList() {
  const account = await requireAccount(SEARCH_FILES_PATH);
  await connection();
  const files = await listSearchFiles(account.id, { highlights: true });
  if (files.length === 0) return <FilesEmpty />;
  const now = new Date().toISOString();
  return (
    <div className="flex flex-col gap-8">
      {SEARCH_FILE_STATES.map((state) => {
        const inState = files.filter((file) => file.state === state);
        if (inState.length === 0) return null;
        return (
          <section key={state} aria-labelledby={`files-${state}`} className="flex flex-col gap-3">
            <h2 id={`files-${state}`} className="text-heading font-bold">
              {groupHeading(state, inState.length)}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {inState.map((file) => (
                <li key={file.id} className="flex flex-col *:flex-1">
                  <FileCard file={file} now={now} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
