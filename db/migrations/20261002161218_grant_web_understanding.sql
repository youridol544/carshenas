-- migrate:up
-- Plain-Farsi search asks a language model from the web app (CS-62, ADR-0029). The web role may read the answer cache
-- and add to it (ai_answer, as the worker's role may), and record what each paid call cost (model_spend), which the
-- search's daily spending cap sums; neither table is ever changed or deleted from, by this role or any other
-- (the append-only triggers). The visitor limit on paid questions counts per client address and hour in auth_throttle,
-- like the sign-up and username limits, so its scope list gains one value. The new CHECK is added NOT VALID and
-- validated in the next migration, as the database skill requires for a table that has rows.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT SELECT, INSERT ON ai_answer TO carshenas_web;
GRANT SELECT, INSERT ON model_spend TO carshenas_web;

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

REVOKE SELECT, INSERT ON model_spend FROM carshenas_web;
REVOKE SELECT, INSERT ON ai_answer FROM carshenas_web;
