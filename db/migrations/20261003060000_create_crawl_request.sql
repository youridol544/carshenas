-- migrate:up
-- Crawl requests (CS-71, ADR-0032): a buyer whose search file asks for a car Carshenas does not read in depth asks the
-- superadmin for a deeper crawl of that model (or trim). One request per catalogue scope, whoever asks: the second buyer
-- is linked to the first one's request by the unique key, never by a read before the insert. The request is a queue
-- entry, not a crawl: an approval records who approved it and when, and what reads it (CS-53's tracked models, under
-- ADR-0017's request budget) starts only when the crawl runs; while a source is paused, nothing is sent anywhere.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE crawl_request (
  id                    bigint GENERATED ALWAYS AS IDENTITY,
  model_id              bigint NOT NULL,
  -- NULL: the whole model; a trim: only that trim (the composite key below keeps it under its own model).
  trim_id               bigint,
  state                 text NOT NULL DEFAULT 'pending'
                        CONSTRAINT crawl_request_state_valid
                        CHECK (state IN ('pending', 'approved', 'declined', 'fulfilled')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  decided_by_account_id bigint,
  decided_at            timestamptz,
  decline_reason        text
                        CONSTRAINT crawl_request_decline_reason_format
                        CHECK (decline_reason = btrim(decline_reason) AND char_length(decline_reason) BETWEEN 1 AND 300)
                        CONSTRAINT crawl_request_decline_reason_plain
                        CHECK (decline_reason !~ '[\u0000-\u001f\u007f-\u009f­؜​‎‏  ‪-‮⁠⁦-⁩﻿]'),
  fulfilled_at          timestamptz,
  CONSTRAINT crawl_request_pkey PRIMARY KEY (id),
  CONSTRAINT crawl_request_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT crawl_request_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT crawl_request_decider_fk
    FOREIGN KEY (decided_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  -- One request per scope: the model, or one of its trims. NULLS NOT DISTINCT makes the whole-model scope one too.
  -- Also the index of model_id's foreign key and the lookup of a scope's request.
  CONSTRAINT crawl_request_once_per_scope_unique UNIQUE NULLS NOT DISTINCT (model_id, trim_id),
  -- Every state says exactly what it knows: a pending request has no decision, a decision has its person and time, a
  -- decline its reason, and only a fulfilled request (the crawl read it) has its time. IS [NOT] NULL is spelled out
  -- everywhere, because a CHECK passes when its expression is NULL.
  CONSTRAINT crawl_request_state_matches_decision CHECK (
    CASE state
      WHEN 'pending' THEN decided_by_account_id IS NULL AND decided_at IS NULL
                          AND decline_reason IS NULL AND fulfilled_at IS NULL
      WHEN 'approved' THEN decided_by_account_id IS NOT NULL AND decided_at IS NOT NULL
                           AND decline_reason IS NULL AND fulfilled_at IS NULL
      WHEN 'declined' THEN decided_by_account_id IS NOT NULL AND decided_at IS NOT NULL
                           AND decline_reason IS NOT NULL AND fulfilled_at IS NULL
      ELSE decided_by_account_id IS NOT NULL AND decided_at IS NOT NULL
           AND decline_reason IS NULL AND fulfilled_at IS NOT NULL
    END),
  CONSTRAINT crawl_request_decided_after_created CHECK (decided_at >= created_at),
  CONSTRAINT crawl_request_fulfilled_after_decided CHECK (fulfilled_at >= decided_at)
);

-- The superadmin's list, filtered by state, newest first.
CREATE INDEX crawl_request_state_idx ON crawl_request (state, created_at DESC, id DESC);
-- Serves the foreign key of the person who decided.
CREATE INDEX crawl_request_decider_idx ON crawl_request (decided_by_account_id)
  WHERE decided_by_account_id IS NOT NULL;

COMMENT ON CONSTRAINT crawl_request_trim_fk ON crawl_request IS
  'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); a request is read by its scope, which the unique key serves.';
COMMENT ON TABLE crawl_request IS
  'A deeper crawl of one catalogue model, or one of its trims, that search files asked the superadmin for (CS-71, ADR-0032). One row per scope; the files that depend on it are crawl_request_file. pending until the superadmin decides, approved (queued for CS-53''s tracked models; nothing is crawled by the decision itself), declined with a reason, fulfilled once the crawl reads it (set by CS-53, never by a buyer).';
COMMENT ON COLUMN crawl_request.trim_id IS 'NULL asks for the whole model; a trim asks for that trim only.';
COMMENT ON COLUMN crawl_request.decided_by_account_id IS
  'The superadmin who last decided: decide_crawl_request() refuses any other account. Earlier decisions are in crawl_request_decision.';
COMMENT ON COLUMN crawl_request.decided_at IS 'When the last decision took effect (clock_timestamp()).';
COMMENT ON COLUMN crawl_request.decline_reason IS 'Why the request was declined, in the superadmin''s words, shown to the buyers who asked: 1 to 300 characters of plain text.';

-- The search files that depend on a request: the buyers waiting for its answer, and for a file the requests it raised.
CREATE TABLE crawl_request_file (
  crawl_request_id bigint NOT NULL,
  search_file_id   bigint NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crawl_request_file_pkey PRIMARY KEY (crawl_request_id, search_file_id),
  CONSTRAINT crawl_request_file_request_fk
    FOREIGN KEY (crawl_request_id) REFERENCES crawl_request (id) ON DELETE CASCADE,
  CONSTRAINT crawl_request_file_file_fk
    FOREIGN KEY (search_file_id) REFERENCES search_file (id) ON DELETE CASCADE
);

-- A file's requests (its page, its card in the list), and the file's foreign key under a delete of the file.
CREATE INDEX crawl_request_file_file_idx ON crawl_request_file (search_file_id);

COMMENT ON TABLE crawl_request_file IS
  'A search file that asked for a crawl request (CS-71): one row per file and request, made by the buyer''s ask. The buyer of a request is the account of its files; the demand for a model is the number of distinct accounts. A deleted file leaves its request waiting for the others.';

-- Abuse limits that span rows, stated by a trigger under a per-account advisory lock (the database skill): a file
-- asks for at most 3 models or trims, an account has at most 10 requests waiting for an answer, and nobody joins a
-- request the superadmin declined (it is answered; a reconsidered request opens again).
CREATE FUNCTION crawl_request_file_limits() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
  AS $$
DECLARE
  owner_id bigint;
  request_state text;
BEGIN
  SELECT f.account_id INTO owner_id FROM search_file f WHERE f.id = NEW.search_file_id;
  IF owner_id IS NULL THEN
    -- No such file: the foreign key names the violation.
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('crawl_request_file:' || owner_id::text, 0));
  SELECT r.state INTO request_state FROM crawl_request r WHERE r.id = NEW.crawl_request_id;
  IF request_state = 'declined' THEN
    RAISE EXCEPTION 'crawl request %: declined, a file cannot join it', NEW.crawl_request_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_request_file_not_declined', TABLE = TG_TABLE_NAME;
  END IF;
  IF (SELECT count(*) FROM crawl_request_file l WHERE l.search_file_id = NEW.search_file_id) >= 3 THEN
    RAISE EXCEPTION 'search file %: at most 3 crawl requests', NEW.search_file_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_request_per_file_limit', TABLE = TG_TABLE_NAME;
  END IF;
  IF request_state = 'pending'
     AND (SELECT count(*)
          FROM crawl_request_file l
          JOIN search_file f ON f.id = l.search_file_id
          JOIN crawl_request r ON r.id = l.crawl_request_id
          WHERE f.account_id = owner_id AND r.state = 'pending') >= 10 THEN
    RAISE EXCEPTION 'account %: at most 10 crawl requests waiting for an answer', owner_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_request_per_account_limit', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END
$$;

COMMENT ON FUNCTION crawl_request_file_limits() IS
  'Refuses, with check_violation and a constraint name the app maps to a Farsi message: joining a declined request (crawl_request_file_not_declined), a 4th request on one file (crawl_request_per_file_limit) and an 11th pending request of one account (crawl_request_per_account_limit). Locks the account first, so concurrent asks are counted in turn. The numbers are in apps/web/src/features/crawl-requests/crawl-requests-rules.ts; a test fails when they differ.';

REVOKE EXECUTE ON FUNCTION crawl_request_file_limits() FROM PUBLIC;

CREATE TRIGGER crawl_request_file_limits
  BEFORE INSERT ON crawl_request_file
  FOR EACH ROW EXECUTE FUNCTION crawl_request_file_limits();

-- Every decision on a request, append-only: who, what and when, so a request that was declined and then approved keeps
-- both (ADR-0023: a person changes a curated row only through a function that records who).
CREATE TABLE crawl_request_decision (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crawl_request_id      bigint NOT NULL,
  decision              text NOT NULL
                        CONSTRAINT crawl_request_decision_valid CHECK (decision IN ('approved', 'declined')),
  from_state            text NOT NULL
                        CONSTRAINT crawl_request_decision_from_state_valid
                        CHECK (from_state IN ('pending', 'approved', 'declined')),
  reason                text
                        CONSTRAINT crawl_request_decision_reason_format
                        CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 300),
  decided_by_account_id bigint NOT NULL,
  decided_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crawl_request_decision_request_fk
    FOREIGN KEY (crawl_request_id) REFERENCES crawl_request (id) ON DELETE CASCADE,
  CONSTRAINT crawl_request_decision_decider_fk
    FOREIGN KEY (decided_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  CONSTRAINT crawl_request_decision_is_change CHECK (decision <> from_state),
  CONSTRAINT crawl_request_decision_reason_iff_declined CHECK ((decision = 'declined') = (reason IS NOT NULL))
);

-- A request's decisions, newest first; also the request's foreign key.
CREATE INDEX crawl_request_decision_request_idx ON crawl_request_decision (crawl_request_id, decided_at DESC, id DESC);
CREATE INDEX crawl_request_decision_decider_idx ON crawl_request_decision (decided_by_account_id);

CREATE TRIGGER crawl_request_decision_append_only
  BEFORE UPDATE OR DELETE ON crawl_request_decision
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER crawl_request_decision_append_only_truncate
  BEFORE TRUNCATE ON crawl_request_decision
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE crawl_request_decision IS
  'Append-only record of every approval and decline of a crawl request (CS-71, ADR-0023), written by decide_crawl_request() in the transaction that changes the request.';

-- The web app makes requests for its buyer's files: it makes the request of a scope when none exists (the state starts
-- as pending), and links the file. It reads them to show the file's answer; it never changes or deletes a request, and
-- cannot link a file it does not own (the insert selects from the buyer's own file; nothing else is granted).
GRANT SELECT ON crawl_request, crawl_request_file TO carshenas_web;
GRANT INSERT (model_id, trim_id) ON crawl_request TO carshenas_web;
GRANT INSERT (crawl_request_id, search_file_id) ON crawl_request_file TO carshenas_web;
-- The superadmin reads everything it shows; it changes a request only through decide_crawl_request().
GRANT SELECT ON crawl_request, crawl_request_file, crawl_request_decision TO carshenas_admin;
-- CS-53's worker reads the approved requests it turns into tracked models.
GRANT SELECT ON crawl_request, crawl_request_file TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE crawl_request_decision;
DROP TRIGGER crawl_request_file_limits ON crawl_request_file;
DROP TABLE crawl_request_file;
DROP FUNCTION crawl_request_file_limits();
DROP TABLE crawl_request;
