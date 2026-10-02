-- migrate:up
-- Plain-Farsi search asks a language model from the web app (CS-62, ADR-0029). The web role gets no table privilege on
-- ai_answer or model_spend: a leaked web credential or a SQL bug could otherwise pre-insert a listing.facts answer under
-- a key the worker computes (ai_answer_cache_key_unique keeps the first row), read every task's answers, or write
-- spend rows that trip or hide the daily cap. It gets four functions instead, owned by carshenas_owner and running with
-- its rights, each able to touch only task 'query.filters': read one answer by its key, add one answer, add one spend
-- row (a cost between 0 and US$1), and sum today's spend. The visitor limit on paid questions counts per client address
-- and hour in auth_throttle, like the sign-up and username limits, so its scope list gains one value, added NOT VALID
-- and validated in the next migration, as the database skill requires for a table that has rows.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION read_query_answer(wanted_cache_key bytea)
  RETURNS TABLE (
    id bigint, prompt_version text, provider text, model text, answering_model text, output jsonb,
    cost_usd_micros bigint)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.prompt_version, a.provider, a.model, a.answering_model, a.output, a.cost_usd_micros
  FROM public.ai_answer a
  WHERE a.cache_key = wanted_cache_key AND a.task = 'query.filters'
$$;

CREATE FUNCTION record_query_answer(
  new_cache_key bytea, new_prompt_version text, new_provider text, new_model text, new_answering_model text,
  new_output jsonb, new_cost_usd_micros bigint)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  stored bigint;
BEGIN
  IF pg_column_size(new_output) > 16384 THEN
    RAISE EXCEPTION 'a query.filters answer is at most 16 kB' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ai_answer
    (cache_key, task, prompt_version, provider, model, answering_model, output, cost_usd_micros)
  VALUES
    (new_cache_key, 'query.filters', new_prompt_version, new_provider, new_model, new_answering_model, new_output,
     new_cost_usd_micros)
  ON CONFLICT ON CONSTRAINT ai_answer_cache_key_unique DO NOTHING
  RETURNING id INTO stored;
  RETURN stored;
END
$$;

CREATE FUNCTION record_query_spend(
  new_prompt_version text, new_model text, new_outcome text, new_error_reason text, new_cost_usd_micros bigint,
  new_estimated boolean)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF new_cost_usd_micros IS NULL OR new_cost_usd_micros < 0 OR new_cost_usd_micros > 1000000 THEN
    RAISE EXCEPTION 'a query.filters call costs between 0 and 1,000,000 micro-dollars' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.model_spend
    (task, prompt_version, model, outcome, error_reason, cost_usd_micros, estimated)
  VALUES
    ('query.filters', new_prompt_version, new_model, new_outcome, new_error_reason, new_cost_usd_micros,
     new_estimated);
END
$$;

CREATE FUNCTION spend_today_query_usd_micros()
  RETURNS bigint
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(s.cost_usd_micros), 0)::bigint
  FROM public.model_spend s
  WHERE s.task = 'query.filters'
    AND s.created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran')
$$;

COMMENT ON FUNCTION read_query_answer(bytea) IS
  'The stored answer of plain-Farsi search (task query.filters) under a cache key, for the web role, which has no privilege on ai_answer (CS-62, ADR-0029). No row of another task is ever returned.';
COMMENT ON FUNCTION record_query_answer(bytea, text, text, text, text, jsonb, bigint) IS
  'Adds a validated query.filters answer (at most 16 kB) for the web role; the task is fixed, the first answer under a key stays, and the id is NULL when one was there. Never another task.';
COMMENT ON FUNCTION record_query_spend(text, text, text, text, bigint, boolean) IS
  'Records what one query.filters call cost (0 to 1,000,000 micro-dollars) for the web role; the task is fixed.';
COMMENT ON FUNCTION spend_today_query_usd_micros() IS
  'What query.filters calls cost since midnight in Tehran, in micro-dollars: what plain-Farsi search''s daily cap reads.';

REVOKE EXECUTE ON FUNCTION read_query_answer(bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION record_query_answer(bytea, text, text, text, text, jsonb, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION record_query_spend(text, text, text, text, bigint, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION spend_today_query_usd_micros() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION read_query_answer(bytea) TO carshenas_web;
GRANT EXECUTE ON FUNCTION record_query_answer(bytea, text, text, text, text, jsonb, bigint) TO carshenas_web;
GRANT EXECUTE ON FUNCTION record_query_spend(text, text, text, text, bigint, boolean) TO carshenas_web;
GRANT EXECUTE ON FUNCTION spend_today_query_usd_micros() TO carshenas_web;

ALTER TABLE auth_throttle
  DROP CONSTRAINT auth_throttle_scope_valid,
  ADD CONSTRAINT auth_throttle_scope_valid CHECK (scope IN (
    'sign_in_account', 'sign_in_device', 'sign_in_address', 'sign_up_address', 'username_check_address',
    'understand_address')) NOT VALID;

COMMENT ON COLUMN auth_throttle.hits IS
  'Consecutive failed sign-ins for sign_in_account and sign_in_device; failed sign-ins, sign-up attempts, username checks or questions put to the language model (understand_address) within the window for the address scopes.';

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DELETE FROM auth_throttle WHERE scope = 'understand_address';
ALTER TABLE auth_throttle
  DROP CONSTRAINT auth_throttle_scope_valid,
  ADD CONSTRAINT auth_throttle_scope_valid CHECK (scope IN (
    'sign_in_account', 'sign_in_device', 'sign_in_address', 'sign_up_address', 'username_check_address')) NOT VALID;
ALTER TABLE auth_throttle VALIDATE CONSTRAINT auth_throttle_scope_valid;

COMMENT ON COLUMN auth_throttle.hits IS
  'Consecutive failed sign-ins for sign_in_account and sign_in_device; failed sign-ins, sign-up attempts or username checks within the window for the address scopes.';

DROP FUNCTION spend_today_query_usd_micros();
DROP FUNCTION record_query_spend(text, text, text, text, bigint, boolean);
DROP FUNCTION record_query_answer(bytea, text, text, text, text, jsonb, bigint);
DROP FUNCTION read_query_answer(bytea);
