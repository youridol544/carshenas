# Accounts: settings, the superadmin, sessions and sign-in throttling

Accounts are a username and a password (ADR-0020, CS-39). Buyers sign up at `/sign-up`; the superadmin is made only by a command. How the pieces fit: `apps/web/src/server/auth/` (sessions, cookies, throttling, the guards), `apps/web/src/features/accounts/` (pages, forms, actions), `packages/accounts/` (rules, hashing, the command). The tables: `docs/design/data-model.md`, section 3, "Added by CS-39".

## Settings

In `.env` locally, in the server's environment in a deployment; `apps/web/src/server/env.ts` reads them.

| Variable | Default | Meaning |
|---|---|---|
| `CARSHENAS_AUTH_KEY` | none; required to sign anyone in or up | At least 32 random bytes in base64 (`openssl rand -base64 32`). Keys the throttle's hashes and signs device cookies. `example.env` holds a value for local development only; every deployment makes its own and keeps it with its other secrets. Changing it forgets every throttle counter and device, and signs nobody out |
| `CARSHENAS_SIGN_IN_ADDRESS_LIMIT` | 100 | Failed sign-ins one client address may make in an hour |
| `CARSHENAS_SIGN_UP_ADDRESS_LIMIT` | 20 | Sign-up attempts one client address may make in an hour |
| `CARSHENAS_USERNAME_CHECK_ADDRESS_LIMIT` | 120 | Username availability checks one client address may make in an hour |

A `.env` from before CS-39 lacks `CARSHENAS_AUTH_KEY`: copy it from `example.env`. The browser tests sign everyone up and in from 127.0.0.1, so a checkout that runs them raises the three address limits in its `.env` (100000 each); the limits' own behaviour is tested in `apps/web/src/server/auth/throttle.db.test.ts`.

## The superadmin

```bash
pnpm account:superadmin pedram                       # create, or promote a buyer; prints a generated password once
pnpm account:superadmin pedram --reset-password      # a new generated password for an existing superadmin
pnpm account:superadmin pedram --password-stdin < file   # a password of your own, at least 20 characters
```

- It runs as the migration role from `.env` (`DATABASE_MIGRATE_URL`), the only role that may set `account.role`; the web app's role cannot, even through a bug (the column privileges in `db/migrations/20260929150523_create_accounts.sql`).
- The password is never an argument or an environment variable, where other processes and the shell's history could read it. A generated one is 24 symbols in four groups of six, shown once and stored only as an Argon2id hash: keep it in a password manager.
- Every role it grants is appended to `account_role_change` with who ran it (`cli:<user>@<host>`). A new password or a promotion ends the account's sessions and clears its sign-in waits. Running it again for a superadmin without `--reset-password` changes nothing.
- A superadmin's session lasts 12 hours. After signing in, a superadmin lands on `/admin`; the account menu links there.
- On a new server: after `pnpm db:migrate`, run it once for the owner's username (CS-37).

## Sessions

- A session is a row in `account_session` holding the SHA-256 of the cookie's random token; the token itself exists only in the browser. A buyer's lasts 30 days from sign-in, a superadmin's 12 hours; neither is extended.
- The cookie is `__Host-session` (Secure, HttpOnly, SameSite=Lax, Path=/) on every deployment. Over plain http on a loopback host (`pnpm dev`, the browser tests) it is `session` without Secure, because Playwright's WebKit refuses Secure cookies over http. `__Host-device`, or `device`, marks a browser that signed into an account before.
- Sign out: the account menu or the account page. To end every session of an account: `pnpm account:superadmin <name> --reset-password` for a superadmin; for a buyer, `DELETE FROM account_session WHERE account_id = …` as the migration role (a page for it is a follow-up).

## Sign-in throttling

`auth_throttle` holds one row per scope and keyed hash, never a username or an address:

- **Per account name**, for browsers that never signed into it: five failures are free, then each attempt waits 30 s, 60 s … up to an hour. A success clears it; the command clears it too.
- **Per device**, for a browser that signed into that account before: the same waits on its own row, so nobody else's guessing makes the owner wait.
- **Per client address**: the hourly limits in the settings above.

The client address is the last entry of `X-Forwarded-For`. A deployment must put exactly one reverse proxy in front of Next.js, listening publicly while Next.js listens on loopback only (CS-37), with:

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Forwarded-For   $remote_addr;   # replaces what the client sent, never appends to it
proxy_set_header X-Forwarded-Proto $scheme;
```

Nothing sweeps old throttle rows or expired sessions yet; a sign-in removes its own account's expired sessions (a daily sweep is a follow-up).

## Logs

One line per attempt, `sign-up attempt` or `sign-in attempt` with `outcome` (`created`, `rejected`, `throttled`, `busy`, `signed_in`, `wrong`), `accountId` when known and the `throttle` scope that answered; `signed out` with the `accountId`. Never the typed username, the password, a token or an address (`apps/web/src/features/accounts/accounts-actions.db.test.ts` proves it). `CARSHENAS_LOG_SQL=1` in development logs SQL parameters, which include typed usernames: never turn it on outside development.

## Browser tests

`e2e/tests/app/accounts.spec.ts` signs up buyers named `e2e_<hex>` through the pages and makes one superadmin per test worker, `e2e_superadmin_<n>`, through `pnpm account:superadmin … --reset-password --password-stdin`, so it needs the same database as the app under test. The accounts stay in a local database; they are test data.
