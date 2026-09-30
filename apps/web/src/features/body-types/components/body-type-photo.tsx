import { bodyTypePhotoAlt, bodyTypePhotoSrcSet, type BodyType } from '@/features/body-types/body-types';

type BodyTypePhotoProps = {
  bodyType: BodyType;
  /** The photo's rendered width at each breakpoint, so the browser picks the smallest file that is sharp enough. */
  sizes: string;
  /** Inside a control that already carries the body type's name, the photo adds nothing for a screen reader. */
  decorative?: boolean;
};

// A body type's photograph (CS-57), for a frame inside an 8 px padded card (rounded-inner): AVIF where the browser has it, WebP otherwise, both from our own origin. The 4:3
// frame is fixed, so its box is reserved before a byte arrives, and its neutral background shows while it loads. The
// 1 px inset edge in black alpha keeps a white car on a pale sky from melting into the page (craft.md, surfaces).
export function BodyTypePhoto({ bodyType, sizes, decorative = false }: BodyTypePhotoProps) {
  return (
    <picture>
      <source type="image/avif" srcSet={bodyTypePhotoSrcSet(bodyType.code, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={bodyTypePhotoSrcSet(bodyType.code, 'webp')} sizes={sizes} />
      <img
        src={`/body-types/${bodyType.code}-320.webp`}
        alt={decorative ? '' : bodyTypePhotoAlt(bodyType)}
        width={640}
        height={480}
        loading="lazy"
        decoding="async"
        className="aspect-4/3 w-full rounded-inner bg-surface-muted object-cover outline-1 -outline-offset-1 outline-photo"
      />
    </picture>
  );
}
