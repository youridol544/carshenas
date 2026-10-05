#!/usr/bin/env bash
# Deploy Carshenas to your own Linux server with Docker (CS-119; CS-37's deploy is this, run by the owner on a server of
# their choice). Everything is built on THIS computer and shipped over ssh with `docker save | docker load`: the server
# never pulls an image or installs a package (a server in Iran may not reach Docker Hub, and npm can be slow there).
# docs/runbooks/deploy.md is the whole story; this is the one command.
#
#   scripts/deploy.sh [deploy] user@host     the first deploy (asks for what only you know), or an update to this commit
#   scripts/deploy.sh rollback user@host     back to the previous release
#   scripts/deploy.sh status user@host       containers, health and the probe
#   scripts/deploy.sh ssh user@host <command...>   run the server's `carshenas` command: ssh user@host superadmin pedram
#   scripts/deploy.sh pull-releases user@host [RELEASE...]   copy the server's releases (backups) to ~/carshenas-releases
#   scripts/deploy.sh build                  only build the two images here
#
# Settings, from the environment: DEPLOY_HOST (instead of user@host), DEPLOY_DIR (a folder in the server user's home,
# default carshenas), DEPLOY_PORT (ssh port), DEPLOY_PLATFORM (linux/amd64 or linux/arm64; default: what the server runs),
# DEPLOY_SKIP_BACKUP=1 (skip the release cut before a deploy), NODE_IMAGE and NPM_REGISTRY (mirrors for the builds), and for
# the first deploy CARSHENAS_SITE_ADDRESS, CARSHENAS_TLS_MODE, ACME_EMAIL, DEPLOY_CERT and DEPLOY_KEY (manual mode),
# CRAWLER_CONTACT, METIS_API_KEY and DEPLOY_SUPERADMIN (otherwise it asks).
set -euo pipefail
SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
cd "$(dirname "$0")/.."

say() { printf '\n[deploy] %s\n' "$*" >&2; }
note() { printf '[deploy] %s\n' "$*" >&2; }
fail() {
  printf '\n[deploy] FAILED: %s\n' "$*" >&2
  exit 1
}

FONT=apps/web/src/components/layout/fonts/YekanBakh-VF.woff2

# ---- Arguments -----------------------------------------------------------------------------------------------------------

command=deploy
case ${1:-} in
  deploy | rollback | status | ssh | pull-releases | build) command=$1; shift ;;
  -h | --help | help) awk 'NR == 1 { next } /^#/ { print; next } { exit }' "$SELF"; exit 0 ;;
