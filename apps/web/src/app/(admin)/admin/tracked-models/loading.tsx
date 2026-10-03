import { SkeletonBlock, SkeletonPill } from '@/components/ui/skeleton';
import { TRACKED_MODELS_COPY as COPY } from '@/features/admin/tracked-models-admin-copy';

// The tracked-models screen while the session and its reads arrive (CS-53): the screen's own frame in grey, so nothing
// jumps when the cards come. The title is real, since it needs no data.
export default function Loading() {
  return (
    <main aria-busy className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <h1 className="text-title font-bold">{COPY.title}</h1>
      <p role="status" className="sr-only">
        {COPY.loading}
      </p>
      <div aria-hidden className="flex flex-col gap-3">
        <SkeletonPill className="h-20 w-full" />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="h-96 overflow-hidden rounded-card">
            <SkeletonBlock />
          </div>
          <div className="h-96 overflow-hidden rounded-card">
            <SkeletonBlock />
          </div>
        </div>
      </div>
    </main>
  );
}
