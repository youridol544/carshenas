-- migrate:up
-- Search files (CS-70, ADR-0030): a buyer hands a search to Karshenas, which keeps it. The table holds the search in
-- its stored form (@carshenas/search's StoredSearch, ADR-0027), so a file finds exactly what the search page shows; its
-- matches are never stored here, they are read from search_document with searchableWhere() when shown (the page, and
-- later CS-72's matching job). A file takes over layer 8's planned saved_search for accounts; a Telegram chat's
-- delivery (CS-76) will refer to a file. The state, the name and the time the buyer last looked are the buyer's to
-- change; the search itself is fixed when the file is made (a different search is a different file).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE search_file (
  id                bigint GENERATED ALWAYS AS IDENTITY,
  account_id        bigint NOT NULL,
  name              text NOT NULL
                    CONSTRAINT search_file_name_format
                    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80),
  search            jsonb NOT NULL
                    CONSTRAINT search_file_search_stored_form
                    -- coalesce: a missing key is NULL, and a CHECK passes on NULL.
                    CHECK (coalesce(jsonb_typeof(search) = 'object' AND search -> 'v' = '1'::jsonb
                                    AND jsonb_typeof(search -> 'filters') = 'object', false))
                    -- Facts, not documents; also keeps the unique index below under its 2,704-byte row limit.
                    CONSTRAINT search_file_search_small CHECK (octet_length(search::text) <= 2048),
  status            text NOT NULL DEFAULT 'watching'
                    CONSTRAINT search_file_status_valid CHECK (status IN ('watching', 'paused', 'closed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  viewed_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_file_pkey PRIMARY KEY (id),
  CONSTRAINT search_file_account_fk FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE,
  -- The same search is one file: saving it again finds the file instead of making a second (the app inserts and
  -- maps this violation, never checks first). Also the account's foreign-key index and the account's file list.
  CONSTRAINT search_file_once_per_search_unique UNIQUE (account_id, search),
  CONSTRAINT search_file_status_changed_after_created CHECK (status_changed_at >= created_at)
);

COMMENT ON TABLE search_file IS
  'A search a buyer handed to Karshenas (CS-70, ADR-0030): the search in its stored form, a name, a state (watching, paused, closed) and when the buyer last looked. Matches are never stored: they are read from search_document with searchableWhere(), as the search page reads them.';
COMMENT ON COLUMN search_file.name IS
  'What the buyer calls the file: suggested from the search («پژو ۲۰۶ تیپ ۵ تا ۷۰۰ میلیون»), changed by the buyer. Trimmed, 1 to 80 characters. Not unique: the search is.';
COMMENT ON COLUMN search_file.search IS
  'The search as @carshenas/search stores it (StoredSearch, ADR-0027): {"v": 1, "q"?, "filters": {…}, "sort"?, "catalogue"?}, canonical, a catalogue always expanded to its filters, so two equal searches are equal jsonb. Read it back with fromStoredSearch(), which checks it against the filters of the build that reads it; a row that no longer fits is shown as such, never guessed. Fixed once written: a changed search is a new file. CS-71 reads the make, model and trim keys from filters.make, filters.model and filters.trim.';
COMMENT ON COLUMN search_file.status IS
  'watching: Karshenas keeps looking and tells the buyer what is new (CS-72); paused: kept, not watched; closed: the buyer found a car or no longer wants it, kept to look back on. The buyer moves it between the three freely.';
COMMENT ON COLUMN search_file.status_changed_at IS 'When the state last changed (the creation time at first).';
COMMENT ON COLUMN search_file.viewed_at IS
  'When the buyer last opened the file''s page: a match Carshenas first saw after this instant (listing.created_at) is new to the buyer. The creation time at first, so what the search showed when it was saved is not new.';

-- The buyer's own file list, the state tabs and the superadmin's list, newest first, read the table whole: it is small
-- (at most 30 files an account, limit_search_files_per_account) and is read by account, which the unique index serves.

-- The web app keeps its buyer's files: it makes one (the state starts as watching), renames it, moves it between the
-- states, records a look and deletes it. The search and the owner cannot be changed afterwards.
GRANT SELECT, DELETE ON search_file TO carshenas_web;
GRANT INSERT (account_id, name, search) ON search_file TO carshenas_web;
GRANT UPDATE (name, status, status_changed_at, viewed_at) ON search_file TO carshenas_web;
-- The matching job (CS-72) and the superadmin's list (CS-70, CS-71) read the files; neither writes one.
GRANT SELECT ON search_file TO carshenas_worker, carshenas_admin;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE search_file;
