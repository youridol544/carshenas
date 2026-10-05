# Deploy Carshenas to a server, keep it healthy, back it up, and roll it back

The deployment kit of CS-119: one command puts the web app, the worker, PostgreSQL 18 and an HTTPS proxy on a Linux server you rent, from your own computer. It prepares CS-37 (the deploy itself is yours, on the server you choose; ADR-0051 compares three Iranian options), delivers CS-38's continuous integration and the useful minimum of CS-49 (a named, dated release of the data that can be cut and restored). The site is **unlisted** (ADR-0017 point 10): noindex on every answer, robots.txt closed, the link shared only through the submission.

**The one rule of this kit: the server never pulls an image and never installs a package.** A server in Iran may not reach Docker Hub, and npm can be slow there. Everything is built on your computer and sent over ssh with `docker save | gzip | ssh … docker load`; the compose file says `pull_policy: never`. Behind a blocked registry on your own computer, build with a mirror (below).

```bash
scripts/deploy.sh user@your-server        # the first deploy, and every update
```

## What you provide

| What | Why |
|---|---|
| A Linux server with a public IPv4 address, 4 GB of memory at least (8 GB is comfortable), 40 GB of disk, ssh with a key | Ubuntu 24.04 LTS is what this was written for; ADR-0051 prices ParsPack's 4 vCPU, 8 GB plan at 2,635,000 tomans a month |
| Docker and the compose plugin on it, and a user in the `docker` group | "The server", below; once |
| A domain whose A record points at the server (best), or only the server's address | Reviewers type a name; an address works but a browser warns once ("A domain, or only an address") |
| The licensed typeface on your computer, and its web licence registered for the domain | ADR-0015, `docs/runbooks/licensed-font.md`: the web image is built from it, so it is inside that image |
| A Metis API key | The worker stops at start without one (ADR-0019); nothing is spent unless a switch below is on |
| A contact address for the crawler | It names itself `CarshenasBot/0.1 (+contact: …)` to every site (ADR-0008 point 5) |
| On your computer: Docker (with BuildKit), ssh, git; about 4 GB of free memory for the build | Not pnpm: the build runs inside Docker |

## The server (once)

