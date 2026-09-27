-- migrate:up
-- What every later migration relies on (ADR-0011): who may read new tables by default, the helper functions for
-- content-addressed and append-only rows, and read access to the migration history for the health check.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Every table the owner creates is readable by the read-only role. The application roles get privileges table by
-- table, in the migration that creates the table, so a new table is closed to the app until someone decides.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO carshenas_readonly;

-- dbmate creates schema_migrations before the first migration runs; the health check reports its newest version.
GRANT SELECT ON schema_migrations TO carshenas_web, carshenas_readonly;

-- sha256 of a jsonb value's text form, for content-addressed snapshots. jsonb prints keys in one canonical order,
-- so equal documents hash equally. convert_to() is only STABLE because it can convert between encodings; the
-- database is UTF8 (db/bootstrap/create-database.psql), where converting to UTF8 is the identity, so this wrapper
-- is declared IMMUTABLE, which a generated column requires.
CREATE FUNCTION jsonb_sha256(value jsonb) RETURNS bytea
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  RETURN sha256(convert_to(value::text, 'UTF8'));

-- Trigger function for append-only tables: an UPDATE, DELETE or TRUNCATE fails unless the transaction is a purge,
-- which sets carshenas.purge (SET LOCAL carshenas.purge = 'on') to honour a removal request (ADR-0008 point 8). Each
-- such table gets it twice: as a BEFORE UPDATE OR DELETE row trigger and as a BEFORE TRUNCATE statement trigger,
-- because TRUNCATE fires no row triggers. This guards against bugs, not attackers: the roles decide who may write at
-- all. The error carries SQLSTATE 23000 and the constraint name <table>_append_only, so code maps it like any other
-- constraint violation.
CREATE FUNCTION refuse_change_unless_purge() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('carshenas.purge', true), '') = 'on' THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;  -- NULL for TRUNCATE, whose return value is ignored
  END IF;
  RAISE EXCEPTION '% is append-only: % is allowed only inside a purge', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation',
          CONSTRAINT = TG_TABLE_NAME || '_append_only',
          TABLE = TG_TABLE_NAME,
          HINT = 'Insert a new row instead. A purge for a removal request runs SET LOCAL carshenas.purge = ''on''.';
END
$$;

COMMENT ON FUNCTION jsonb_sha256(jsonb) IS
  'sha256 of the canonical text of a jsonb value; IMMUTABLE only because this database is UTF8.';
COMMENT ON FUNCTION refuse_change_unless_purge() IS
  'Append-only guard: a BEFORE UPDATE OR DELETE row trigger plus a BEFORE TRUNCATE statement trigger; allows changes only when carshenas.purge is on.';

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DROP FUNCTION refuse_change_unless_purge();
DROP FUNCTION jsonb_sha256(jsonb);
REVOKE SELECT ON schema_migrations FROM carshenas_web, carshenas_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM carshenas_readonly;
