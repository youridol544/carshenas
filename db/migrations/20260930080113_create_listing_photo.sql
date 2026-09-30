-- migrate:up
-- A listing's photos, kept as addresses on its source's own photo host, never as files (ADR-0025, the owner's decision
-- of 2026-09-30; CS-34): pages load each photo from its address. The parser derives the rows from the listing's latest
-- snapshot, in the source's order, and rewrites them with the listing's other attributes, so they are rebuildable. The
-- parser keeps only addresses on the source's own photo host; the database refuses any that is not https, so a page
-- never loads mixed content. A purge of the listing removes its photos.
-- source_policy_check.photos_allowed still cited ADR-0010 (20260927060002): its comment is restated.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE listing_photo (
  listing_id    bigint NOT NULL,
  -- bigint because key columns are bigint, text or uuid (schema-catalog.test.ts); a listing has a few dozen at most.
  position      bigint NOT NULL
                CONSTRAINT listing_photo_position_positive CHECK (position >= 1),
  url           text NOT NULL
                CONSTRAINT listing_photo_url_https CHECK (url ~ '^https://'),
  thumbnail_url text
                CONSTRAINT listing_photo_thumbnail_url_https CHECK (thumbnail_url ~ '^https://'),
  CONSTRAINT listing_photo_pkey PRIMARY KEY (listing_id, position),
  CONSTRAINT listing_photo_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE
);

COMMENT ON TABLE listing_photo IS
  'A listing''s photos as addresses on its source''s own photo host, in the source''s order (ADR-0025): derived from its latest snapshot, never downloaded or stored.';
COMMENT ON COLUMN listing_photo.position IS 'The photo''s place in the source''s order, from 1: the first is the listing''s main photo.';
COMMENT ON COLUMN listing_photo.url IS 'The full-size photo''s address on the source''s photo host, which pages load it from.';
COMMENT ON COLUMN listing_photo.thumbnail_url IS 'The source''s own small version of the same photo, for result cards; null when the source gives none.';

COMMENT ON COLUMN source_policy_check.photos_allowed IS
  'Whether this source''s terms allow downloading and re-hosting its photos, as read. Nothing is downloaded or re-hosted (ADR-0025), so it does not decide whether pages show a source''s photos from their addresses.';

-- The worker derives the rows; pages read them once a task shows photos (CS-61, CS-64) and grants it then.
GRANT SELECT, INSERT, UPDATE, DELETE ON listing_photo TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

COMMENT ON COLUMN source_policy_check.photos_allowed IS 'Whether this source''s rules allow downloading and re-hosting its photos (ADR-0010).';
DROP TABLE listing_photo;
