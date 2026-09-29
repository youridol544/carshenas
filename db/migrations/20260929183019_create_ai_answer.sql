-- migrate:up
-- The AI layer's validated answers (CS-45; ADR-0021 point 2.4; docs/design/data-model.md, "recorded model
-- responses"): the cache a call is answered from without a request, and the record a rebuild replays instead of
-- asking the model again. One row per task, prompt version, model and rendered input, found by the SHA-256 of all four
-- (cache_key). Only answers that passed the schema and the checks are stored, and none is changed afterwards: the
-- worker may read and insert, never update or delete. The web app gets its grant with its first AI step (CS-62).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE ai_answer (
  id bigint GENERATED ALWAYS AS IDENTITY,
  cost_usd_micros bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  cache_key bytea NOT NULL,
  task text NOT NULL,
  prompt_version text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  answering_model text NOT NULL,
  output jsonb NOT NULL,
  CONSTRAINT ai_answer_pkey PRIMARY KEY (id),
  CONSTRAINT ai_answer_cache_key_unique UNIQUE (cache_key),
  CONSTRAINT ai_answer_cache_key_is_sha256 CHECK (octet_length(cache_key) = 32),
  CONSTRAINT ai_answer_task_format CHECK (task ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$' AND char_length(task) <= 100),
  CONSTRAINT ai_answer_prompt_version_format CHECK (prompt_version ~ '^[0-9a-f]{16}$'),
  CONSTRAINT ai_answer_provider_valid CHECK (provider IN ('openai', 'anthropic', 'google', 'deepseek')),
  CONSTRAINT ai_answer_model_format CHECK (model ~ '^\S{1,200}$'),
  CONSTRAINT ai_answer_answering_model_format CHECK (answering_model ~ '^\S{1,200}$'),
  CONSTRAINT ai_answer_output_is_object CHECK (jsonb_typeof(output) = 'object'),
  CONSTRAINT ai_answer_cost_usd_micros_range CHECK (cost_usd_micros BETWEEN 0 AND 999999999999999)
);

COMMENT ON TABLE ai_answer IS
  'One validated answer of a language model, for one AI task, prompt version, model and rendered input (CS-45, ADR-0021). packages/ai answers a repeated call from here without a request, and a rebuild reuses it instead of asking again. Written once, never updated; kept across prompt versions until a retention rule is needed.';
COMMENT ON COLUMN ai_answer.cache_key IS
  'SHA-256 of the task, the prompt version, the requested model with its options and the rendered input (cacheKey in packages/ai/src/answer-cache.ts). The input itself is never stored.';
COMMENT ON COLUMN ai_answer.task IS 'The registry name of the AI task: <area>.<what>, such as listing.facts.';
COMMENT ON COLUMN ai_answer.prompt_version IS
  'The first 16 hex digits of the SHA-256 of the instructions, the output schema and the output budget.';
COMMENT ON COLUMN ai_answer.provider IS 'The Metis native route the model was asked on (ADR-0019 point 2).';
COMMENT ON COLUMN ai_answer.model IS 'The model id the layer asked for, as the route takes it (claude-haiku-4-5).';
COMMENT ON COLUMN ai_answer.answering_model IS
  'The model id the provider reported: Metis may route a requested id to another model (CS-42).';
COMMENT ON COLUMN ai_answer.output IS
  'The answer as the task schema and checks accepted it. Built from text that was redacted before it was sent (ADR-0019), so it holds no seller contact details.';
COMMENT ON COLUMN ai_answer.cost_usd_micros IS
  'What producing the answer cost at the live Metis list price, every attempt included, in millionths of a US dollar; NULL when the model had no price.';

GRANT SELECT, INSERT ON ai_answer TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE ai_answer;
