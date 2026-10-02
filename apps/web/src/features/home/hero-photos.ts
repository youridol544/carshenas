import credits from '@public/home/hero/credits.json';

// The home page hero's photographs (CS-63), read from the record that sits beside the served files
// (public/home/hero/credits.json, made by `pnpm --filter @carshenas/web photos:home-hero`): who took each, under which
// licence, what was changed, the Farsi description, the first-paint colour and the blurred placeholder. Nothing about a
// photograph is typed here a second time; what this file adds is only how the page uses them (the order is the file's
// own, the focus of each crop, the srcset). Photographs are served from our own origin, never from where they were found
// (criterion 2), as /home/hero/<id>-<width>.<avif|webp>.

export const HERO_WIDTHS = credits.formats;

type CreditedPhoto = (typeof credits.photos)[number];

/** Where the subject of a 16:9 photograph sits, so a short band on a phone keeps it (docs/design/home-hero-photos.md). */
const FOCUS: Readonly<Record<string, 'right' | 'center'>> = {
  'milad-dusk-traffic': 'right',
  'milad-night-trails': 'right',
  'orange-sunset-skyline': 'right',
};

export type HeroCredit = {
  readonly photographer: string;
  /** The photograph's own page, where the photographer and the licence can be checked. */
  readonly page: string;
  readonly site: string;
  readonly licence: string;
  readonly licenceUrl: string;
  /** Whether the licence demands the credit be shown wherever the photograph is (CC BY): the page shows it always. */
  readonly required: boolean;
  /** What was done to the original, as the credits file records it, for a licence that asks for it. */
  readonly changes: { readonly blurredPlates: boolean };
};

export type HeroSlide = {
  readonly id: string;
  readonly alt: string;
  /** The average colour, shown at once; then the blurred placeholder; then the photograph. */
  readonly colour: string;
  readonly placeholder: string;
  readonly position: 'right' | 'center';
  readonly credit: HeroCredit;
};

function slideOf(photo: CreditedPhoto): HeroSlide {
  return {
    id: photo.id,
    alt: photo.alt,
    colour: photo.dominantColour,
    placeholder: photo.placeholder,
    position: FOCUS[photo.id] ?? 'center',
    credit: {
      photographer: photo.photographer,
      page: photo.page,
      site: photo.site,
      licence: photo.licence,
      licenceUrl: photo.licenceUrl,
      required: photo.licence.startsWith('CC BY'),
      changes: { blurredPlates: photo.blur.length > 0 },
    },
  };
}

/** In slider order: the first is the strongest and lightest, and the only one loaded with the page. */
export const HERO_SLIDES: readonly HeroSlide[] = credits.photos.map(slideOf);

export function heroSrcSet(id: string, format: 'avif' | 'webp'): string {
  return HERO_WIDTHS[format].widths
    .map((width) => `/home/hero/${id}-${width}.${format} ${width}w`)
    .join(', ');
}

/** The file a browser without AVIF and WebP falls back to. */
export function heroFallbackSrc(id: string): string {
  return `/home/hero/${id}-960.webp`;
}
