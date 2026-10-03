import type { BrowserContext } from '@playwright/test';

// Listing photos load from the source's own host (ADR-0025): divarcdn.com for Divar. A browser test must never reach
// it, because the lane rules and the crawl policy (ADR-0008) say nothing is requested from a listing site by tests and
// by agents, so every request to a source's photo host is answered here with a drawn stand-in: a car by the roadside
// in one of six colours, chosen by the address, 4:3 like the frame it fills. The fixture in test.ts installs it for
// every test, so a page that shows listings can be opened without a request leaving the machine.

const PHOTO_HOSTS = /^https:\/\/([a-z0-9-]+\.)*divarcdn\.com\//;

const CARS = [
  { body: '#f4f4f2', roof: '#dfe3e6' },
  { body: '#a9afb7', roof: '#8e949c' },
  { body: '#2b2f36', roof: '#1f2329' },
  { body: '#2c4a8a', roof: '#233b70' },
  { body: '#9b2a2a', roof: '#7d2020' },
  { body: '#5a6068', roof: '#474c53' },
] as const;

const SKIES = [
  ['#cfe3f4', '#eef5fb'],
  ['#e7dcc9', '#f6efe4'],
  ['#c8d3df', '#e9eef3'],
  ['#d9e6d2', '#f1f6ee'],
] as const;

/** A drawn car beside a road, 320 by 240, in a colour and a sky picked by the seed. */
export function photoSvg(seed: number): string {
  const car = CARS[seed % CARS.length] ?? CARS[0];
  const [top, bottom] = SKIES[Math.floor(seed / CARS.length) % SKIES.length] ?? SKIES[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
<rect width="320" height="240" fill="url(#sky)"/>
<rect y="170" width="320" height="70" fill="#9aa0a6"/>
<rect y="168" width="320" height="4" fill="#c9ccd0"/>
<ellipse cx="165" cy="198" rx="112" ry="9" fill="#000" opacity=".18"/>
<path d="M64 178V150q0-12 14-16l28-6 22-22q6-6 16-6h52q10 0 16 6l20 22 20 6q14 4 14 16v28z" fill="${car.body}"/>
<path d="M132 112l10-6h48l12 6 14 16H116z" fill="#1d2630" opacity=".85"/>
<path d="M146 106h4v22h-4z" fill="${car.roof}"/>
<circle cx="104" cy="180" r="22" fill="#15181c"/><circle cx="104" cy="180" r="11" fill="#8c9096"/>
<circle cx="226" cy="180" r="22" fill="#15181c"/><circle cx="226" cy="180" r="11" fill="#8c9096"/>
</svg>`;
}

function seedOf(url: string): number {
  let hash = 0;
  for (const character of url) hash = (hash * 31 + character.charCodeAt(0)) % 100_003;
  return hash;
}

// A model's own photo, loaded from the address the superadmin gave (CS-97): the tests use one made-up host. An address
// whose path says «broken» is a photo that does not load (404), so the tile's fallback can be seen.
const MODEL_PHOTO_HOST = /^https:\/\/e2e-model-photos\.cars-cdn\.ir\//;

/** Answers every request to a source's photo host with a drawn stand-in, for every page of the context. */
export async function stubSourcePhotos(context: BrowserContext): Promise<void> {
  await context.route(MODEL_PHOTO_HOST, (route) => {
    const url = route.request().url();
    return url.includes('broken')
      ? route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' })
      : route.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(seedOf(url)) });
  });
  await context.route(PHOTO_HOSTS, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: photoSvg(seedOf(route.request().url())),
    }),
  );
}
