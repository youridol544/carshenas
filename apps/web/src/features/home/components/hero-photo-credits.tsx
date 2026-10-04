import { HERO_SLIDES } from '@/features/home/hero-photos';
import { HOME_COPY } from '@/features/home/home-copy';
import { ChevronLeft } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

// The full credits of the home page's photographs (CS-63), for the footer: every photograph, with who took it, under
// which licence and what was changed, read from public/home/hero/credits.json (hero-photos.ts), never typed here. Four
// are under the Unsplash License and one is CC0, which ask for nothing; one is CC BY 2.0, whose terms are the
// photographer's name, the licence and its link, a link to the source and a note of what was changed. All six are
// listed alike. The credit of the photograph showing is also on the hero itself.
export function HeroPhotoCredits() {
  return (
    <details className="group/credits text-secondary text-muted">
      <summary className="flex min-h-11 w-fit items-center gap-1 text-link">
        <span className="underline">{HOME_COPY.footer.credits}</span>
        <Icon
          icon={ChevronLeft}
          size={16}
          className="group-open/credits:-rotate-90 motion-safe:transition-transform"
        />
      </summary>
      <div className="flex flex-col gap-2 pt-2">
        <ul className="flex flex-col gap-3">
          {HERO_SLIDES.map((slide) => (
            <li key={slide.id} data-credit-of={slide.id} className="flex flex-col gap-1">
              <span className="text-default">{slide.alt}</span>
              <span>
                {HOME_COPY.footer.by}{' '}
                <a
                  href={slide.credit.page}
                  rel="noreferrer"
                  lang="en"
                  className="whitespace-nowrap text-link underline"
                >
                  <bdi>{slide.credit.photographer}</bdi>
                </a>
                {'، '}
                {HOME_COPY.footer.licence}{' '}
                <a
                  href={slide.credit.licenceUrl}
                  rel="noreferrer"
                  lang="en"
                  className="whitespace-nowrap text-link underline"
                >
                  <bdi>{slide.credit.licence}</bdi>
                </a>
                {'. '}
                {HOME_COPY.footer.changed} {HOME_COPY.footer.changes}
                {slide.credit.changes.blurredPlates ? `، ${HOME_COPY.footer.plates}` : ''}.
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
