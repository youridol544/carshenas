# ADR-0025: Show listing photos from the source's own addresses, and keep only those addresses

- Status: accepted on 2026-09-30. The owner gave the decision, and answered point 5 when asked (show photos as the source shows them, for the demo); the other details were decided on the recommendation. Supersedes ADR-0010. Changes ADR-0008 point 4 (listings show the source's photos instead of a placeholder; the crawler still downloads none) and the photo clause of ADR-0017 point 10.
- Date: 2026-09-30
- Deciders: Pedrum
- Related: ADR-0008 (points 4, 5, 7 and 8), ADR-0010 (superseded), ADR-0017 (point 10); tasks CS-34 (which stores the addresses), CS-55, CS-60, CS-61, CS-64; `docs/design/data-model.md` (`listing_photo`)

## Context

- **What ADR-0010 left.** ADR-0010 (2026-09-27) downloaded a listing's photos and kept copies in ArvanCloud, only where a source's terms allow it. None of the five sources' terms does (CS-5), so under it no listing would show a photo: ADR-0008 point 4 gave every listing a placeholder and a link out, and CS-60 was to put the question to the owner.
- **The owner's decision (2026-09-30).** "We want images of listings too if available to be persisted, so we dont store them and open them in app from the image url provided." Hotlinking was also the owner's first choice, on 2026-09-26.
- **What the snapshots already hold.** Since CS-33 every Divar snapshot keeps each photo's full-size and thumbnail address, in Divar's order: static `https://s100.divarcdn.com/static/photo/…` paths with no expiry parameters. In a survey of 4,720 Divar car listings of 2026-09-17, a listing had 1 to 21 photos.

## Decision

1. **Addresses, not files.**
   - The crawler never downloads a listing photo.
   - Each listing's photo addresses are derived from its latest snapshot into `listing_photo` (CS-34): the position in the source's order, the full-size URL and the thumbnail URL. They are re-derived with the listing's other attributes.
   - Nothing is kept in ArvanCloud, and ADR-0010's bucket is not created.
2. **Only the source's own photo host, over https.**
   - An address is kept only when it uses https and points at the host the source serves its photos from. For Divar that is `divarcdn.com` and its subdomains, under `/static/photo/`. Anything else is skipped and counted.
   - The database refuses any address that is not https.
   - So a page never loads a third party's image or mixed content.
3. **Pages load each photo from its address.**
   - An image element, `next/image` included as long as it renders the address unchanged: the thumbnail on result cards, the full size on the listing page.
   - `referrerpolicy="no-referrer"`, so the source does not learn which of our pages showed a photo, and a referrer check has nothing to refuse.
   - Lazy loading below the fold, and a fixed aspect ratio, so nothing shifts when a photo arrives.
   - The same-size placeholder when a listing has no photo or a photo does not load.
   - Never through Next.js's image optimizer, which would download a copy and keep it on our server: `images.unoptimized` stays.
   - When the site gets a Content-Security-Policy, its `img-src` names the sources' photo hosts.
4. **Pages show what the source still shows.** When a seller or the source removes a photo or a listing, its address stops answering and the placeholder takes its place. We keep no copy to outlive it. Whether a listing that has left the market still shows its photos is CS-64's to decide.
5. **Personal data in photos.** A photo can show a licence plate or a phone number. What is never downloaded can be neither checked nor masked, so a photo is shown exactly as the source shows it. The owner accepts this for the demo. A removal request (ADR-0008 point 8) purges the listing, its photo rows included.
6. **Duplicate detection** by perceptual hash (ADR-0007, CS-55) needs the files. CS-55 decides whether a download that keeps only the hash is worth its requests to the photo host, which ADR-0008 point 5 paces like any request to a source.
7. **`source_policy_check.photos_allowed`** keeps recording whether a source's terms allow re-hosting. It does not gate showing photos by address: sources' terms are recorded, not followed, for the demo (ADR-0008 point 3).

## Alternatives considered

- **Copies in ArvanCloud (ADR-0010).** Allowed by no source's terms, so no photos at all. It also needs storage, a masking model with its own evaluation set, and one more secret.
- **No photos: a drawing of the body type in the listed colour, and the photo count as a link out.** This was CS-60's recommendation of 2026-09-28. It is the safest, but the owner wants the photos.
- **Our server fetches each photo when a page asks for it, and keeps nothing.** This would hide our visitors from the source. But every page view would become a request from our Iranian address to the source, outside ADR-0008's pace and daily budget, and any cache would be storage.
- **Next.js's optimizer with `remotePatterns`.** It resizes and caches copies on our server (storage) and makes the same requests.

## Consequences

- **Positive:**
  - Every listing that has photos shows them from its first crawl, at no storage or bandwidth cost.
  - There is nothing to delete but rows, and no bucket credential.
  - A photo the seller removes disappears from our pages too.
- **Negative and risks:**
  - Pages depend on the source's photo host. When it is slow or down, placeholders show. When it moves, photos are skipped until the parser learns the new host (the derive report counts them).
  - Our visitors' browsers contact the source's host, which sees their addresses (not our page, with no referrer).
  - Photos that show plates or numbers appear unmasked.
  - Showing Divar's photos is a visible use of content its terms forbid republishing (article 7), which widens ADR-0008's accepted risk.
- **Follow-ups:**
  - CS-34: `listing_photo` and its derivation.
  - CS-61 and CS-64: show the photos, and grant the web role SELECT on `listing_photo`.
  - CS-60: its question is answered; re-scope it or archive it.
  - CS-55: whether photo hashes are worth their requests.
