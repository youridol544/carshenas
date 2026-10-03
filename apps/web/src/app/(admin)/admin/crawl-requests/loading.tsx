import { SkeletonBlock, SkeletonPill } from '@/components/ui/skeleton';
import { CRAWL_REQUESTS_ADMIN_COPY as COPY } from '@/features/admin/crawl-requests-admin-copy';

// The crawl-request screen while the session and its reads arrive (CS-71): the screen's own frame in grey, so nothing
// jumps when the cards come. The title is real, since it needs no data.
export default function Loading() {
  return (
    <main aria-busy className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <h1 className="text-title font-bold">{COPY.title}</h1>
      <p role="status" className="sr-only">
        {COPY.loading}
      </p>
      <div aria-hidden className="flex flex-col gap-3">
        <SkeletonPill className="h-11 w-2/3" />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="h-56 overflow-hidden rounded-card">
            <SkeletonBlock />
          </div>
          <div className="h-56 overflow-hidden rounded-card">
            <SkeletonBlock />
          </div>
        </div>
      </div>
    </main>
  );
}
