// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { HERO_SLIDES, HERO_WIDTHS, heroFallbackSrc, heroSrcSet } from '@/features/home/hero-photos';

// The photographs on the page are read from the credits file beside the served files; these tests hold the page to
// that file and the served files to both, and the CC BY photograph to its credit.

const publicDirectory = new URL('../../../public/', import.meta.url);
const credits = JSON.parse(readFileSync(new URL('home/hero/credits.json', publicDirectory), 'utf8')) as {
  photos: { id: string; licence: string; photographer: string }[];
};

test('the slides are the credits file’s photographs, in its order', () => {
  expect(HERO_SLIDES.map((slide) => slide.id)).toEqual(credits.photos.map((photo) => photo.id));
  expect(HERO_SLIDES).toHaveLength(6);
});

test('every file a srcset names is served from our own origin, and exists', () => {
  for (const slide of HERO_SLIDES) {
    for (const format of ['avif', 'webp'] as const) {
      for (const width of HERO_WIDTHS[format].widths) {
        expect(existsSync(new URL(`home/hero/${slide.id}-${width}.${format}`, publicDirectory))).toBe(true);
      }
      expect(heroSrcSet(slide.id, format)).not.toMatch(/https?:/);
    }
    expect(existsSync(new URL(heroFallbackSrc(slide.id).slice(1), publicDirectory))).toBe(true);
  }
});

test('the photograph that needs its credit shown says so, and no other claims to', () => {
  const required = HERO_SLIDES.filter((slide) => slide.credit.required);
  expect(required.map((slide) => slide.id)).toEqual(['azadi-night-traffic']);
  expect(required[0]?.credit).toMatchObject({ photographer: 'Thomas Jaehnel', licence: 'CC BY 2.0' });
});

test('every slide carries the Farsi description, a first-paint colour and a placeholder', () => {
  for (const slide of HERO_SLIDES) {
    expect(slide.alt).toMatch(/[؀-ۿ]/);
    expect(slide.colour).toMatch(/^#[0-9a-f]{6}$/);
    expect(slide.placeholder).toMatch(/^data:image\/webp;base64,/);
  }
});
