// The home page hero's photographs (CS-63): `pnpm --filter @carshenas/web photos:home-hero`.
//
// public/home/hero/credits.json lists the photographs in slider order: where each came from, who took it and under
// which licence, the 16:9 crop (source pixels), an optional colour grade, the regions to blur (licence plates) and
// the Farsi text that describes it. This script downloads each source once into node_modules/.cache/home-hero-photos
// (never committed: the originals are large and the manifest says where they came from), checks it against the size
// and SHA-256 the manifest records (a source that changed would put every crop in the wrong place, so it is refused),
// blurs the listed regions, grades, crops, strips every piece of metadata and writes AVIF and WebP at the manifest's
// widths into public/home/hero as <id>-<width>.<format>. Files that the manifest no longer lists are removed.
//
// It also measures what the page needs for the first paint, the average colour and a 24 px wide blurred placeholder
// as a data URI, and writes them, with the source's size and SHA-256, back into credits.json (formatted by Prettier,
// so a run that changes nothing leaves no diff). Name photo ids as arguments to remake only those.
// The files are served by the app itself: Iranian visitors must reach them, and the photo sites are not hotlinked.
// It prints each file's size, the first photograph's smallest AVIF (the largest contentful paint on a phone) and
// the size of the whole set.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as prettier from 'prettier';
import sharp from 'sharp';

const webRoot = path.join(import.meta.dirname, '..');
const outputDirectory = path.join(webRoot, 'public', 'home', 'hero');
const manifestFile = path.join(outputDirectory, 'credits.json');
const cacheDirectory = path.join(webRoot, 'node_modules', '.cache', 'home-hero-photos');
// A plain name for the requests to the photo sites; no contact details, no personal data.
const USER_AGENT = 'CarshenasHomeHeroPhotos/1.0 (a build script for the Carshenas web app)';

// The set's budget (CS-63): every photograph is a full-bleed image, so the repository and the first paint both pay.
const BUDGET = { firstPhone: 60 * 1024, firstPhoneFile: 640, set: 2.5 * 1024 * 1024 };

const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
await mkdir(cacheDirectory, { recursive: true });

const only = process.argv.slice(2);
const photos = manifest.photos.filter((entry) => only.length === 0 || only.includes(entry.id));
if (only.length > 0 && photos.length !== only.length)
  throw new Error(`unknown photo id in: ${only.join(', ')}`);

