-- 30_tests.sql: the constraints accept good rows and reject bad ones. Each case runs in its own subtransaction
-- and is rolled back, so the cases do not affect each other.
\set ON_ERROR_STOP on
\pset pager off
SET TIME ZONE 'UTC';

CREATE SCHEMA lab;
CREATE TABLE lab.result (
  n      integer GENERATED ALWAYS AS IDENTITY,
  test   text NOT NULL,
  expect text NOT NULL,
  got    text NOT NULL,
  pass   boolean NOT NULL
);
-- expect_error: the statement must fail, and the constraint name or message must match p_expect (a regex).
CREATE PROCEDURE lab.expect_error(p_test text, p_sql text, p_expect text) LANGUAGE plpgsql AS $$
DECLARE
  v_state text; v_constraint text; v_msg text; v_got text; v_pass boolean;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION USING ERRCODE = 'LB001';      -- accepted: undo it and report a failure
  EXCEPTION
    WHEN SQLSTATE 'LB001' THEN
      v_got := 'accepted'; v_pass := false;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_constraint = CONSTRAINT_NAME, v_msg = MESSAGE_TEXT;
      v_got := v_state || ' ' || coalesce(nullif(v_constraint, ''), '-') || ': ' || v_msg;
      v_pass := (coalesce(v_constraint, '') || ' ' || v_msg) ~ p_expect;
  END;
  INSERT INTO lab.result (test, expect, got, pass) VALUES (p_test, 'reject: ' || p_expect, v_got, v_pass);
END $$;
-- expect_ok: the statement must succeed (then it is rolled back).
CREATE PROCEDURE lab.expect_ok(p_test text, p_sql text) LANGUAGE plpgsql AS $$
DECLARE
  v_msg text; v_got text; v_pass boolean;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION USING ERRCODE = 'LB001';
  EXCEPTION
    WHEN SQLSTATE 'LB001' THEN
      v_got := 'accepted (rolled back)'; v_pass := true;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      v_got := 'rejected: ' || v_msg; v_pass := false;
  END;
  INSERT INTO lab.result (test, expect, got, pass) VALUES (p_test, 'accept', v_got, v_pass);
END $$;

-- ids used below
CREATE TEMP VIEW ids AS SELECT
  (SELECT id FROM listing WHERE source_listing_key = 'lab-0001') AS l1,
  (SELECT id FROM listing WHERE source_listing_key = 'lab-k-77') AS l2,
  (SELECT id FROM listing WHERE origin = 'native' AND status = 'draft') AS n2,
  (SELECT id FROM listing WHERE origin = 'native' AND status = 'active') AS n1;

-- ---------------------------------------------------------------- good rows are accepted
CALL lab.expect_ok('another Bama listing with a price', $t$
  INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, price_type, asking_price_toman)
  VALUES ('bama', 'lab-0099', 'https://bama.ir/car/lab-0099', 'active', now(), 'asking', 720000000) $t$);
CALL lab.expect_ok('a negotiable (توافقی) listing has no price', $t$
  INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, price_type)
  VALUES ('bama', 'lab-0100', 'https://bama.ir/car/lab-0100', 'active', now(), 'negotiable') $t$);
CALL lab.expect_ok('an imported car stating a Gregorian year only', $t$
  INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, model_year_ad, model_year_written)
  VALUES ('bama', 'lab-0101', 'https://bama.ir/car/lab-0101', 'active', now(), 2021, 'ad') $t$);
CALL lab.expect_ok('a native draft needs only its owner', $t$
  INSERT INTO listing (origin, source_id, seller_account_id, status)
  VALUES ('native', 'carshenas', (SELECT id FROM account ORDER BY id LIMIT 1), 'draft') $t$);
CALL lab.expect_ok('a crawled listing goes gone, then reappears', $t$
  DO $d$ BEGIN
    UPDATE listing SET status = 'gone', delisted_at = now() WHERE source_listing_key = 'lab-c1';
    UPDATE listing SET status = 'active', delisted_at = NULL WHERE source_listing_key = 'lab-c1';
  END $d$ $t$);
