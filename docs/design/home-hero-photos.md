# Home hero photographs (CS-63)

Six photographs of Tehran for the home page hero, self-hosted in `apps/web/public/home/hero/`. Everything about each one (source, photographer, licence, crop, blurred plates, Farsi alt text, calm side, first-paint colour and placeholder) is in `credits.json` beside them. `pnpm --filter @carshenas/web photos:home-hero` rebuilds every file from the manifest; the originals are cached under `node_modules/.cache/home-hero-photos` and never committed, and the script refuses a source whose SHA-256 differs from the recorded one.

## Order for a slider

| # | id | Why here |
|---|---|---|
| 1 | `milad-dusk-traffic` | Strongest and lightest: Milad Tower, dusk sky, a stream of cars. 12 KB AVIF at 640 px, smooth sky on the left for text. |
| 2 | `hakim-golden-hour` | The most car-centred: Iranian cars in warm light (CC0). Busy, so text needs a scrim. |
| 3 | `milad-night-trails` | Night, light trails, a dark sky across the top. |
| 4 | `orange-sunset-skyline` | Pure warmth, 7.6 KB at 640 px; no cars. |
| 5 | `azadi-night-traffic` | The Azadi Square jam: "lots of cars". Credit required (CC BY 2.0). |
| 6 | `tehran-moon-aerial` | Aerial night with a full moon; dark top 40 % for text. |

Warm dusk and night with orange light run through all six, so a cross-fade does not jump in exposure.

## How they were chosen

- **Location.** Unsplash pages state "Tehran, Tehran Province, Iran" (or "Tehran Province") in their location field and tags; the two Commons files sit in Tehran categories. Milad Tower, Azadi Tower and the Chamran and Hakim road signs are visible in the pictures themselves.
- **Licence.** Each Unsplash page says "Free to use under the Unsplash License", and each file comes from `images.unsplash.com` (Unsplash+ files come from `plus.unsplash.com`). The Commons photos are CC0 and CC BY 2.0. CC BY-SA photos were left out to avoid share-alike duties.
- **How the pages were read (2026-10-02).** On this machine Unsplash is filtered and its pages answer with a proof-of-work bot challenge, which was not worked around. The page facts came from the Internet Archive's copies of the photo and topic pages and from the web-search tool; the image files came from `images.unsplash.com` through the owner's local proxy (127.0.0.1:2080). `hosein charbaghi`'s page and `Majid Masajedi`'s profile were not readable, so their entries link the photo page, not a profile.
- **Checks.** At least 3000 px wide at the source (4240 to 6720 px; the downloads are 3600 px renditions), landscape, no faces, no billboards or brand marks in the crop, licence plates blurred (Hakim, Azadi); the plates in the dusk and night shots are smeared or a few pixels wide. A watermark on another candidate was left out.
- **Not used.** BY-SA photos, a photo with a visible brand sign, photos whose location could not be confirmed.

## Sizes

AVIF q50 at 640, 960, 1440 and 1920 px; WebP q72 at 640 and 960 only (a browser without AVIF and wider than 960 px scales the 960 file). The set is about 2.1 MB; with WebP at 1440 it was 2.8 MB, over the budget. No 2560 px files: they would triple the set.

## Suggestions for the slider

- **First paint.** Render photo 1 as a `<picture>` with AVIF then WebP `srcSet`, `sizes="100vw"`, `fetchPriority="high"`, `loading="eager"`, and put `placeholder` as its background (or `dominantColour`). Preload only photo 1; load the others after the page is idle.
- **Timing.** Hold each photo about 7 s, cross-fade over the `settle` token (500 ms) or longer, 1.2 s, with `ease-in-out`; a slow scale from 1 to 1.04 (Ken Burns) is optional.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` show photo 1 only, with no timer; give the slider no controls that the page needs.
- **Accessibility.** The photographs are decoration behind the motto: use `alt=""` on the slides, or the Farsi `alt` from `credits.json` on photo 1 only. Pause on hover and focus if the text on top is interactive.
- **Crops.** All are 16:9. On a 200 px phone band use `object-position` toward the subject: `right` for photos 1, 3 and 4, `center` for the rest.
- **Credits.** Show the CC BY credit (photo 5) in the footer or an «اعتبار تصاویر» page; list the rest too.
