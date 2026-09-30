import { BODY_TYPES } from '@/features/body-types/body-types';

// Who took each body-type photo and under which licence (CS-57). The Unsplash License asks for no credit; the
// photographers are credited all the same. Names and licences are Latin text from data, so each sits in its own isolate.
export function BodyTypeCredits() {
  return (
    <details className="text-secondary text-muted">
      <summary className="flex min-h-11 w-fit items-center text-link underline">منبع عکس‌ها</summary>
      <ul className="flex flex-col gap-2 pt-2">
        {BODY_TYPES.map(({ code, labelFa, photo }) => (
          <li key={code}>
            {labelFa}: <bdi>{photo.car}</bdi>، عکس از{' '}
            <a href={photo.photographerUrl} className="text-link underline" rel="noreferrer">
              <bdi>{photo.photographer}</bdi>
            </a>{' '}
            در{' '}
            <a href={photo.page} className="text-link underline" rel="noreferrer">
              <bdi>{photo.site}</bdi>
            </a>
            ،{' '}
            <a href={photo.licenceUrl} className="text-link underline" rel="noreferrer" lang="en">
              <bdi>{photo.licence}</bdi>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