CALL lab.expect_ok('the snapshot of an unchanged page is skipped, not duplicated (ON CONFLICT DO NOTHING)', $t$
  INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload)
  SELECT listing_id, now(), url, canonical_version, payload FROM snapshot WHERE id = 2
  ON CONFLICT (listing_id, content_sha256) DO NOTHING $t$);
CALL lab.expect_ok('the purge path may delete snapshots', $t$
  DO $d$ BEGIN
    PERFORM set_config('carshenas.purge', 'on', true);
    DELETE FROM snapshot WHERE id = 4;
  END $d$ $t$);

-- ---------------------------------------------------------------- money, prices and years
CALL lab.expect_error('negative asking price', $t$
  UPDATE listing SET asking_price_toman = -5 WHERE source_listing_key = 'lab-0001' $t$, 'listing_asking_price_positive');
CALL lab.expect_error('zero price in the price history', $t$
  INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
  VALUES ((SELECT l1 FROM ids), now(), 'asking', 0, 2) $t$, 'price_event_price_positive');
CALL lab.expect_error('a "change" to the same price', $t$
  INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
  VALUES ((SELECT l1 FROM ids), now(), 'asking', 815000000, 2) $t$, 'price_event_is_a_change');
CALL lab.expect_error('negotiable (توافقی) with a price', $t$
  UPDATE listing SET price_type = 'negotiable' WHERE source_listing_key = 'lab-0001' $t$, 'listing_price_matches_type');
CALL lab.expect_error('Solar and Gregorian model years that disagree', $t$
  UPDATE listing SET model_year_ad = 2030 WHERE source_listing_key = 'lab-0001' $t$, 'listing_model_year_calendars_agree');
CALL lab.expect_error('says the year was written in Gregorian but stores none', $t$
  UPDATE listing SET model_year_written = 'ad' WHERE source_listing_key = 'lab-0001' $t$, 'listing_model_year_written_present');

-- ---------------------------------------------------------------- source, owner and origin
CALL lab.expect_error('a listing without a source', $t$
  INSERT INTO listing (source_listing_key, url, status, listed_at) VALUES ('x', 'https://x', 'active', now()) $t$,
  'null value in column "source_id"');
CALL lab.expect_error('a crawled listing without the source''s key', $t$
  INSERT INTO listing (source_id, url, status, listed_at) VALUES ('bama', 'https://bama.ir/car/x', 'active', now()) $t$,
  'listing_external_identity|listing_owner_matches_origin');
CALL lab.expect_error('a native listing without an owner', $t$
  INSERT INTO listing (origin, source_id, status) VALUES ('native', 'carshenas', 'draft') $t$, 'listing_owner_matches_origin');
CALL lab.expect_error('a native listing claiming to come from Bama', $t$
  INSERT INTO listing (origin, source_id, seller_account_id, status)
  VALUES ('native', 'bama', (SELECT id FROM account ORDER BY id LIMIT 1), 'draft') $t$, 'listing_source_fk');
CALL lab.expect_error('a crawled listing claiming Carshenas as its source', $t$
  INSERT INTO listing (source_id, source_listing_key, url, status, listed_at)
  VALUES ('carshenas', 'x', 'https://x', 'active', now()) $t$, 'listing_source_fk');
CALL lab.expect_error('a crawled listing with an owner account', $t$
  UPDATE listing SET seller_account_id = (SELECT id FROM account ORDER BY id LIMIT 1) WHERE source_listing_key = 'lab-0001' $t$,
  'listing_owner_matches_origin');
CALL lab.expect_error('the same Bama ad twice', $t$
  INSERT INTO listing (source_id, source_listing_key, url, status, listed_at)
  VALUES ('bama', 'lab-0001', 'https://bama.ir/car/lab-0001', 'active', now()) $t$, 'listing_source_key_unique');
