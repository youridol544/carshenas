-- migrate:up
-- How far discovery has read each feed (CS-33 criterion 1; ADR-0017 point 3). A feed is a newest-first list the
-- crawler reads in rounds, such as Divar's list of every tracked model. A round reads down to the newest sort time
-- the previous round read through, so a listing that was bumped or promoted back to the top never ends a round early,
-- and a round starts at most once in ten minutes whatever the schedule queued. Operational state the worker rewrites
-- every round, like crawl_lane; the requests themselves are in fetch_log.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE crawl_feed (
  source_id        text NOT NULL,
  feed_key         text NOT NULL
                   CONSTRAINT crawl_feed_feed_key_format CHECK (feed_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  read_through_at  timestamptz,
  round_started_at timestamptz,
  CONSTRAINT crawl_feed_pkey PRIMARY KEY (source_id, feed_key),
  CONSTRAINT crawl_feed_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE CASCADE
);

COMMENT ON TABLE crawl_feed IS
  'How far discovery has read each newest-first feed of a source (ADR-0017 point 3): a round reads down to read_through_at. Written by the worker every round.';
COMMENT ON COLUMN crawl_feed.feed_key IS 'Names the feed within its source, for example tracked_models.';
COMMENT ON COLUMN crawl_feed.read_through_at IS
  'The newest sort time, by the source''s own clock, down from which a finished round read the whole feed; null before the first round finishes. Rows sorted after it are new or were moved up since.';
COMMENT ON COLUMN crawl_feed.round_started_at IS
  'When the latest round started; a new round starts only ten minutes or more after it.';

GRANT SELECT, INSERT, UPDATE ON crawl_feed TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE crawl_feed;
