# ADR-0038: A model's photo is an https address the superadmin gives, shown from its own host and never stored

- Status: accepted by delegation (2026-10-03; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-03
- Deciders: Pedrum (delegated to the CS-53 lane, for CS-97)
- Related: CS-97, CS-67, CS-57; ADR-0023, ADR-0025, ADR-0032

## Context

The home page's popular-models tiles and the models index (CS-67) show the body type's sample photograph, so a Peugeot Pars shows an unrelated sedan. On 2026-10-03 the owner asked that the superadmin can give each top model an external image link, with the body type's photo as the fallback.

## Decision

1. **One row per model, `model_photo_link`**: an address, who set it and when; clearing deletes the row. Every set, replacement and clearing is appended to `model_photo_link_change` (append-only, outlives the row). The superadmin's role cannot write either; `set_model_photo_link()` (SECURITY DEFINER, ADR-0023) checks the role, applies the table's checks and records who.
2. **The database states what an address is**, by named checks: https only, 12 to 500 characters, one line of plain characters (no whitespace, controls, bidi or zero-width characters, quotes, angle brackets, backslash or backtick), a dotted host (no credentials, no bare name, no IP address, no internal suffix). The web form states the same rules in `lib/model-photo-link-rules.ts`, tested against the same addresses. Whether the address is an *image* is not decidable without fetching it, and the app never fetches: the superadmin confirms it in a live preview that this browser loads itself, and the form saves only once the preview has loaded.
3. **The page shows it from its own host**: a remote `<img>` with `referrerPolicy="no-referrer"`, in the same 4:3 frame as the sample, never downloaded, stored or proxied (ADR-0025's spirit). A photo that fails to load, including one that failed before the script ran, is replaced by the sample photograph; both fill one frame, so the tile does not change size. The «عکس نمونه» label is on the sample only.
4. **The web role reads the address through a column grant** (`model_id`, `url`), nothing about who set it. The tiles' two reads (`readPopularModels`, `readModelIndex`) join it and carry the cache tag `model-photos`, which the action drops (`updateTag`), so a change shows at once.
5. **The screen lists the popular models** (the ranking the tiles use), those on the home row marked, with the editor, who set each link and when.

## Alternatives considered

- **Upload or proxy the images**: stored copies of third-party photographs, with licence and storage questions the owner has avoided; the link keeps the host responsible.
- **Check the address by fetching it on save**: a request from our server to an arbitrary host (an SSRF surface, and the owner's rule that nothing is requested from sites in this period); the browser preview shows the same truth.
- **A column on `model`**: mixes a curated display choice into the shared catalogue and loses the change record.
- **Require an image file extension**: many image hosts have none, and a wrong extension proves nothing.

## Consequences

- A link rots silently; the tile falls back, and the screen shows a saved link that no longer loads as such in its preview.
- The hosts' own terms for hot-linking are the superadmin's to judge; the preview with no referrer is what visitors get.
- Follow-ups: the model page's hero could use the same photo.