CALL lab.expect_error('a private seller with a dealer id (personal data)', $t$
  UPDATE listing SET source_dealer_key = 'dealer-9' WHERE source_listing_key = 'lab-0001' $t$, 'listing_private_seller_has_no_key');

-- ---------------------------------------------------------------- catalogue consistency
CALL lab.expect_error('trim «۲۰۶ تیپ ۲» filed under the Dena model', $t$
  UPDATE listing SET model_id = (SELECT id FROM model WHERE slug = 'dena'), make_id = (SELECT id FROM make WHERE slug = 'ikco')
  WHERE source_listing_key = 'lab-0001' $t$, 'listing_trim_model_fk');
CALL lab.expect_error('matched to a trim but the trim is missing', $t$
  UPDATE listing SET trim_id = NULL WHERE source_listing_key = 'lab-0001' $t$, 'listing_catalogue_match_consistent');
CALL lab.expect_error('an alias pointing at a model and a trim at once', $t$
  INSERT INTO catalogue_alias (alias, script, model_id, trim_id)
  VALUES ('206 tip 2', 'latin', (SELECT id FROM model WHERE slug = '206'), (SELECT id FROM trim WHERE slug = 't2')) $t$,
  'catalogue_alias_one_target');
CALL lab.expect_error('deleting a trim that listings use', $t$
  DELETE FROM trim WHERE slug = 't2' $t$, 'catalogue_alias|listing_trim_model_fk|segment_valuation|violates foreign key');

-- ---------------------------------------------------------------- immutability and history
CALL lab.expect_error('the same snapshot content twice (plain INSERT)', $t$
  INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload)
  SELECT listing_id, now(), url, canonical_version, payload FROM snapshot WHERE id = 2 $t$, 'snapshot_unique_content');
CALL lab.expect_error('editing a snapshot', $t$
  UPDATE snapshot SET url = 'https://elsewhere' WHERE id = 1 $t$, 'append-only');
CALL lab.expect_error('deleting a snapshot outside a purge', $t$
  DELETE FROM snapshot WHERE id = 1 $t$, 'DELETE only inside a purge');
CALL lab.expect_error('rewriting price history', $t$
  UPDATE listing_price_event SET asking_price_toman = 800000000 WHERE id = 2 $t$, 'append-only');
CALL lab.expect_error('rewriting a duplicate verdict', $t$
  UPDATE pair_decision SET decision = 'non_match' WHERE decided_by = 'llm' $t$, 'append-only');
CALL lab.expect_error('a listing in two vehicles at the same time', $t$
  INSERT INTO vehicle_membership (listing_id, vehicle_id, valid, cause)
  VALUES ((SELECT l2 FROM ids), 3, tstzrange('2026-09-27 00:00+00', NULL), 'manual') $t$, 'vehicle_membership_no_overlap');
CALL lab.expect_error('a pair stored in both orders', $t$
  INSERT INTO listing_pair (listing_a_id, listing_b_id, blocking_key)
  VALUES ((SELECT l2 FROM ids), (SELECT l1 FROM ids), 'x') $t$, 'listing_pair_ordered');
CALL lab.expect_error('an LLM verdict without its reason', $t$
  INSERT INTO pair_decision (listing_pair_id, decision, decided_by, decider_version) VALUES (1, 'match', 'llm', 'dedupe-llm-v1') $t$,
  'pair_decision_reason_stored');

-- ---------------------------------------------------------------- lifecycle
CALL lab.expect_error('a crawled listing turned into a draft', $t$
  UPDATE listing SET status = 'draft' WHERE source_listing_key = 'lab-0001' $t$, 'cannot go from active to draft');
CALL lab.expect_error('a native draft marked sold without ever being published', $t$
  UPDATE listing SET status = 'sold', delisted_at = now() WHERE id = (SELECT n2 FROM ids) $t$, 'cannot go from draft to sold');
