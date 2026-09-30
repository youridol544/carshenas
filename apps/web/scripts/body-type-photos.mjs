// The body-type selector's photographs (CS-57): `pnpm --filter @carshenas/web photos:body-types`.
//
// public/body-types/credits.json lists one photo per body type with its source, licence, crop and the regions to blur.
// This script downloads each source once into node_modules/.cache/body-type-photos (never committed: the originals
// are large and the manifest says where they came from), blurs the listed regions (licence plates, a painted phone
// number), crops to 4:3, strips every piece of metadata and writes AVIF and WebP at the manifest's widths into
// public/body-types as <code>-<width>.<format>. The files are served by the app itself: Iranian visitors must reach
// them, and the photo sites are not hotlinked. It prints each file's size, and the largest per format.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const webRoot = path.join(import.meta.dirname, '..');
const outputDirectory = path.join(webRoot, 'public', 'body-types');
const cacheDirectory = path.join(webRoot, 'node_modules', '.cache', 'body-type-photos');
// A plain name for the requests to Unsplash's image CDN.
const USER_AGENT = 'CarshenasBodyTypePhotos/1.0 (a build script for the Carshenas web app)';

// Chosen by eye at the selector's sizes: AVIF at 55 and WebP at 74 show no visible banding on the sky gradients.
const FORMATS = [
  { extension: 'avif', encode: (image) => image.avif({ quality: 55, effort: 6 }) },
  { extension: 'webp', encode: (image) => image.webp({ quality: 74, effort: 6 }) },
];

async function source(photo) {
  const file = path.join(cacheDirectory, `${photo.code}.jpg`);
  const cached = await stat(file).catch(() => null);
  if (cached) return file;
  const response = await fetch(photo.download, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${photo.code}: ${response.status} from ${photo.download}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

/** The source with every listed region blurred beyond reading, as raw pixels ready to crop. */
async function blurred(file, regions) {
  // Some JPEGs carry harmless structural warnings; decode them rather than refuse.
  const base = sharp(file, { failOn: 'none' }).rotate();
  const patches = await Promise.all(
    regions.map(async (region) => ({
      input: await base
        .clone()
        .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
        .blur(Math.max(12, Math.round(Math.min(region.width, region.height) / 3)))
        .toBuffer(),
      left: region.x,
      top: region.y,
    })),
  );
  return base.clone().composite(patches).png().toBuffer();
}

const manifest = JSON.parse(await readFile(path.join(outputDirectory, 'credits.json'), 'utf8'));
await mkdir(cacheDirectory, { recursive: true });

const largest = {};
for (const photo of manifest.photos) {
  const { crop } = photo;
  if (Math.abs(crop.width / crop.height - 4 / 3) > 0.01)
    throw new Error(`${photo.code}: the crop is not 4:3`);
  const cropped = await sharp(await blurred(await source(photo), photo.blur))
    .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
    .toBuffer();
  const sizes = [];
  for (const width of manifest.widths) {
    for (const format of FORMATS) {
      const name = `${photo.code}-${width}.${format.extension}`;
      // sharp writes no EXIF, ICC or XMP unless asked (withMetadata), so the output carries none of the source's.
      const output = await format
        .encode(
          sharp(cropped)
            .resize({ width, height: Math.round((width * 3) / 4), fit: 'cover' })
            .toColourspace('srgb'),
        )
        .toBuffer();
      await writeFile(path.join(outputDirectory, name), output);
      sizes.push(`${width}w ${format.extension} ${(output.length / 1024).toFixed(1)} KB`);
      if (!largest[format.extension] || output.length > largest[format.extension].bytes)
        largest[format.extension] = { name, bytes: output.length };
    }
  }
  console.log(`${photo.code}: ${sizes.join(', ')}`);
}
for (const [extension, { name, bytes }] of Object.entries(largest))
  console.log(`largest ${extension}: ${name}, ${(bytes / 1024).toFixed(1)} KB`);
