-- migrate:up
-- At most 30 search files an account (CS-70): a limit that spans rows, so a trigger states it (the database skill: a
-- rule over several rows is a key, an exclusion constraint or a locked transaction). The matching job reads every
-- watching file (CS-72) and the crawl budget is shared (ADR-0017), so files are not unbounded. The lock is advisory
-- and per account: two files made at once by one buyer are counted one after the other, and no one else waits.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION search_file_limit() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
  AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('search_file:' || NEW.account_id::text, 0));
  IF (SELECT count(*) FROM search_file WHERE account_id = NEW.account_id) >= 30 THEN
    RAISE EXCEPTION 'account %: at most 30 search files', NEW.account_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'search_file_per_account_limit', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END
$$;

COMMENT ON FUNCTION search_file_limit() IS
  'Refuses the 31st search file of an account with check_violation and the constraint name search_file_per_account_limit, which the app maps to a Farsi message. Takes an advisory lock on the account first, so concurrent inserts are counted in turn. The number is MAX_SEARCH_FILES in apps/web/src/features/search-files/search-files-rules.ts; a test fails when they differ.';

REVOKE EXECUTE ON FUNCTION search_file_limit() FROM PUBLIC;

CREATE TRIGGER search_file_limit
  BEFORE INSERT ON search_file
  FOR EACH ROW EXECUTE FUNCTION search_file_limit();

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TRIGGER search_file_limit ON search_file;
DROP FUNCTION search_file_limit();
