-- migrate:up
-- Accounts for buyers and the superadmin: a username and a password, sessions stored as token hashes, sign-in
-- throttling, and an append-only record of role grants (CS-39, ADR-0020; ADR-0013 point 2: anything whose possession
-- grants access is stored hashed). The web role can create buyers and never touch a role: a superadmin is made only by
-- `pnpm account:superadmin`, which runs as the migration role.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE account (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text NOT NULL
                CONSTRAINT account_username_format CHECK (username ~ '^[a-z][a-z0-9_]{2,29}$'),
  password_hash text NOT NULL
                CONSTRAINT account_password_hash_argon2id CHECK (starts_with(password_hash, '$argon2id$v=19$')),
  role          text NOT NULL DEFAULT 'buyer'
                CONSTRAINT account_role_valid CHECK (role IN ('buyer', 'superadmin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_username_unique UNIQUE (username)
);

COMMENT ON TABLE account IS
  'A person who signs in to Carshenas with a username and a password (ADR-0020): a buyer, or the superadmin.';
COMMENT ON COLUMN account.username IS
  'Lowercase Latin letters, digits and underscore, 3 to 30 characters, starting with a letter; normalised before it is stored (capitals lowered, Persian digits made Latin). Never logged: people type passwords into it by mistake.';
COMMENT ON COLUMN account.password_hash IS
  'Argon2id as a PHC string (ADR-0020 point 4). Never the password itself; the read-only role cannot read it.';
COMMENT ON COLUMN account.role IS
  'buyer by default; superadmin only through pnpm account:superadmin, recorded in account_role_change. The web role reads it and can never write it.';

CREATE TABLE account_session (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id   bigint NOT NULL,
  token_sha256 bytea NOT NULL
               CONSTRAINT account_session_token_sha256_length CHECK (octet_length(token_sha256) = 32),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  CONSTRAINT account_session_account_fk FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE,
  CONSTRAINT account_session_token_sha256_unique UNIQUE (token_sha256),
  -- A session ends after it starts and within a buyer's 30 days (ADR-0020 point 5), so no bug can mint one that never
  -- expires. Hours, not days: adding days to a timestamptz depends on the session's time zone.
  CONSTRAINT account_session_lifetime_bounded CHECK (
    expires_at > created_at AND expires_at <= created_at + interval '720 hours')
);

-- Serves the foreign key, and signing out everywhere or on a role or password change.
CREATE INDEX account_session_account_idx ON account_session (account_id);

COMMENT ON TABLE account_session IS
  'A signed-in browser (ADR-0020 point 5). The cookie holds a random 32-byte token; only its SHA-256 is kept here, so a copy of this table signs nobody in.';
COMMENT ON COLUMN account_session.expires_at IS
  'Fixed at sign-in: 30 days for a buyer, 12 hours for the superadmin. Never extended; sign-out deletes the row.';

CREATE TABLE auth_throttle (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope             text NOT NULL
                    CONSTRAINT auth_throttle_scope_valid CHECK (scope IN (
                      'sign_in_account', 'sign_in_device', 'sign_in_address', 'sign_up_address', 'username_check_address')),
  subject_hmac      bytea NOT NULL
                    CONSTRAINT auth_throttle_subject_hmac_length CHECK (octet_length(subject_hmac) = 32),
  hits              integer NOT NULL DEFAULT 0
                    CONSTRAINT auth_throttle_hits_nonnegative CHECK (hits >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_throttle_subject_unique UNIQUE (scope, subject_hmac)
);

COMMENT ON TABLE auth_throttle IS
  'Counters that slow down password guessing and username enumeration (ADR-0020 point 8), one row per scope and subject. Holds no username or address: the subject is a keyed hash.';
COMMENT ON COLUMN auth_throttle.subject_hmac IS
  'HMAC-SHA-256, under CARSHENAS_AUTH_KEY, of the typed username (whether or not the account exists), a device token or the client address.';
COMMENT ON COLUMN auth_throttle.hits IS
  'Consecutive failed sign-ins for sign_in_account and sign_in_device; failed sign-ins, sign-up attempts or username checks within the window for the address scopes.';
COMMENT ON COLUMN auth_throttle.window_started_at IS
  'When the counted streak or window began.';
COMMENT ON COLUMN auth_throttle.next_attempt_at IS
  'For sign_in_account and sign_in_device, the earliest time the next attempt may start: a growing wait after repeated failures, or a 15-second lease while one attempt is being checked. The address scopes leave it at its default; their wait ends an hour after window_started_at.';

CREATE TABLE account_role_change (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL,
  from_role  text
             CONSTRAINT account_role_change_from_role_valid CHECK (from_role IN ('buyer', 'superadmin')),
  to_role    text NOT NULL
             CONSTRAINT account_role_change_to_role_valid CHECK (to_role IN ('buyer', 'superadmin')),
  changed_by text NOT NULL
             CONSTRAINT account_role_change_changed_by_not_blank CHECK (btrim(changed_by) <> ''),
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_role_change_account_fk FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE,
  CONSTRAINT account_role_change_is_change CHECK (from_role IS DISTINCT FROM to_role)
);

-- Serves the foreign key and an account's history in order.
CREATE INDEX account_role_change_account_idx ON account_role_change (account_id, changed_at);

CREATE TRIGGER account_role_change_append_only
  BEFORE UPDATE OR DELETE ON account_role_change
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER account_role_change_append_only_truncate
  BEFORE TRUNCATE ON account_role_change
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE account_role_change IS
  'Append-only record of every role an account was given, written by pnpm account:superadmin in the same transaction as the change (ADR-0020 point 9).';
COMMENT ON COLUMN account_role_change.from_role IS 'NULL when the account was created with to_role.';
COMMENT ON COLUMN account_role_change.changed_by IS
  'Who ran the command: the operating-system user and host, for example cli:pedram@carshenas-1.';

-- The web app reads accounts, creates buyers and replaces a password's hash (a rehash after sign-in); it has no
-- privilege on role, so the product cannot make a superadmin even through a bug. It keeps its own sessions and
-- throttle counters, and never sees the role history.
GRANT SELECT ON account TO carshenas_web;
GRANT INSERT (username, password_hash) ON account TO carshenas_web;
GRANT UPDATE (password_hash) ON account TO carshenas_web;
-- A session is written with its token hash and its end, never its start: created_at stays the database's own clock,
-- which the lifetime CHECK measures from.
GRANT SELECT, DELETE ON account_session TO carshenas_web;
GRANT INSERT (account_id, token_sha256, expires_at) ON account_session TO carshenas_web;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_throttle TO carshenas_web;

-- People and agents inspecting data read accounts without their password hashes.
REVOKE SELECT ON account FROM carshenas_readonly;
GRANT SELECT (id, username, role, created_at) ON account TO carshenas_readonly;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DROP TABLE account_role_change;
DROP TABLE auth_throttle;
DROP TABLE account_session;
DROP TABLE account;