On Ubuntu 24.04, from the distribution's own repository, which Iranian mirrors serve (ParsPack: `repo.abrha.net/ubuntu`; also `mirror.arvancloud.ir`, `ir.archive.ubuntu.com`; research note of 2026-10-04):

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 ufw
sudo usermod -aG docker "$USER"            # log out and in again
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
timedatectl status | grep 'System clock synchronized'   # must say yes: certificates depend on the clock
```

Nothing else is installed: no Docker registry setting, no database, no web server. `./scripts/deploy.sh` checks the server before it builds and says what is missing.

## The first deploy

```bash
git clone … && cd carshenas
# the typeface in place (docs/runbooks/licensed-font.md); then:
scripts/deploy.sh user@your-server
```

It asks for what only you know and keeps nothing on your computer: the domain (empty: the server's address), the address Let's Encrypt may write to, the crawler's contact, the Metis key, and the superadmin's username. For no questions, set `CARSHENAS_SITE_ADDRESS`, `ACME_EMAIL`, `CRAWLER_CONTACT`, `METIS_API_KEY`, `DEPLOY_SUPERADMIN` in the environment. Then, in order:

1. **Checks the server** (Docker, compose, architecture, memory, disk) and builds for its architecture.
2. **Builds** `carshenas-web:<release>` and `carshenas-worker:<release>`, where the release is `<UTC date>-<commit>` (`-dirty` with uncommitted changes). Multi-stage, run as an unprivileged user, with no setting, key or password inside (`deploy/docker/*.Dockerfile`, `.dockerignore` keeps `.env*` out of the context). About 4 GB of memory and several minutes the first time; later builds reuse caches.
3. **Sends** the two images, and PostgreSQL's and Caddy's (pinned in `deploy/images.env`; pulled on your computer once) when the server's copy differs, as one compressed stream over ssh.
4. **Copies the deployment folder** to `~/carshenas` on the server (`deploy/` plus `db/postgresql.conf` and `db/bootstrap/*.sql`, the same SQL that makes the local database).
5. **Writes `.env` on the server** (mode 600) and generates every password and the auth key there, with `/dev/urandom`: they never leave the server.
6. **Switches** (`carshenas deploy-release`): derives PostgreSQL's memory settings from the server's memory, starts PostgreSQL (the first start makes the six roles, their passwords and the database), cuts a release of the data if there is any, migrates, starts the web app, the worker, the proxy and the backup loop, waits until each is healthy, and checks `/api/health`. A deploy that fails goes back to the previous release by itself.
7. **Makes the superadmin** (`pnpm account:superadmin`): the password is shown once, in your terminal. Keep it in a password manager.
8. **Looks at the site from your computer**: `/api/health`, the `x-robots-tag` header and `/robots.txt`.

Then open the site. The first certificate can take a minute; until the domain points at the server, Caddy cannot make one (`scripts/deploy.sh ssh user@host logs caddy`).

## What is on the server

```
~/carshenas/
  compose.yaml  images.env  Caddyfile  caddy/        copied by every deploy; do not edit (a deploy overwrites them)
  .env                                                the secrets and settings; yours, never overwritten (deploy/example.production.env lists every variable)
  compose.local.yaml                                  yours, optional: changes to the stack (a limit, a mount), merged over compose.yaml and never overwritten
  release.env                                         the release running and the previous one; written by the deploy
  certs/                                              fullchain.pem and privkey.pem, for the manual mode
  postgres/  ops/  bin/carshenas  releases/           settings, scripts, the server command, the cut releases
```

Named Docker volumes hold what must survive: `postgres-data` (the database), `caddy-data` (certificates), `caddy-config`. `carshenas down` never removes a volume; nothing in the kit does.

The server command lives at `~/carshenas/bin/carshenas`. From your computer: `scripts/deploy.sh ssh user@host <command>`; on the server, `cd ~/carshenas && bin/carshenas <command>`. `carshenas help` lists them:

| Command | What it does |
|---|---|
| `status` | Containers and health, the probe, the running and previous release, the newest backups |
| `up`, `stop`, `restart [service]`, `down` | Start, stop and restart; `down` removes containers and refuses `-v` |
| `logs [service] [-f] [--since 1h] [--tail=all]` | `docker compose logs`: the last 200 lines unless you give a count |
| `probe` | What `GET /api/probe` says (below) |
| `psql [--superuser]` | Read-only `psql`; `--superuser` is for the owner's changes (`change_source_state`, below) |
| `run <command…>` | A command on the worker's image: `pnpm valuation:run`, `pnpm search:rebuild`, `pnpm derive:listings`, `pnpm catalogue:sync`, `pnpm sweep:divar tracked` (the commands of `docs/runbooks/worker.md`) |
| `superadmin <name> [--reset-password]` | `docs/runbooks/accounts.md` |
| `migrate` | Applies pending migrations (a deploy does it) |
| `release` (`cut`, `list`, `verify`, `restore`, `prune`) | "Backups and releases", below |
| `deploy-release R`, `rollback` | What `scripts/deploy.sh` calls; "Update", "Roll back" |
| `secrets rotate NAME`, `tune`, `check`, `init-env` | "Secrets"; PostgreSQL's memory settings; what the server needs; `.env` |

## A domain, or only an address (HTTPS)

`CARSHENAS_TLS_MODE` in `.env` picks how the certificate comes (`deploy/Caddyfile`, `deploy/caddy/mode-*.caddy`). One reverse proxy faces the internet and Next.js listens on the compose network only; Caddy writes `Host`, `X-Forwarded-Proto` and `X-Forwarded-For` (replacing what a visitor sent: sign-in throttling counts its last entry, `docs/runbooks/accounts.md`), and streams pages as they render.

| Mode | For | Notes |
|---|---|---|
| `auto` | A domain whose A record points at the server | Caddy asks Let's Encrypt and renews by itself. Needs ports 80 and 443 reachable from the internet, and `ACME_EMAIL`. **From inside Iran this can fail**: ParsPack's documentation says http validation fails on isolated Iranian servers and advises a DNS challenge, and in 2026 Iran's international links were cut for weeks (research note, "HTTPS from inside Iran"). Try it; `manual` is the answer when it does not work |
| `manual` | A domain, and a certificate you bring | See below. The safe choice for a long review |
| `internal` | Only the server's address (the default for one) | Caddy's own authority signs it; a browser warns once, and then accounts work, since they need https. A reviewer who will not click through needs a domain |
| `cdn` | A domain behind ArvanCloud's CDN (carshenas.app) | The CDN makes and renews the certificate and forwards plain http to port 80; Caddy makes none. Needs `CARSHENAS_TRUSTED_PROXIES` (below) |
| `acme-ip` | Only the address, with a trusted certificate | Experimental, **not run in CS-119**: a six-day Let's Encrypt certificate for the address itself (generally available since 2026-01-15). It needs the link to the authority to stay up; a week without it and the certificate expires. `internal` has nothing to renew |

**A certificate by DNS challenge, made on your computer** (works when the server cannot reach the authority, valid 90 days):

```bash
certbot certonly --manual --preferred-challenges dns -d demo.example.ir     # it asks you to add a TXT record, then checks it
scp /etc/letsencrypt/live/demo.example.ir/{fullchain,privkey}.pem user@your-server:carshenas/certs/
# in .env on the server: CARSHENAS_TLS_MODE=manual, CARSHENAS_SITE_ADDRESS=demo.example.ir
scripts/deploy.sh ssh user@your-server restart caddy
```

Do the same before day 60. (Or give `DEPLOY_CERT` and `DEPLOY_KEY` to the first deploy.) Point the A record straight at the server, with no CDN or proxy in front. `sslip.io` and `nip.io` are filtered from Iran; do not use them. A domain's DNS must also answer from inside Iran.

## Behind ArvanCloud's CDN (`cdn` mode)

carshenas.app's DNS is on ArvanCloud (`*.ns.arvancdn.ir`), so its CDN answers visitors over HTTPS with its own free certificate, from inside Iran, and forwards to the server. In `.env`:

```bash
CARSHENAS_SITE_ADDRESS=carshenas.app
CARSHENAS_TLS_MODE=cdn
CARSHENAS_TRUSTED_PROXIES="185.143.232.0/22 188.229.116.16/30 94.101.182.0/27 …"   # https://www.arvancloud.ir/fa/ips.txt, all of it
```

Caddy then listens on port 80 only, tells the web app the visitor used `https` (secure cookies, HSTS), and takes the visitor's address from the CDN's `X-Forwarded-For`, believed only from those ranges (`trusted_proxies_strict`): sign-in throttling counts visitors, not the CDN's edges. In ArvanCloud's panel, for the domain:

1. **DNS**: an `A` record for `@` (and `www` if wanted) to the server's address, with the cloud (CDN) switched **on**.
2. **HTTPS**: the free certificate on, redirect http to https on, HSTS on.
3. **Origin**: protocol **HTTP**, port 80 (the server makes no certificate).
4. **Cache**: follow the origin's headers. The app marks its pages `private` or `no-store`; only the build's static files are cached.

Close port 80 to everyone but the CDN, so nobody reaches the site around it: `for r in $(curl -s https://www.arvancloud.ir/fa/ips.txt); do ufw allow from "$r" to any port 80 proto tcp; done; ufw delete allow 80/tcp; ufw delete allow 443/tcp`. Read the list again when ArvanCloud changes it, and change `CARSHENAS_TRUSTED_PROXIES` and the firewall together.

## The site is unlisted

`CARSHENAS_UNLISTED=1` (the default; `0` lists the site, then `carshenas up`):

- Every response from the web app carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` (`src/proxy.ts` through `src/lib/exposure.ts`, per request: a pass over every path but the build's static files), and so does every answer the proxy writes itself (a 502 while the app starts). `/robots.txt` disallows everything.
- No public page links to the superadmin section (its link appears only for a signed-in superadmin), and `/admin` answers a visitor with a 404.
- A production build adds `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and a Content-Security-Policy of the directives that need no nonce (`frame-ancestors 'none'`, `base-uri`, `form-action`, `object-src`), and over https `Strict-Transport-Security: max-age=31536000` (never for an address). Cookies are always `__Host-`, Secure, HttpOnly, SameSite=Lax on any host but loopback (`docs/runbooks/accounts.md`).
- Secrets exist only in the server's `.env` and its containers' environment; the images hold none.

Check it from your computer (the deploy does the first two):

```bash
curl -sSI https://demo.example.ir/ | grep -i -E 'x-robots-tag|strict-transport|x-frame'
curl -sS https://demo.example.ir/robots.txt          # User-Agent: *  Disallow: /
```

## Check that it opens from Iran, without a VPN

Do this before the link goes anywhere; record the result on CS-37 (criterion 3) and in ADR-0051.

1. From Iranian servers: `https://check-host.net/check-http?host=https://demo.example.ir&node=ir1.node.check-host.net&node=ir2.node.check-host.net` (eight Iranian nodes, `ir1` to `ir8`; they sit in hosting networks, so they cannot show what a home network filters).
2. From a phone on mobile data with Wi-Fi and the VPN off, and a computer on a home line: open the page, register, sign in, search.
3. `nslookup demo.example.ir` must not answer an address in `10.10.34.x`: that is how Iranian networks answer a filtered name.
4. ViewDNS "Iran Firewall Test" (`viewdns.info/iranfirewall/`); OONI Probe on a phone.
5. Again after a day, and after a week: the link is opened days after it is sent.

## Update

```bash
scripts/deploy.sh user@your-server       # the same command: builds this commit and switches to it
```

What a server that has its `.env` does differently: it leaves `.env` and the secrets alone, and `carshenas deploy-release` runs these steps, **stopping at the first failure and going back**:

1. a **release of the data** is cut first (`before-<release>`, the newest five kept), so there is a restore point from just before anything changed (`DEPLOY_SKIP_BACKUP=1` skips it, at your own risk);
2. the worker is stopped (it drains running jobs for up to 30 seconds), and the migrations are applied with the **new** image's dbmate, as `carshenas_migrate`, each in its own transaction with the timeouts the migrations set;
3. the web app, the worker, the proxy and the backup service start on the new images; each must become healthy within a few minutes, and the web app must reach its database;
4. when any of that fails, the previous release's images are started again, and the command says what failed and shows the last log lines. A first deploy has nothing to go back to and stops where it is.

The images of the last three releases stay on the server, older ones are removed. Pages open in a browser during a deploy may need a reload (a Server Action of the old build does not exist in the new one).

To change a pinned image (PostgreSQL's minor, Caddy's): edit `deploy/images.env`, then deploy; the new image is pulled on your computer and shipped. A PostgreSQL major is not an update: dump and restore (`docs/runbooks/local-database.md`, "Upgrading").

To build behind a mirror, on your computer: `NODE_IMAGE=docker.arvancloud.ir/library/node:22.23.3-bookworm-slim NPM_REGISTRY=https://repo.hmirror.ir/npm/ scripts/deploy.sh user@host` (mirrors that answered from an Iranian line on 2026-10-04: `docker.arvancloud.ir`, `hub.hamdocker.ir`, `docker.abrha.net`, `docker.iranserver.com`; npm: `repo.hmirror.ir/npm`, `package-mirror.liara.ir/repository/npm/`). For the two pinned images, `docker pull` from a mirror and `docker tag` it to the name in `images.env`.

## Roll back

```bash
scripts/deploy.sh rollback user@your-server
```

It starts the previous release's images (`CARSHENAS_PREVIOUS_RELEASE` in `release.env`; the images are on the server). **It does not roll the database back.** Migrations here are written to be applied while the old code still runs (the database skill's rules: expand, then contract), so the previous images usually work on the migrated database. When they do not, restore the release the update cut: `carshenas release restore <before-…> --live` (below), then roll back. A deploy that failed already went back by itself.

## Health and logs

- **Containers**: `carshenas status`. Each service has a healthcheck: PostgreSQL (`pg_isready`), the web app (`/api/health`: a real query through its role), the worker (`GET /health` on its own loopback: the database, the queue's schema and the runtime; a paused source is the worker doing its job), Caddy (its admin endpoint), the backup loop (it touches a file every five minutes). All restart by themselves after a crash or a reboot (`restart: unless-stopped`; Docker starts at boot on Ubuntu).
- **One address for an external monitor**: `GET https://demo.example.ir/api/probe`. **200 only when the site, the worker and the data are healthy**, otherwise 503 with the reasons:

  ```json
  { "status": "ok", "problems": [],
    "site": { "status": "ok", "release": "20261004-1030-421d298", "migration": "20261004000070" },
    "worker": { "status": "ok", "lastSignAt": "…", "ageMinutes": 12 },
    "data": { "status": "live", "ageMinutes": 3, "activeListings": 4210, "shownListings": 3500, "sources": [{ "id": "divar", "state": "live" }] },
    "valuation": { "status": "ok", "asOfDate": "2026-10-04", "ageDays": 0 } }
  ```

  `problems` names what is wrong: `database_unreachable` (status `down`), `worker_late` (no sign of life for 90 minutes: the worker writes a freshness measurement every hour and stamps each listing it reads), `worker_unknown` (no sign yet), `data_not_updating` (the source is paused or stopped), `data_delayed` (enabled, nothing read for an hour), `valuation_old`, `valuation_none`. Right after a deploy, until a source is enabled and read, the probe says `degraded`: that is true. It exposes no address, error, account or stop reason. Point any HTTP monitor at it (one that runs inside Iran as well as one abroad); `/admin/worker` has the exact heartbeat.
- **Logs** rotate: five files of ten megabytes per container (`json-file` in `compose.yaml`), so they cannot fill the disk. The web app's and the worker's lines are JSON (`docs/runbooks/logs-and-errors.md`: find a «کد پیگیری», a trace); read them with `carshenas logs web | jq -R 'fromjson? // empty | select(.level == "error")'`. Caddy writes one JSON line per request with the visitor's address cut to its network and no cookie. PostgreSQL logs its slow statements and locks (`log_min_duration_statement`); `auto_explain` is off in production because a plan shows the constants a query ran with.

## The first day

1. `carshenas status`: every container healthy; `carshenas release list`: one `nightly` already (the backup service cuts one at its first start when none is under 26 hours old, which proves the backup works).
2. The probe says `degraded` (`data_not_updating`, `worker_unknown`, `valuation_none`): the sources arrive **paused**. Enabling Divar is your decision (ADR-0008, ADR-0017). Sign in as the superadmin and press «ازسرگیری خزش» on `/admin/sources`, or without the screen: `scripts/deploy.sh ssh user@host psql --superuser -c "select change_source_state('divar', 'paused', null, 'enabled', (select id from account where username = '<superadmin>'))"`. The crawler's name is in `.env`; its pace and daily budget are in the database (`docs/runbooks/worker.md`).
3. **First sweep.** Discovery runs every 15 minutes by itself, and the tracked models' sweep at 02:30 Tehran time; to start it now: `carshenas run pnpm sweep:divar tracked` (`untracked` is the weekly one). Follow `carshenas logs worker -f` and `/admin/worker`; `carshenas run pnpm catalogue:sync` brings the catalogue up to date at once (it runs every ten minutes anyway).
4. **First valuation run.** Market values need comparables read over days: the run happens daily at 04:00 Tehran time. After a few thousand listings have details, run it by hand: `carshenas run pnpm valuation:run`, and `pnpm valuation:evaluate` for the accuracy report.
5. **The search table** fills by itself (the worker queues a rebuild at start when it is empty, and refreshes it every minute); to force it: `carshenas run pnpm search:rebuild`. Search shows only listings seen in the last 48 hours, so an empty result right after a restore of an old release is the window, not a fault (`docs/runbooks/worker.md`, "The search table").
6. The probe turns `ok` when a source has been read within the hour, the worker has signed within 90 minutes and a valuation from today or yesterday exists.
7. Register the typeface's web licence for the domain (ADR-0015), open the site from an Iranian network (above), put the probe in a monitor, and copy a release off the server (`scripts/deploy.sh pull-releases user@host`).

## If the crawler is blocked

The worker stops a source on a 401, 403, a challenge or an empty answer, and cools a lane down on a 429 (ADR-0008, ADR-0018): `carshenas logs worker | grep 'source stopped'`, and the superadmin's `/admin/sources` shows the state. **Read the evidence before anything else** (`docs/runbooks/worker.md`, "Act on a source or a job"); never work around a block, never resume to see whether it holds. The site goes on, dated: its listings keep their last data and the pages say the source is not being updated (ADR-0017 point 9). The probe says `data_not_updating`.

For a demo recorded on a day the crawl is blocked, a release is the fallback: restore a recent one into a **scratch** database and point a second web container at it, or restore it live (below). Search shows only listings seen within 48 hours, so cut the release the day before.

## Backups and releases

A **release** is a named, dated cut of everything in the database: one `pg_dump` in custom format (`carshenas.dump`), a `manifest.json`, and `SHA256SUMS`, in a folder named `<UTC time>-<name>` such as `20261004T143000Z-before-demo` (CS-49, ADR-0017 point 7). The manifest records the cut time, the build running (`codeRelease`), the newest migration, the dump's size and checksum, **counts per source and per model** (listings, active listings, snapshots, fetches), the counts of 16 tables a restore counts again, **the versions the rows were derived with** (the parser per source, the snapshot format, the valuation method and its latest run, the prompts per task and the evaluations) and `containsAccounts: true`. Releases hold the sources' content and buyers' accounts (password hashes included): **outside the repository, never committed, never shared** (`~/carshenas/releases` on the server; `~/carshenas-releases` on your computer; the folder is yours, and `RELEASES_DIR` can move it to another disk).

The cut reads one snapshot of the database, so the dump and the manifest describe exactly the same rows while the crawler goes on writing.

| Command (on the server, `carshenas …`) | |
|---|---|
| `release cut [--name before-demo]` | A release now |
| `release list`, `release verify R` | The folder's releases; checksum and archive read back |
| `release restore R [--into DB]` | Into a **new, empty** database (default `carshenas_restore`), created the way the real one is. Every source is **paused** in the copy, the planner's statistics are rebuilt, and the counts are compared with the manifest: it fails when one differs. The web app then runs on it without a crawl: `DATABASE_URL=…/carshenas_restore` |
| `release restore R --live` | Replaces the live database: the web app and the worker stop, the live database is **renamed** (`carshenas_replaced_<time>`, never dropped: you drop it when sure), R is restored under the live name with each source's crawl state as it was, pending migrations are applied, everything starts. A failed restore puts the old database back |
| `backup` | What the nightly loop runs: `release cut --kind nightly --keep $BACKUP_KEEP` |

**Nightly**: the `backup` service sleeps until `BACKUP_AT` (default 01:30, Tehran time), cuts a `…-nightly` release with the same script and keeps the newest `BACKUP_KEEP` (14); named releases and the `before-…` ones a deploy cuts (newest five kept) are not touched. A night that fails is logged (`carshenas logs backup`) and the next one tries again. Refused when the disk lacks room for the dump. A backup on the same disk as the database does not survive the disk: `scripts/deploy.sh pull-releases user@host` copies the releases you do not have yet to your computer.

**Locally** (CS-49): `pnpm release:cut [--name N]`, `pnpm release:list` and `pnpm release:restore <release> [--into DB]` run the same script inside the local PostgreSQL container, into `~/carshenas-releases`. A release cut on the server restores locally, and the other way round.

**A new server after a disaster**: `scripts/deploy.sh user@new-server` (its database starts empty and migrated), copy a release folder into `~/carshenas/releases/` (`scripts/deploy.sh pull-releases` copies the other way), then `carshenas release restore <release> --live`.

CS-49's third criterion, evaluation and backtest reports naming the release they ran on, is not part of this kit.

## Secrets

Live in `~/carshenas/.env` (mode 600) and nowhere else: not in an image, not in the repository, not in a log (the logger redacts what it recognises, `docs/runbooks/logs-and-errors.md`).

- `carshenas secrets rotate NAME` for `CARSHENAS_AUTH_KEY` (the sign-in throttle's counters and the device cookies are forgotten; nobody is signed out) or any `CARSHENAS_*_PASSWORD` / `POSTGRES_PASSWORD`: a new random value, set in PostgreSQL through standard input and in `.env`, and what uses it is restarted.
- The Metis key, the crawler's contact, the domain: edit `.env` on the server (`nano ~/carshenas/.env`), then `carshenas up`. Keep a value on one line, with no `"`, `$` or backtick.
- Switches that spend Metis credit stay off until you set them: `EXTRACTION_SCHEDULED=1` (the worker reads listing texts every five minutes, up to US$10 a Tehran day) and `SEARCH_UNDERSTANDING_AI=1` (the search box may ask a model, within a daily cap and a visitor limit). Nothing in the repository turns them on.
- If a secret may have leaked: rotate it, then `carshenas release list` for what else lived on the server; the superadmin's password: `carshenas superadmin <name> --reset-password`.

## Settings

Every variable, what it is and its default: `deploy/example.production.env`. The ones that matter most: `CARSHENAS_SITE_ADDRESS`, `CARSHENAS_TLS_MODE`, `ACME_EMAIL`, `CARSHENAS_UNLISTED`, `CRAWLER_USER_AGENT`, `METIS_API_KEY`, `BACKUP_AT`, `BACKUP_KEEP`, `WEB_MEMORY`, `WORKER_MEMORY`. A server resized later: `carshenas tune && carshenas restart postgres`.

## Continuous integration (CS-38)

- **`.github/workflows/ci.yml`** runs on every push and pull request: `pnpm check` (lint, the lint's own self-test, migration lint, hook tests, typecheck, unit and schema tests, formatting) with the pnpm store, Next.js and TypeScript caches, on Node 22, with the full history so the check that refuses edits to merged migrations can compare with `main`; and a second job that keeps this kit valid: `shellcheck` on its scripts, `actionlint` on every workflow, `docker compose config` on the compose file and `caddy validate` in each mode. It needs no typeface, no database and no Docker for the first job (CS-3, CS-4).
- **The browser tests** (`e2e.yml`, `gorilla-nightly.yml`) need the typeface and a database, which they now get (`.github/actions/prepare-e2e`: the typeface from secrets, a PostgreSQL service migrated by `e2e/scripts/ci-database.mjs`, the settings the app reads). **They stay skipped until the repository variable `E2E_ENABLED` is `true`.** The typeface sits in the repository's secrets in base64, in parts of at most 48 KB:

  ```bash
  base64 -w0 apps/web/src/components/layout/fonts/YekanBakh-VF.woff2 | split -b 46000 - /tmp/yekan-part-
  gh secret set YEKAN_BAKH_B64_1 < /tmp/yekan-part-aa && gh secret set YEKAN_BAKH_B64_2 < /tmp/yekan-part-ab   # a third, _3, if split made one
  gh variable set YEKAN_BAKH_SHA256 --body "$(sha256sum apps/web/src/components/layout/fonts/YekanBakh-VF.woff2 | cut -d' ' -f1)"
  gh variable set E2E_ENABLED --body true
  shred -u /tmp/yekan-part-*
  ```

  The repository must stay private while its Actions artifacts hold Playwright traces, which record the typeface's response (`docs/runbooks/licensed-font.md`).
- **Switching Actions on** (it is off since CS-36): `gh api -X PUT repos/youridol544/carshenas/actions/permissions -F enabled=true`. From then on `ci.yml` runs on every push. CS-38's criterion 3 (the e2e workflow green on a pull request) needs a GitHub run with the secrets above: it has not run.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `this user cannot use docker` | The user is not in the `docker` group, or has not logged in again |
| The build says the licensed typeface is missing | `docs/runbooks/licensed-font.md`; the file is never committed |
| `docker pull` fails on your computer | Docker Hub from Iran: pull through a mirror and `docker tag` (above), or `NODE_IMAGE=` for the app images |
| The deploy stops at "PostgreSQL did not become healthy" | `carshenas logs postgres`; a password changed in `.env` after the first start is not applied to the roles: `carshenas secrets rotate …` does both |
| `the worker did not become healthy` | `carshenas logs worker`: `METIS_API_KEY is not set`, a wrong `CRAWLER_USER_AGENT`, a database that is not migrated |
| The browser shows a warning | The mode is `internal`: expected once. In `auto`, `carshenas logs caddy` says why no certificate was made (the domain does not point here, port 80 or 443 is closed, the authority is unreachable): use `manual` |
| `502` and «Bad Gateway» | The web app is starting or down: `carshenas status`; the proxy answers 502 with noindex until it is back |
| Search shows no cars | The 48-hour window (a restored old release, or a paused crawl); the probe's `data` part says which |
| `no space left on device` | `docker system df`; old releases in `releases/` (`carshenas release list`); images beyond the last three are removed by a deploy |
| Sign-in does not stick | The page was opened over plain http: cookies are Secure; use https |
| `carshenas: command not found` | It is `~/carshenas/bin/carshenas`; `scripts/deploy.sh ssh user@host …` finds it |

## What CS-119 did not run

On 2026-10-04, from a computer with no server: the images were built once and the stack was run in a scratch compose project (no volumes): PostgreSQL, the migrations, a release cut and restored into an empty database, the web app and the worker started on the restored data. Not run, because they need what only the owner has: a first deploy to a real server over ssh, a Let's Encrypt certificate (`auto`, `acme-ip`), the site opened from an Iranian network, a GitHub Actions run (CS-38 criterion 3), and the typeface secrets. The first deploy is also the first test of those.
