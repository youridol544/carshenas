import { ActionLink } from '@/components/ui/action-link';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { formatDate } from '@carshenas/locale/format-date';
import { ModelPhotoEditor } from '@/features/admin/components/model-photo-editor';
import { MODEL_PHOTOS_COPY as COPY } from '@/features/admin/model-photos-admin-copy';
import type { AdminModelPhotos } from '@/features/admin/server/model-photo-queries';

// The model photos (CS-97), for the superadmin: the popular models, the ones on the home page's row marked, each with the
// photo link set for it, who set it and when, and the editor with its live preview. A model is a card on every width.

const INFO: InfoContent = {
  title: COPY.info.title,
  sections: [{ id: 'what', paragraphs: COPY.info.paragraphs }],
};

export function ModelPhotosScreen({ data }: { data: AdminModelPhotos }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <div className="flex flex-col gap-1">
        <div className="-ms-2">
          <ActionLink level="tertiary" href="/admin">
            {COPY.backToDashboard}
          </ActionLink>
        </div>
        <div className="flex items-center gap-1">
          <h1 className="text-title font-bold">{COPY.title}</h1>
          <InfoPopover label={COPY.info.label} closeLabel={COPY.info.close} content={INFO} />
        </div>
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.lead}</p>
      </div>
      <section aria-labelledby="photo-models" className="flex flex-col gap-3">
        <h2 id="photo-models" className="text-heading font-bold">
          {COPY.listHeading}
        </h2>
        {data.rows.length === 0 ? (
          <p className="max-w-reading text-body text-pretty text-muted">{COPY.empty}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 lg:items-start" data-photo-count={data.rows.length}>
            {data.rows.map((row) => (
              <li
                key={row.key}
                data-photo-model={row.key}
                data-photo-saved={row.photoUrl === null ? 'no' : 'yes'}
                className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 text-control font-semibold text-balance">
                    <bdi>{row.name}</bdi>
                  </h3>
                  <span
                    className={`inline-flex shrink-0 rounded-badge px-2 py-0.5 text-label font-medium ${
                      row.onHome ? 'bg-action-subtle text-on-action-subtle' : 'bg-surface-muted text-muted'
                    }`}
                  >
                    {row.onHome ? COPY.onHome : COPY.onIndexOnly}
                  </span>
                </div>
                <p className="-mt-1 text-secondary text-pretty text-muted" data-photo-origin>
                  {row.photoUrl === null || row.setBy === null || row.setAt === null ? (
                    COPY.notSet
                  ) : (
                    <>
                      {`${COPY.setByLabel} `}
                      <span dir="ltr">{row.setBy}</span>
                      {'، '}
                      {formatDate(row.setAt)}
                    </>
                  )}
                </p>
                <ModelPhotoEditor modelId={row.modelId} carName={row.name} savedUrl={row.photoUrl} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
