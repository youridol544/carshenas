// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  BODY_TYPE_CODES,
  BODY_TYPE_PHOTO_WIDTHS,
  BODY_TYPES,
  bodyTypePhotoAlt,
  bodyTypePhotoSrcSet,
} from '@/features/body-types/body-types';

// The credits file beside the served photos is the record of where each came from; the components show the same
// credits from BODY_TYPES. These tests keep the two, and the files on disk, from drifting apart.
const publicDirectory = new URL('../../../public/body-types/', import.meta.url);
type CreditedPhoto = {
  code: string;
  car: string;
  page: string;
  photographer: string;
  photographerUrl: string;
  site: string;
  licence: string;
  licenceUrl: string;
  crop: { width: number; height: number };
};
const credits = JSON.parse(readFileSync(new URL('credits.json', publicDirectory), 'utf8')) as {
  widths: number[];
  photos: CreditedPhoto[];
};

test('every body type has one photo, in the catalogue order', () => {
  expect(BODY_TYPES.map((bodyType) => bodyType.code)).toEqual([...BODY_TYPE_CODES]);
  expect(credits.photos.map((photo) => photo.code)).toEqual([...BODY_TYPE_CODES]);
});

test('the credits shown on the page match the credits file', () => {
  for (const bodyType of BODY_TYPES) {
    const credited = credits.photos.find((photo) => photo.code === bodyType.code);
    expect({ code: bodyType.code, ...credited }).toMatchObject({
      code: bodyType.code,
      ...bodyType.photo,
      car: expect.stringContaining(bodyType.photo.car) as string,
    });
  }
});

test('every photo is under the Unsplash License, which allows commercial use without a fee', () => {
  expect(new Set(credits.photos.map((photo) => photo.licence))).toEqual(new Set(['Unsplash License']));
});

test('every photo is cropped to 4:3 and written in AVIF and WebP at every width', () => {
  expect(credits.widths).toEqual([...BODY_TYPE_PHOTO_WIDTHS]);
  const notFourByThree = credits.photos
    .filter((photo) => Math.abs(photo.crop.width / photo.crop.height - 4 / 3) > 0.01)
    .map((photo) => photo.code);
  expect(notFourByThree).toEqual([]);
  const missing = BODY_TYPE_CODES.flatMap((code) =>
    BODY_TYPE_PHOTO_WIDTHS.flatMap((width) =>
      ['avif', 'webp'].map((format) => `${code}-${String(width)}.${format}`),
    ),
  ).filter((file) => !existsSync(new URL(file, publicDirectory)));
  expect(missing).toEqual([]);
});

test('a photo standing alone is described in Farsi, and its sources list every width', () => {
  const [sedan] = BODY_TYPES;
  expect(bodyTypePhotoAlt(sedan)).toBe('تویوتا کمری، نمونه‌ی سدان');
  expect(bodyTypePhotoSrcSet('sedan', 'avif')).toBe(
    '/body-types/sedan-160.avif 160w, /body-types/sedan-240.avif 240w, /body-types/sedan-320.avif 320w, /body-types/sedan-480.avif 480w, /body-types/sedan-640.avif 640w',
  );
});
