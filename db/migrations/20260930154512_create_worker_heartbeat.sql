-- migrate:up
-- Whether the worker is alive (CS-41 criterion 1, the owner's decision of 2026-09-30): each worker process writes one
-- row when it starts, stamps it every 15 seconds from the database's clock, and marks it stopped when it shuts down
-- cleanly. The superadmin section shows a worker as down when no running process has beaten within 45 seconds, so a
-- stopped or stuck worker shows as down within a minute. The rows are the worker's own state, not observations: it
-- updates them in place and deletes the ones older than a week when it starts.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE worker_heartbeat (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instance_id uuid NOT NULL CONSTRAINT worker_heartbeat_instance_unique UNIQUE,
  hostname    text NOT NULL
              CONSTRAINT worker_heartbeat_hostname_format
              CHECK (btrim(hostname) <> '' AND char_length(hostname) <= 255),
  pid         integer NOT NULL CONSTRAINT worker_heartbeat_pid_positive CHECK (pid > 0),
  version     text NOT NULL
              CONSTRAINT worker_heartbeat_version_format
              CHECK (btrim(version) <> '' AND char_length(version) <= 200),
  started_at  timestamptz NOT NULL,
  beat_at     timestamptz NOT NULL,
  stopped_at  timestamptz,
  CONSTRAINT worker_heartbeat_beat_after_start CHECK (beat_at >= started_at),
  CONSTRAINT worker_heartbeat_stop_after_start CHECK (stopped_at >= started_at)
);

-- The section reads the latest beats; a week of restarts is a few rows, so no index beyond the keys.

COMMENT ON TABLE worker_heartbeat IS
  'One row per worker process (CS-41): written when it starts, stamped every 15 s, marked stopped on a clean shutdown; rows older than a week are deleted by the next start. The superadmin section shows the worker as down when no running process beat within 45 s.';
COMMENT ON COLUMN worker_heartbeat.instance_id IS 'Chosen by the process when it starts; names it in the section.';
COMMENT ON COLUMN worker_heartbeat.version IS 'The release the process runs: CARSHENAS_RELEASE, or the commit.';
COMMENT ON COLUMN worker_heartbeat.started_at IS 'When the process started, by the database''s clock.';
COMMENT ON COLUMN worker_heartbeat.beat_at IS
  'The last beat, by the database''s clock (now() of the beat), so a server''s drifting clock cannot fake one.';
COMMENT ON COLUMN worker_heartbeat.stopped_at IS
  'When the process shut down cleanly; null while it runs or when it died without saying so.';

GRANT SELECT, INSERT, UPDATE, DELETE ON worker_heartbeat TO carshenas_worker;
GRANT SELECT ON worker_heartbeat TO carshenas_admin;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE worker_heartbeat;