/** The cached original, downloaded on first use, with its SHA-256. */
async function source(photo) {
  const file = path.join(cacheDirectory, `${photo.id}.jpg`);
  if (!(await stat(file).catch(() => null))) {
    const response = await fetch(photo.download, { headers: { 'user-agent': USER_AGENT } });
    if (!response.ok) throw new Error(`${photo.id}: ${response.status} from ${photo.download}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  const sha256 = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
  if (photo.source?.sha256 && photo.source.sha256 !== sha256)
    throw new Error(
      `${photo.id}: the source changed (SHA-256 ${sha256}, recorded ${photo.source.sha256}). Check the crop and the blurred regions against the new file, then remove ${file} and the recorded source to accept it.`,
    );
  return { file, sha256 };
}

/** Decoded, upright pixels as a raw buffer, with every listed region blurred beyond reading. */
async function upright(file, regions) {
  // Some JPEGs carry harmless structural warnings; decode them rather than refuse.
  const { data, info } = await sharp(file, { failOn: 'none' })
    .rotate()
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (regions.length === 0) return { data, info };
  const raw = { width: info.width, height: info.height, channels: info.channels };
  const patches = await Promise.all(
    regions.map(async (region) => ({
      input: await sharp(data, { raw })
        .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
        .blur(Math.max(12, Math.round(Math.min(region.width, region.height) / 3)))
        .raw()
        .toBuffer(),
      raw: { width: region.width, height: region.height, channels: info.channels },
      left: region.x,
      top: region.y,
    })),
  );
  const composed = await sharp(data, { raw }).composite(patches).raw().toBuffer({ resolveWithObject: true });
  return composed;
}

/**
 * The 16:9 crop, graded. The grade is applied to the crop in this order: per-channel multiply and add, contrast around
 * mid-grey, then saturation. `multiply` and `add` are in 8-bit steps (add: 0 to 255), like CS-57's.
 */
async function prepare(photo, { data, info }) {
  const { crop, grade } = photo;
  if (Math.abs(crop.width / crop.height - 16 / 9) > 0.005)
    throw new Error(`${photo.id}: the crop is not 16:9`);
  if (crop.x + crop.width > info.width || crop.y + crop.height > info.height)
    throw new Error(`${photo.id}: the crop leaves the ${String(info.width)}x${String(info.height)} source`);
  let image = sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  }).extract({
    left: crop.x,
    top: crop.y,
    width: crop.width,
    height: crop.height,
  });
  if (grade) {
    const multiply = grade.multiply ?? [1, 1, 1];
    const add = grade.add ?? [0, 0, 0];
    const contrast = grade.contrast ?? 1;
    // out = contrast * (multiply * in + add - 128) + 128
    image = image.linear(
      multiply.map((m) => contrast * m),
      add.map((a) => contrast * (a - 128) + 128),
    );
    if (grade.saturation) image = image.modulate({ saturation: grade.saturation });
  }
  return image.raw().toBuffer({ resolveWithObject: true });
}

/** What the page paints first: the average colour and a 24 px wide blurred picture as a data URI. */
async function firstPaint(prepared, settings) {
  const raw = { width: prepared.info.width, height: prepared.info.height, channels: prepared.info.channels };
  const { channels } = await sharp(prepared.data, { raw }).stats();
  const dominantColour = `#${channels
    .slice(0, 3)
    .map((channel) => Math.round(channel.mean).toString(16).padStart(2, '0'))
    .join('')}`;
  const tiny = await sharp(prepared.data, { raw })
    .resize({ width: settings.width, height: Math.round((settings.width * 9) / 16), fit: 'cover' })
    .webp({ quality: settings.quality, effort: 6, smartSubsample: true })
    .toBuffer();
  return { dominantColour, placeholder: `data:image/webp;base64,${tiny.toString('base64')}` };
}

const ENCODERS = {
  // Chosen by eye on the sky gradients at the hero's sizes; the manifest holds the numbers.
  avif: (image, options) => image.avif({ quality: options.quality, effort: options.effort }),
  webp: (image, options) =>
    image.webp({ quality: options.quality, effort: options.effort, smartSubsample: true }),
};

const sizes = new Map();
const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

for (const photo of photos) {
  const { file, sha256 } = await source(photo);
  const decoded = await upright(file, photo.blur ?? []);
  if (
    photo.source?.width &&
    (photo.source.width !== decoded.info.width || photo.source.height !== decoded.info.height)
  )
    throw new Error(
      `${photo.id}: the source is ${String(decoded.info.width)}x${String(decoded.info.height)}`,
    );
  const prepared = await prepare(photo, decoded);
  const raw = { width: prepared.info.width, height: prepared.info.height, channels: prepared.info.channels };
  const written = [];
  for (const [format, settings] of Object.entries(manifest.formats)) {
    const options = { ...settings, ...photo.quality?.[format] };
    for (const width of settings.widths) {
      const name = `${photo.id}-${String(width)}.${format}`;
      // sharp writes no EXIF, ICC or XMP unless asked (withMetadata), so the output carries none of the source's.
      const output = await ENCODERS[format](
        sharp(prepared.data, { raw }).resize({ width, height: Math.round((width * 9) / 16), fit: 'cover' }),
        options,
      ).toBuffer();
      await writeFile(path.join(outputDirectory, name), output);
      sizes.set(name, output.length);
      written.push(`${String(width)}w ${format} ${kilobytes(output.length)}`);
    }
  }
  photo.source = { width: decoded.info.width, height: decoded.info.height, sha256 };
  Object.assign(photo, await firstPaint(prepared, manifest.placeholder));
  console.log(`${photo.id}: ${written.join(', ')}`);
}

// The manifest keeps each photograph's fields in this order; the generated ones are the last three.
const options = (await prettier.resolveConfig(manifestFile)) ?? {};
const text = await prettier.format(JSON.stringify(manifest), { ...options, filepath: manifestFile });
if (text !== (await readFile(manifestFile, 'utf8'))) await writeFile(manifestFile, text);

if (only.length === 0) {
  const wanted = new Set(
    manifest.photos.flatMap((photo) =>
      Object.entries(manifest.formats).flatMap(([format, settings]) =>
        settings.widths.map((width) => `${photo.id}-${String(width)}.${format}`),
      ),
    ),
  );
  for (const name of await readdir(outputDirectory))
    if (name !== 'credits.json' && !wanted.has(name)) {
      await unlink(path.join(outputDirectory, name));
      console.log(`removed ${name}: the manifest no longer lists it`);
    }
}

// The totals count what is on disk, so a run for one id still reports the whole set.
let total = 0;
for (const name of await readdir(outputDirectory)) {
  const { size } = await stat(path.join(outputDirectory, name));
  sizes.set(name, size);
  total += size;
}
const first = manifest.photos[0];
const firstPhone = sizes.get(`${first.id}-${String(BUDGET.firstPhoneFile)}.avif`) ?? 0;
console.log(
  `first photograph (${first.id}) at ${String(BUDGET.firstPhoneFile)} px, AVIF: ${kilobytes(firstPhone)} (budget ${kilobytes(BUDGET.firstPhone)})`,
);
console.log(`the set: ${kilobytes(total)} in all (budget ${kilobytes(BUDGET.set)})`);
if (firstPhone > BUDGET.firstPhone || total > BUDGET.set) process.exitCode = 1;
