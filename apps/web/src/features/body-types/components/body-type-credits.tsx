import { ChevronLeft } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { BODY_TYPES } from '@/features/body-types/body-types';

// Who took each body-type photo (CS-57). Every photo comes from Unsplash under the Unsplash License, which asks for
// no credit; the photographers are credited all the same, each name linking to the photo's own page. The site and
// the licence are said once, above the list. Names are Latin text from data: each sits in its own isolate and never
// wraps inside its link.
export function BodyTypeCredits() {
  return (
    <details className="group/credits text-secondary text-muted">
      <summary className="flex min-h-11 w-fit items-center gap-1 text-link">
        <span className="underline">منبع عکس‌ها</span>
        {/* The disclosure cue display:flex removes: points to the inline end (left) while closed, down when open. */}
        <Icon
          icon={ChevronLeft}
          size={16}
          className="group-open/credits:-rotate-90 motion-safe:transition-transform"
        />
      </summary>
      <div className="flex flex-col gap-2 pt-2">
        <p>
          همه‌ی عکس‌ها از{' '}
          <a
            href="https://unsplash.com"
            className="whitespace-nowrap text-link underline"
            rel="noreferrer"
            lang="en"
          >
            <bdi>Unsplash</bdi>
          </a>{' '}
          و با پروانه‌ی{' '}
          <a
            href="https://unsplash.com/license"
            className="whitespace-nowrap text-link underline"
            rel="noreferrer"
            lang="en"
          >
            <bdi>Unsplash License</bdi>
          </a>
          .
        </p>
        <ul className="flex flex-col gap-2">
          {BODY_TYPES.map(({ code, labelFa, photo }) => (
            <li key={code}>
              {labelFa}: <bdi>{photo.car}</bdi>، عکس از{' '}
              <a
                href={photo.page}
                className="whitespace-nowrap text-link underline"
                rel="noreferrer"
                lang="en"
              >
                <bdi>{photo.photographer}</bdi>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