CALL lab.expect_error('a native draft published while incomplete', $t$
  DO $d$ DECLARE x bigint; BEGIN
    SELECT n2 INTO STRICT x FROM ids;
    UPDATE listing SET status = 'in_review' WHERE id = x;
    UPDATE listing SET status = 'active', listed_at = now() WHERE id = x;
  END $d$ $t$, 'listing_native_active_is_complete');
CALL lab.expect_error('an active listing with a delisting date', $t$
  UPDATE listing SET delisted_at = now() WHERE source_listing_key = 'lab-0001' $t$, 'listing_active_is_listed|listing_off_market_has_date');
CALL lab.expect_error('changing a listing''s origin', $t$
  UPDATE listing SET origin = 'native' WHERE source_listing_key = 'lab-0001' $t$, 'origin cannot change|listing_source_fk');
CALL lab.expect_error('editing a submitted revision', $t$
  UPDATE native_listing_revision SET payload = payload || '{"price_toman": 999}' WHERE status = 'approved' $t$, 'frozen');
CALL lab.expect_error('a second open draft for the same listing', $t$
  INSERT INTO native_listing_revision (listing_id, revision_no) VALUES ((SELECT n2 FROM ids), 2) $t$, 'revision_one_draft_per_listing');
CALL lab.expect_error('a contact request on a crawled listing', $t$
  INSERT INTO contact_request (listing_id, buyer_account_id, message)
  VALUES ((SELECT l1 FROM ids), (SELECT max(id) FROM account), 'سلام') $t$, 'contact_listing_is_native');

-- ---------------------------------------------------------------- crawl policy (ADR-0008) enforced in the database
CALL lab.expect_error('a crawl interval under three seconds', $t$
  UPDATE source SET min_request_interval_ms = 1000 WHERE id = 'bama' $t$, 'source_crawl_interval_floor');
CALL lab.expect_error('switching on a Divar crawl', $t$
  UPDATE source SET crawl_state = 'enabled' WHERE id = 'divar' $t$, 'source_only_crawl_sources_run');
CALL lab.expect_error('a crawl run for Divar', $t$
  INSERT INTO crawl_run (source_id, policy_check_id) SELECT 'divar', id FROM source_current_policy WHERE source_id = 'divar' $t$,
  'never crawled');
CALL lab.expect_error('a crawl run on terms read three months ago', $t$
  INSERT INTO crawl_run (source_id, policy_check_id) SELECT 'sheypoor', id FROM source_current_policy WHERE source_id = 'sheypoor' $t$,
  're-check before crawling');
CALL lab.expect_error('a crawl run citing another source''s policy', $t$
  INSERT INTO crawl_run (source_id, policy_check_id) SELECT 'bama', id FROM source_current_policy WHERE source_id = 'karnameh' $t$,
  'crawl_run_policy_same_source|must cite its latest policy check');
CALL lab.expect_error('two crawls of one source at once', $t$
  DO $d$ DECLARE p bigint; BEGIN
    SELECT id INTO p FROM source_current_policy WHERE source_id = 'bama';
    INSERT INTO crawl_run (source_id, policy_check_id) VALUES ('bama', p);
    INSERT INTO crawl_run (source_id, policy_check_id) VALUES ('bama', p);
  END $d$ $t$, 'crawl_run_one_running_per_source');
CALL lab.expect_error('another request after a 429 stopped the source', $t$
  DO $d$ DECLARE r bigint; BEGIN
    INSERT INTO crawl_run (source_id, policy_check_id)
      SELECT 'bama', id FROM source_current_policy WHERE source_id = 'bama' RETURNING id INTO r;
    INSERT INTO fetch_log (source_id, crawl_run_id, url, http_status, outcome) VALUES ('bama', r, 'https://bama.ir/car/lab-0002', 429, 'rate_limited');
    INSERT INTO fetch_log (source_id, crawl_run_id, url, http_status, outcome) VALUES ('bama', r, 'https://bama.ir/car/lab-0003', 200, 'ok');
  END $d$ $t$, 'must not be sent');
