import { ActionLink } from '@/components/ui/action-link';
import { SOURCES_COPY } from '@/features/admin/admin-copy';
import { SourceCard } from '@/features/admin/components/source-card';
import type { SourcesData } from '@/features/admin/server/admin-queries';

// The sources screen of the superadmin section (CS-40): every source with its crawl state, the crawler's stop, the
// control that pauses or resumes it, and who changed it lately. Linked from the dashboard only.

export function SourcesScreen({ data }: { data: SourcesData }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <div className="flex flex-col gap-1">
        {/* The link's own padding widens its target; pulled back so its text lines up with the heading. */}
        <div className="-ms-2">
          <ActionLink level="tertiary" href="/admin">
            {SOURCES_COPY.backToDashboard}
          </ActionLink>
        </div>
        <h1 className="text-title font-bold">{SOURCES_COPY.title}</h1>
        <p className="max-w-reading text-secondary text-pretty text-muted">{SOURCES_COPY.lead}</p>
      </div>
      {data.sources.length === 0 ? (
        <p className="text-body text-pretty text-muted">{SOURCES_COPY.empty}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.sources.map((source) => (
            <li key={source.id}>
              <SourceCard source={source} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