esac
HOST=${DEPLOY_HOST:-}
if [ "$command" != build ] && [ $# -gt 0 ]; then
  HOST=$1
  shift
fi
if [ "$command" != build ] && [ -z "$HOST" ]; then
  fail "which server? scripts/deploy.sh $command user@host (or DEPLOY_HOST=user@host)"
fi
DEPLOY_DIR=${DEPLOY_DIR:-carshenas}

# One ssh connection serves every call (one password or passphrase prompt), and keeps itself alive through a long upload.
SSH_ARGS=(-o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ControlMaster=auto
  -o "ControlPath=${TMPDIR:-/tmp}/carshenas-ssh-%C" -o ControlPersist=15m)
[ -z "${DEPLOY_PORT:-}" ] || SSH_ARGS+=(-p "$DEPLOY_PORT")
# The command line is built here on purpose, quoted where it matters: what remote() is given runs on the server.
# shellcheck disable=SC2029
remote() { ssh "${SSH_ARGS[@]}" "$HOST" "$@"; }

ask() { # ask VARIABLE "question" [secret]: keeps a value already in the environment; otherwise asks, or fails without a terminal
  local name=$1 question=$2 secret=${3:-} answer=""
  [ -z "${!name:-}" ] || return 0
  [ -t 0 ] || fail "$name is needed: set it in the environment (there is no terminal to ask on)"
  if [ -n "$secret" ]; then
    read -r -s -p "$question: " answer
    printf '\n' >&2
  else
    read -r -p "$question: " answer
  fi
  printf -v "$name" '%s' "$answer"
}

# ---- Build ---------------------------------------------------------------------------------------------------------------

release_id() {
  local commit dirty=""
  if commit=$(git rev-parse --short=9 HEAD 2>/dev/null); then
    [ -z "$(git status --porcelain --untracked-files=no)" ] || dirty="-dirty"
  else
    commit=nogit
  fi
  printf '%s-%s%s' "$(date -u +%Y%m%d-%H%M)" "$commit" "$dirty"
}

build_images() {
  local release=$1 platform=$2
  [ -f "$FONT" ] || fail "the licensed typeface is missing ($FONT). It is never committed, and the web image needs it: docs/runbooks/licensed-font.md"
  command -v docker >/dev/null || fail "docker is not installed on this computer"
  local args=(--build-arg "CARSHENAS_RELEASE=$release")
  [ -z "$platform" ] || args+=(--platform "$platform")
  [ -z "${NODE_IMAGE:-}" ] || args+=(--build-arg "NODE_IMAGE=$NODE_IMAGE")
  [ -z "${NPM_REGISTRY:-}" ] || args+=(--build-arg "NPM_REGISTRY=$NPM_REGISTRY")
  say "Building carshenas-web:$release (the web app needs about 4 GB of free memory to build)"
  DOCKER_BUILDKIT=1 docker build "${args[@]}" -f deploy/docker/web.Dockerfile -t "carshenas-web:$release" .
  say "Building carshenas-worker:$release"
  DOCKER_BUILDKIT=1 docker build "${args[@]}" -f deploy/docker/worker.Dockerfile -t "carshenas-worker:$release" .
}

# DEPLOY_BUILD=server: build on the server instead, for an upload too slow to carry the images (about 700 MB; from an
# Iranian home line to an Iranian server, 30 KB/s on 2026-10-05). Only the commit's source goes up (`git archive`, without
# what .dockerignore leaves out anyway, about 5 MB) and the licensed typeface; the server builds from Iranian mirrors
# (NODE_IMAGE, NPM_REGISTRY) and pulls the two pinned images itself. Uncommitted changes are not sent.
build_on_server() {
  local release=$1 build=carshenas-build
  [ -f "$FONT" ] || fail "the licensed typeface is missing ($FONT). It is never committed, and the web image needs it: docs/runbooks/licensed-font.md"
  remote "docker buildx version >/dev/null 2>&1" || fail "the server needs BuildKit for docker build: sudo apt install -y docker-buildx"
  say "Sending the source of $(git rev-parse --short=9 HEAD) to the server, to build there (DEPLOY_BUILD=server)"
  remote "rm -rf ~/$build && mkdir -p ~/$build"
  git archive --format=tar HEAD -- . ':!docs' ':!backlog' ':!.claude' ':!.github' ':!e2e/tests' ':!e2e/site' ':!e2e/gorilla' ':!e2e/fixtures' |
    gzip -9 | remote "gunzip | tar -x -C ~/$build"
  remote "mkdir -p ~/$build/$(dirname "$FONT") && umask 077 && cat > ~/$build/$FONT" <"$FONT"
  local args="--build-arg CARSHENAS_RELEASE=$release"
  [ -z "${NODE_IMAGE:-}" ] || args+=" --build-arg NODE_IMAGE=$NODE_IMAGE"
  [ -z "${NPM_REGISTRY:-}" ] || args+=" --build-arg NPM_REGISTRY=$NPM_REGISTRY"
  say "Building carshenas-web:$release and carshenas-worker:$release on the server"
  remote "cd ~/$build && DOCKER_BUILDKIT=1 docker build $args -f deploy/docker/web.Dockerfile -t carshenas-web:$release . && DOCKER_BUILDKIT=1 docker build $args -f deploy/docker/worker.Dockerfile -t carshenas-worker:$release ." >&2 ||
    { remote "rm -rf ~/$build"; fail "the build on the server failed (above)"; }
  remote "rm -rf ~/$build"
  load_base_images
  local image
  for image in "$POSTGRES_IMAGE" "$CADDY_IMAGE"; do
    remote "docker image inspect '$image' >/dev/null 2>&1 || docker pull -q '$image'" >&2 ||
      fail "the server could not pull $image: give its Docker daemon a mirror (registry-mirrors in /etc/docker/daemon.json)"
  done
}

# The pins of the two images nobody here builds (deploy/images.env).
load_base_images() {
  # shellcheck disable=SC1091
  . deploy/images.env
}

ensure_local_image() {
  local image=$1 platform=$2
  docker image inspect "$image" >/dev/null 2>&1 && return 0
  say "Pulling $image on this computer"
  docker pull ${platform:+--platform "$platform"} "$image" ||
    fail "could not pull $image. From behind a mirror: docker pull <mirror>/<same path> && docker tag <mirror>/<same path> $image, then run this again"
}

# ---- The server ----------------------------------------------------------------------------------------------------------

server_dir() {
  if [[ $DEPLOY_DIR == /* ]]; then
    printf '%s' "$DEPLOY_DIR"
    return
  fi
  local home
  # $HOME is the server's, so it must reach the server unexpanded.
  # shellcheck disable=SC2016
  home=$(remote 'printf %s "$HOME"')
  printf '%s/%s' "$home" "$DEPLOY_DIR"
}

preflight() {
  say "Checking the server"
  local report
  report=$(remote 'bash -s' <<'REMOTE'
set -u
command -v docker >/dev/null 2>&1 || { echo "ERROR docker is not installed (docs/runbooks/deploy.md, \"The server\")"; exit 0; }
docker version --format '{{.Server.Version}}' >/dev/null 2>&1 || { echo "ERROR this user cannot use docker (add it to the docker group, then log in again)"; exit 0; }
docker compose version >/dev/null 2>&1 || { echo "ERROR the docker compose plugin is missing (Ubuntu: apt install docker-compose-v2)"; exit 0; }
echo "ARCH $(uname -m)"
echo "MEMORY $(( $(awk '/^MemTotal:/ { print $2 }' /proc/meminfo) / 1024 ))"
echo "DISK $(df -BG --output=avail "$HOME" | tail -n 1 | tr -dc 0-9)"
echo "DOCKER $(docker version --format '{{.Server.Version}}')"
echo "ADDRESS $(hostname -I 2>/dev/null | awk '{ print $1 }')"
REMOTE
  ) || fail "could not run commands on $HOST over ssh"
  local line value
  while IFS= read -r line; do
    value=${line#* }
    case $line in
      ERROR*) fail "the server: $value" ;;
      ARCH*) SERVER_ARCH=$value ;;
      MEMORY*) SERVER_MEMORY_MB=$value ;;
      DISK*) SERVER_DISK_GB=$value ;;
      ADDRESS*) SERVER_ADDRESS=$value ;;
      DOCKER*) note "docker $value on $HOST" ;;
    esac
  done <<<"$report"
  [ "${SERVER_MEMORY_MB:-0}" -ge 3500 ] || note "WARNING: ${SERVER_MEMORY_MB:-?} MB of memory: PostgreSQL, the web app and the worker want 4 GB, and 8 GB is comfortable"
  [ "${SERVER_DISK_GB:-0}" -ge 40 ] || note "WARNING: ${SERVER_DISK_GB:-?} GB free: the images, the database and a fortnight of nightly backups want 40 GB"
  case ${SERVER_ARCH:-} in
    x86_64) SERVER_PLATFORM=linux/amd64 ;;
    aarch64 | arm64) SERVER_PLATFORM=linux/arm64 ;;
    *) fail "the server runs ${SERVER_ARCH:-an unknown architecture}: only amd64 and arm64 are built" ;;
  esac
}

# Ships the images the server does not already have: the two app images always, the two pinned ones when their IDs differ.
ship_images() {
  local release=$1 platform=$2 image local_id remote_id
  local images=("carshenas-web:$release" "carshenas-worker:$release")
  load_base_images
  for image in "$POSTGRES_IMAGE" "$CADDY_IMAGE"; do
    ensure_local_image "$image" "$platform"
    local_id=$(docker image inspect --format '{{.Id}}' "$image")
    remote_id=$(remote docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true)
    if [ "$local_id" = "$remote_id" ]; then
      note "$image is on the server already"
    else
      images+=("$image")
    fi
  done
  say "Sending ${images[*]} (compressed, over ssh: no registry)"
  docker save "${images[@]}" | gzip -3 | remote 'gunzip | docker load' >&2
}

# The deployment folder as it must look on the server, made from files of this repository.
stage_kit() {
  local stage=$1
  mkdir -p "$stage/bin" "$stage/ops" "$stage/caddy" "$stage/postgres/init"
  cp deploy/compose.yaml deploy/images.env deploy/Caddyfile "$stage/"
  cp deploy/caddy/*.caddy "$stage/caddy/"
  cp deploy/bin/carshenas "$stage/bin/"
  cp deploy/ops/release.sh deploy/ops/backup-loop.sh "$stage/ops/"
  # The same SQL that makes the local database (db/bootstrap), so production's roles and database cannot drift from it.
  cp db/bootstrap/create-database.psql "$stage/ops/"
  cp db/bootstrap/10-roles.sql db/bootstrap/create-database.psql deploy/postgres/init/20-production-database.sh "$stage/postgres/init/"
  # db/postgresql.conf written for a 4 GB server; what `carshenas tune` derives for this one is read after it.
  { cat db/postgresql.conf; printf "\n# Derived for this server by 'carshenas tune' (deploy/bin/carshenas).\ninclude_if_exists = '/etc/postgresql/production.conf'\n"; } >"$stage/postgres/postgresql.conf"
  chmod +x "$stage/bin/carshenas" "$stage/ops/"*.sh
}

send_kit() {
  local dir=$1 stage
  stage=$(mktemp -d)
  stage_kit "$stage"
  say "Copying the deployment folder to $HOST:$dir"
  remote "mkdir -p '$dir' '$dir/releases' '$dir/certs'"
  tar -C "$stage" -czf - . | remote "tar -xzf - -C '$dir'"
  rm -rf "$stage"
}

# What only you know, for the first deploy: written into the server's .env over ssh (never into a file here, never into a
# command line another process could read), together with the secrets the server makes for itself.
first_settings() {
  local dir=$1
  say "First deploy: a few questions (nothing is stored on this computer)"
  if [ -z "${CARSHENAS_SITE_ADDRESS:-}" ]; then
    local server_address=${SERVER_ADDRESS:-}
    read -r -p "Domain visitors will type, pointing at this server (empty: use $server_address with a self-signed certificate): " CARSHENAS_SITE_ADDRESS || true
    CARSHENAS_SITE_ADDRESS=${CARSHENAS_SITE_ADDRESS:-$server_address}
  fi
  [ -n "${CARSHENAS_SITE_ADDRESS:-}" ] || fail "CARSHENAS_SITE_ADDRESS is needed: the domain, or the address of the server"
  if [[ $CARSHENAS_SITE_ADDRESS =~ ^[0-9.]+$ || $CARSHENAS_SITE_ADDRESS == *:* ]]; then
    CARSHENAS_TLS_MODE=internal
    note "An address and no domain: the certificate is Caddy's own, and browsers warn once (docs/runbooks/deploy.md, \"A domain, or only an address\")"
  else
    CARSHENAS_TLS_MODE=${CARSHENAS_TLS_MODE:-auto}
  fi
  if [ "$CARSHENAS_TLS_MODE" = auto ]; then
    ask ACME_EMAIL "An address Let's Encrypt may write to about the certificate"
    note "Your domain must point at ${SERVER_ADDRESS:-the server} and ports 80 and 443 must be open before the certificate can be made"
  fi
  if [ "$CARSHENAS_TLS_MODE" = cdn ]; then
    [ -n "${CARSHENAS_TRUSTED_PROXIES:-}" ] || fail "cdn mode needs CARSHENAS_TRUSTED_PROXIES: the CDN's edge ranges (ArvanCloud: https://www.arvancloud.ir/fa/ips.txt)"
    note "The CDN must forward to http://${SERVER_ADDRESS:-the server}:80; it makes the certificate"
  fi
  if [ "$CARSHENAS_TLS_MODE" = manual ]; then
    [ -n "${DEPLOY_CERT:-}" ] && [ -n "${DEPLOY_KEY:-}" ] || fail "manual mode needs DEPLOY_CERT=<fullchain.pem> and DEPLOY_KEY=<privkey.pem>"
    remote "umask 077; cat > '$dir/certs/fullchain.pem'" <"$DEPLOY_CERT"
    remote "umask 077; cat > '$dir/certs/privkey.pem'" <"$DEPLOY_KEY"
  fi
  ask CRAWLER_CONTACT "An email or address the crawler gives the sites it reads, so they can reach you (ADR-0008)"
  ask METIS_API_KEY "Metis API key (console.metisai.ir/api-keys; the worker will not start without one; nothing is spent unless you switch it on)" secret
  {
    printf 'CARSHENAS_SITE_ADDRESS=%s\n' "$CARSHENAS_SITE_ADDRESS"
    printf 'CARSHENAS_TLS_MODE=%s\n' "$CARSHENAS_TLS_MODE"
    [ -z "${ACME_EMAIL:-}" ] || printf 'ACME_EMAIL=%s\n' "$ACME_EMAIL"
    [ -z "${CARSHENAS_TRUSTED_PROXIES:-}" ] || printf 'CARSHENAS_TRUSTED_PROXIES="%s"\n' "$CARSHENAS_TRUSTED_PROXIES"
    printf 'CRAWLER_USER_AGENT="CarshenasBot/0.1 (+contact: %s)"\n' "$CRAWLER_CONTACT"
    printf 'METIS_API_KEY=%s\n' "$METIS_API_KEY"
  } | remote "'$dir/bin/carshenas' init-env"
}

# After a first deploy: the superadmin account (docs/runbooks/accounts.md), whose password is shown once.
first_superadmin() {
  local dir=$1 name=${DEPLOY_SUPERADMIN:-}
  if [ -z "$name" ] && [ -t 0 ]; then
    read -r -p "Username for the superadmin (the owner's account; its password is shown once): " name || true
  fi
  if [ -z "$name" ]; then
    note "No superadmin was made. Make one: scripts/deploy.sh ssh $HOST superadmin <username>"
    return
  fi
  say "Making the superadmin $name: copy the password it prints now, it is not stored anywhere"
  remote -t "'$dir/bin/carshenas' superadmin '$name'" || note "Could not make it: scripts/deploy.sh ssh $HOST superadmin $name"
}

# From this computer, as a visitor would: does it answer, is it unlisted, does the probe say what is wrong.
verify_from_here() {
  local base="https://${CARSHENAS_SITE_ADDRESS:-}" insecure=()
  [ -n "${CARSHENAS_SITE_ADDRESS:-}" ] || return 0
  [ "${CARSHENAS_TLS_MODE:-}" != internal ] || insecure=(-k)
  command -v curl >/dev/null || return 0
  say "Checking $base from this computer (the first certificate can take a minute; a miss here is not a failed deploy)"
  local code headers
  code=$(curl -sS "${insecure[@]}" -o /dev/null -m 20 -w '%{http_code}' "$base/api/health" 2>&1 || true)
  note "GET /api/health: $code"
  headers=$(curl -sSI "${insecure[@]}" -m 20 "$base/" 2>/dev/null || true)
  if grep -qi '^x-robots-tag:.*noindex' <<<"$headers"; then
    note "noindex: yes"
  else
    note "noindex: NOT SEEN (is CARSHENAS_UNLISTED 1? did the page answer?)"
  fi
  note "GET /robots.txt: $(curl -sS "${insecure[@]}" -m 20 "$base/robots.txt" 2>/dev/null | tr '\n' ' ')"
}

cmd_deploy() {
  preflight
  local dir platform release first=0
  dir=$(server_dir)
  platform=${DEPLOY_PLATFORM:-$SERVER_PLATFORM}
  release=$(release_id)
  if ! remote "test -f '$dir/.env'"; then first=1; fi

  if [ "${DEPLOY_BUILD:-here}" = server ]; then
    build_on_server "$release"
  else
    build_images "$release" "$platform"
    ship_images "$release" "$platform"
  fi
  send_kit "$dir"
  if [ "$first" -eq 1 ]; then
    first_settings "$dir"
  else
    note "The server has its .env already: its settings and secrets are not touched"
    CARSHENAS_SITE_ADDRESS=$(remote "grep -E '^CARSHENAS_SITE_ADDRESS=' '$dir/.env' | tail -n 1 | cut -d= -f2-" || true)
    CARSHENAS_TLS_MODE=$(remote "grep -E '^CARSHENAS_TLS_MODE=' '$dir/.env' | tail -n 1 | cut -d= -f2-" || true)
  fi

  say "Switching the server to $release"
  local flags=""
  [ -z "${DEPLOY_SKIP_BACKUP:-}" ] || flags="--no-backup"
  remote -t "'$dir/bin/carshenas' deploy-release '$release' $flags"
  if [ "$first" -eq 1 ]; then first_superadmin "$dir"; fi
  verify_from_here
  say "Done: $release is running on $HOST."
  note "Next: docs/runbooks/deploy.md, \"First day\": enable the source as the superadmin, then watch carshenas status."
}

cmd_pull_releases() {
  local dir names=("$@") name target=${CARSHENAS_RELEASES_DIR:-$HOME/carshenas-releases}
  dir=$(server_dir)
  umask 077
  mkdir -p "$target"
  if [ "${#names[@]}" -eq 0 ]; then
    mapfile -t names < <(remote "ls -1 '$dir/releases' | grep -E '^[0-9]{8}T[0-9]{6}Z'")
  fi
  for name in "${names[@]}"; do
    if [ -f "$target/$name/manifest.json" ]; then
      note "$name is here already"
      continue
    fi
    say "Copying $name to $target"
    mkdir -p "$target/$name"
    remote "tar -C '$dir/releases/$name' -cf - ." | tar -C "$target/$name" -xf -
  done
  note "Releases are in $target: keep them outside any repository, they hold the sources' content and buyers' accounts"
}

case $command in
  build)
    release=$(release_id)
    build_images "$release" "${DEPLOY_PLATFORM:-}"
    note "built carshenas-web:$release and carshenas-worker:$release"
    ;;
  deploy) cmd_deploy ;;
  rollback) remote -t "'$(server_dir)/bin/carshenas' rollback" ;;
  status) remote -t "'$(server_dir)/bin/carshenas' status" ;;
  ssh)
    [ $# -gt 0 ] || fail "ssh user@host <command...>, for example: superadmin pedram, or psql"
    tty=()
    [ -t 0 ] && tty=(-t)
    # shellcheck disable=SC2029
    remote "${tty[@]}" "'$(server_dir)/bin/carshenas' $(printf '%q ' "$@")"
    ;;
  pull-releases) cmd_pull_releases "$@" ;;
esac
