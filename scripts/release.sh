#!/usr/bin/env bash
# Cut and restore releases of the LOCAL database (CS-49's useful minimum, delivered with CS-119): a named, dated cut of
# everything in it, kept outside the repository, and a restore into a new empty database where the web app and the
# evaluations run without any crawl. It is the server's own script (deploy/ops/release.sh) run inside the local PostgreSQL
# container, so a release cut here restores there and the other way round. docs/runbooks/deploy.md, "Backups and releases".
#
#   pnpm release:cut [--name NAME]               cut the local database into ~/carshenas-releases/<timestamp>-<name>
#   pnpm release:list                            the releases there
#   pnpm release:restore <release> [--into DB]   restore into a new database (default carshenas_restore) of the container,
#                                                with every source paused; then: DATABASE_URL=…/DB pnpm dev
#
# CARSHENAS_RELEASES_DIR changes where releases live (default ~/carshenas-releases). The container must run: pnpm db:up.
set -euo pipefail
cd "$(dirname "$0")/.."

RELEASES_DIR=${CARSHENAS_RELEASES_DIR:-$HOME/carshenas-releases}
IN_CONTAINER_OPS=/tmp/carshenas-ops
IN_CONTAINER_RELEASES=/tmp/carshenas-releases

say() { printf '[release] %s\n' "$*" >&2; }
fail() {
  printf '[release] FAILED: %s\n' "$*" >&2
  exit 1
}

docker compose exec -T postgres pg_isready --host=127.0.0.1 --quiet </dev/null 2>/dev/null ||
  fail "the PostgreSQL container is not running: pnpm db:up"

# The same files the server runs, copied in on every call, so the script and the database server are one version.
install_ops() {
  docker compose exec -T postgres mkdir -p "$IN_CONTAINER_OPS" "$IN_CONTAINER_RELEASES" </dev/null
  docker compose cp deploy/ops/release.sh "postgres:$IN_CONTAINER_OPS/release.sh" >/dev/null
  docker compose cp db/bootstrap/create-database.psql "postgres:$IN_CONTAINER_OPS/create-database.psql" >/dev/null
}

# release.sh as the container's superuser over its socket, which trusts local connections.
in_container() {
  docker compose exec -T -e PGUSER=postgres -e RELEASES_DIR="$IN_CONTAINER_RELEASES" \
    -e CARSHENAS_RELEASE="$(git rev-parse --short=12 HEAD 2>/dev/null || echo local)" \
    postgres bash "$IN_CONTAINER_OPS/release.sh" "$@"
}

command=${1:-}
[ $# -gt 0 ] && shift
case $command in
  cut)
    install_ops
    id=$(in_container cut --kind release "$@")
    umask 077
    mkdir -p "$RELEASES_DIR"
    docker compose cp "postgres:$IN_CONTAINER_RELEASES/$id" "$RELEASES_DIR/" >/dev/null
    docker compose exec -T postgres rm -rf "$IN_CONTAINER_RELEASES/$id" </dev/null
    say "release $id is in $RELEASES_DIR/$id (outside the repository; it holds listings and accounts: never commit or share it)"
    ;;
  list)
    [ -d "$RELEASES_DIR" ] || fail "no releases yet in $RELEASES_DIR: pnpm release:cut"
    for dir in "$RELEASES_DIR"/[0-9]*Z*; do
      if [ -f "$dir/manifest.json" ]; then printf '%s\n' "$(basename "$dir")"; fi
    done
    ;;
  restore)
    release=${1:?usage: pnpm release:restore <release> [--into DB]}
    shift
    [ -d "$RELEASES_DIR/$release" ] || fail "$RELEASES_DIR/$release is not a release folder (pnpm release:list)"
    install_ops
    docker compose cp "$RELEASES_DIR/$release" "postgres:$IN_CONTAINER_RELEASES/" >/dev/null
    trap 'docker compose exec -T postgres rm -rf "$IN_CONTAINER_RELEASES/$release" </dev/null' EXIT
    in_container restore "$release" "$@"
    ;;
  *)
    sed -n '2,13p' "$0" >&2
    exit 2
    ;;
esac
