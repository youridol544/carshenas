# ADR-0010: Store the listing photos the crawler may download in ArvanCloud Object Storage

- Status: superseded by ADR-0025 (2026-09-30): photos are shown from the source's own addresses and never downloaded or stored
- Date: 2026-09-27 (decided by the owner on 2026-09-27)
- Deciders: Pedrum
- Related: ADR-0007 (the data stack), ADR-0008 (point 4, point 7, point 8), ADR-0017 (point 10: what the live pages show), tasks CS-5, CS-6, CS-11, CS-16, CS-17, CS-23, CS-28, CS-29

## Context

On 2026-09-26 the owner chose to hotlink listing photos and never store them. The crawler, however, has to download photos anyway where a source allows it: duplicate detection compares photos (image embeddings in ADR-0007, CS-11) and extraction may read them (CS-8). Hotlinking also leaves the pages at the mercy of each source's hosts, and a removed ad breaks its photo. On 2026-09-27 the owner decided: "when we download it, so let's use it to store. i want to store in arvan storage." ArvanCloud Object Storage runs inside Iran and speaks the S3 API: rclone's S3 provider documentation (https://rclone.org/s3/, read on 2026-09-27) lists "Arvan Cloud Object Storage (AOS)" with two endpoints, `s3.ir-thr-at1.arvanstorage.ir` (Tehran, Simin) and `s3.ir-tbz-sh1.arvanstorage.ir` (Tabriz, Shahriar). ArvanCloud's own documentation (docs.arvancloud.ir/en/object-storage/) gives the same endpoints in search results, but its pages could not be fetched from here (a redirect loop), so CS-29 confirms the details in the ArvanCloud panel.

## Decision

Where a source's robots.txt and recorded terms (CS-5) allow downloading and showing its photos, the crawler downloads them within ADR-0008's politeness limits, and the photos are stored in an ArvanCloud Object Storage bucket, keyed by source and listing, with the source URL, fetch time and content hash recorded. The results and listing pages show these stored copies; they no longer hotlink the source. A source that does not allow it contributes no photos: its listings show the same-size placeholder and a link out. The storage credentials live in the environment only. A photo that shows a seller's phone number or a licence plate is neither shown nor kept as downloaded: the stored copy has them masked, or the photo is dropped (ADR-0008 point 7). A source's removal request deletes its stored photos too (point 8), and what happens to the photos of an ad the source has removed is decided with the owner in CS-29.

## Alternatives considered

- **Hotlink, never store** (the decision of 2026-09-26): nothing kept on our side, but the pages depend on each source's hosts, removed ads break their photos, and the crawler downloads the photos for duplicate detection anyway.
- **Another object store** (AWS S3, Cloudflare R2): sanctioned or unreliable from inside Iran (AGENTS.md: services must work from inside Iran).
- **Photos on the web server's disk**: ties storage to one machine and one deploy; object storage serves them independently of the app.

## Consequences

- Positive: photos no longer depend on each source's hosts, load from inside Iran, and are the same files duplicate detection and extraction use.
- Negative / risks: we now re-host sources' photos, so each source's terms must allow it (CS-5 records them); photos can carry personal data, which must be detected and masked before a photo is stored or shown, and a detection model needs a labelled evaluation set like every AI step; keeping a removed ad's photos may conflict with the seller's expectations; storage has a cost; the bucket's credentials are one more secret.
- Follow-ups: CS-29 builds the pipeline and decides how photos are resized (stored variants served as-is, keeping `images.unoptimized`, or Next.js's optimizer reading from the bucket), how phone numbers and plates are masked, and, with the owner, what happens to a removed ad's photos; CS-16 and CS-17 show the stored photos; CS-5 records each source's stance on downloading and re-hosting photos; CS-23 chooses hosting with the bucket's region in mind.