CALL lab.expect_error('a photo downloaded from Karnameh', $t$
  INSERT INTO photo (listing_id, position, source_url) VALUES ((SELECT l2 FROM ids), 0, 'https://karnameh.com/pictures/car-posts/x.jpg') $t$,
  'does not allow downloading');
CALL lab.expect_error('a photo stored before the plate and phone check', $t$
  INSERT INTO photo (listing_id, position, stored_object_key, stored_sha256, width, height)
  VALUES ((SELECT l1 FROM ids), 1, 'bama/lab-0001/1.webp', sha256('x'), 800, 600) $t$, 'photo_stored_only_when_safe');
CALL lab.expect_error('a photo marked dropped that is still stored', $t$
  UPDATE photo SET pii_status = 'dropped' WHERE listing_id = (SELECT l1 FROM ids) $t$, 'photo_stored_only_when_safe');

-- ---------------------------------------------------------------- AI steps, valuations and alerts
CALL lab.expect_error('an extracted field accepted below its threshold', $t$
  UPDATE extraction_field SET status = 'accepted' WHERE field = 'insurance_months_left' $t$, 'extraction_field_accepted_meets_threshold');
CALL lab.expect_error('the same model input sent twice (cache key)', $t$
  INSERT INTO extraction (snapshot_id, input_sha256, prompt_version, model, status, output, input_tokens, output_tokens, cost_usd_micros)
  SELECT snapshot_id, input_sha256, prompt_version, model, status, output, 1, 1, 1 FROM extraction LIMIT 1 $t$, 'extraction_cache_key');
CALL lab.expect_error('a deal rating and a no-rating reason together', $t$
  UPDATE listing_valuation SET no_rating_reason = 'too_few_comparables' WHERE deal_rating = 'good' $t$, 'lv_rating_xor_reason');
CALL lab.expect_error('a listing used as its own comparable', $t$
  INSERT INTO listing_valuation_comparable (valuation_run_id, listing_id, comparable_listing_id, comparable_price_toman, adjusted_price_toman, weight)
  SELECT valuation_run_id, listing_id, listing_id, 1, 1, 1 FROM listing_valuation LIMIT 1 $t$, 'lvc_not_itself');
CALL lab.expect_error('a second valuation run published for the same day and method', $t$
  INSERT INTO valuation_run (as_of_date, method_version, status, finished_at) VALUES ('2026-09-27', 'imv-lab-v1', 'succeeded', now()) $t$,
  'valuation_run_one_success_per_day');
CALL lab.expect_error('a second "new deal" message for the same car', $t$
  INSERT INTO alert (saved_search_id, kind, vehicle_id, listing_id)
  SELECT saved_search_id, 'new_deal', vehicle_id, (SELECT l2 FROM ids) FROM alert WHERE kind = 'new_deal' LIMIT 1 $t$,
  'alert_once_per_new_vehicle');
CALL lab.expect_error('a price-drop alert without its price event', $t$
  INSERT INTO alert (saved_search_id, kind, vehicle_id, listing_id)
  SELECT saved_search_id, 'price_drop', vehicle_id, listing_id FROM alert LIMIT 1 $t$, 'alert_price_drop_has_event');
CALL lab.expect_error('an active saved search with no Telegram chat', $t$
  INSERT INTO saved_search (status, manage_token_sha256, filters) VALUES ('active', sha256('t'), '{}') $t$, 'saved_search_linked_unless_pending');
CALL lab.expect_error('a review item whose subject does not match its kind', $t$
  INSERT INTO review_item (kind, listing_id) VALUES ('duplicate_pair', (SELECT l1 FROM ids)) $t$, 'review_subject_matches_kind');

\echo '== results'
SELECT n, pass, test, got FROM lab.result ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS passed, count(*) FILTER (WHERE NOT pass) AS failed, count(*) AS total FROM lab.result;
\echo '== state after the tests is unchanged (every case rolled back)'
SELECT id, crawl_state FROM source WHERE id = 'bama';
