-- migrate:up
-- A buyer's request to re-read one listing (CS-35 criterion 5, for CS-64's listing page; ADR-0017 points 3 and 8; the
-- owner's decision of 2026-09-30). The web app never touches the job queue (ADR-0018), so it inserts a row here; a
-- worker job drains pending rows every minute into high-priority lane jobs of the listing's source, which go through
-- the same per-host queue, floor and budget as every other request. A listing has at most one pending request (the
-- partial unique index), so opening a page again adds nothing: the web app inserts ON CONFLICT DO NOTHING. A handled
-- row keeps what became of it: queued (a re-check job was sent), fresh (its page was read within the freshness window,
-- so nothing was sent) or off_market (it had already left the market).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE listing_recheck_request (
  id bigint GENERATED ALWAYS AS IDENTITY,
  listing_id bigint NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  outcome text,
  CONSTRAINT listing_recheck_request_pkey PRIMARY KEY (id),
  CONSTRAINT listing_recheck_request_listing_fk
    FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE,
  CONSTRAINT listing_recheck_request_outcome_valid CHECK (outcome IN ('queued', 'fresh', 'off_market')),
  CONSTRAINT listing_recheck_request_handled_with_outcome CHECK ((handled_at IS NULL) = (outcome IS NULL)),
  CONSTRAINT listing_recheck_request_handled_after_request CHECK (handled_at >= requested_at)
);

CREATE INDEX listing_recheck_request_listing_idx ON listing_recheck_request (listing_id, requested_at);
CREATE UNIQUE INDEX listing_recheck_request_pending_unique
  ON listing_recheck_request (listing_id) WHERE handled_at IS NULL;

COMMENT ON TABLE listing_recheck_request IS
  'A buyer''s request to re-read one listing (CS-35, CS-64): inserted by the web app, drained every minute by the worker into a high-priority lane job, at most one pending per listing.';
COMMENT ON COLUMN listing_recheck_request.handled_at IS 'When the worker handled the request; NULL while pending.';
COMMENT ON COLUMN listing_recheck_request.outcome IS
  'What became of it: queued (a re-check job was sent), fresh (the listing''s page was read within the freshness window, six hours) or off_market (the listing had already left the market).';

GRANT INSERT (listing_id) ON listing_recheck_request TO carshenas_web;
GRANT SELECT, UPDATE (handled_at, outcome) ON listing_recheck_request TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE listing_recheck_request;
