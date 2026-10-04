#!/usr/bin/env bash
# Cut, list, verify, restore and prune releases of the Carshenas database (CS-119; the useful minimum of CS-49, ADR-0017
# point 7). A release is a named, dated cut of everything in the database: one pg_dump in custom format, a manifest
# that says what it holds (counts per source and per model, the versions of the parser, the valuation and the prompts,
# the migration, the cut time) and a checksum. Releases hold what the sources published and the buyers' accounts, so
# they are kept outside the repository and never committed.
#
#   release.sh cut      [--name NAME] [--kind release|nightly|pre-deploy] [--keep N] [--database DB]
#   release.sh list
#   release.sh verify   RELEASE
#   release.sh restore  RELEASE [--into DB] [--keep-sources]
#   release.sh prune    --kind KIND --keep N
#
# It runs inside the PostgreSQL 18 image, as a client of the server the standard PG* variables name (the backup service
# of deploy/compose.yaml, or the local container through scripts/release.sh), so pg_dump and pg_restore are the
# server's own major version. Settings: RELEASES_DIR (default /releases), DATABASE (default carshenas),
# CARSHENAS_RELEASE (the build that runs, written into the manifest).
set -euo pipefail

RELEASES_DIR=${RELEASES_DIR:-/releases}
DATABASE=${DATABASE:-carshenas}
OPS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# The folder a cut is written into until it is whole (see cmd_cut); a global, so the trap that clears it can always see it.
WORK_DIR=""

say() { printf '[release] %s\n' "$*" >&2; }
fail() {
  printf '[release] FAILED: %s\n' "$*" >&2
  exit 1
}

psql_q() { psql --no-psqlrc --quiet --no-align --tuples-only -v ON_ERROR_STOP=1 "$@"; }

# A release's folder: the exact name, or the one release whose name starts with what was typed.
find_release() {
  local wanted=$1 matches=() dir
  [[ $wanted =~ ^[0-9]{8}T[0-9A-Za-z.-]*$ ]] || fail "a release is named like 20261004T143000Z-before-demo, or starts like it (carshenas release list)"
  for dir in "$RELEASES_DIR/$wanted"*; do
    [ -f "$dir/manifest.json" ] && matches+=("$dir")
  done
  [ "${#matches[@]}" -ge 1 ] || fail "no release starts with $wanted in $RELEASES_DIR"
  for dir in "${matches[@]}"; do
    [ "$(basename "$dir")" = "$wanted" ] && { printf '%s\n' "$dir"; return; }
  done
  [ "${#matches[@]}" -eq 1 ] || fail "$wanted matches ${#matches[@]} releases: $(printf '%s ' "${matches[@]##*/}")"
  printf '%s\n' "${matches[0]}"
}

# A top-level string of the manifest (jsonb_pretty indents it by four spaces).
manifest_value() { sed -n "s/^    \"$2\": \"\\(.*\\)\",\?\$/\\1/p" "$1/manifest.json" | head -n 1; }

# The disk must hold the dump: half the database's size and a margin is more than a compressed dump takes.
check_space() {
  local database=$1 size avail
  size=$(psql_q --dbname "$database" --command "SELECT pg_database_size(current_database())")
  avail=$(df --output=avail -B1 "$RELEASES_DIR" | tail -n 1 | tr -d ' ')
  if [ "$avail" -lt $((size / 2 + 500 * 1024 * 1024)) ]; then
    fail "$RELEASES_DIR has $((avail / 1024 / 1024)) MB free and the database is $((size / 1024 / 1024)) MB: free some space or move RELEASES_DIR"
  fi
}

cmd_cut() {
  local name="" kind=release keep="" database=$DATABASE
  while [ $# -gt 0 ]; do
    case $1 in
      --name) name=${2:?--name needs a value}; shift 2 ;;
      --kind) kind=${2:?--kind needs a value}; shift 2 ;;
      --keep) keep=${2:?--keep needs a value}; shift 2 ;;
      --database) database=${2:?--database needs a value}; shift 2 ;;
      *) fail "unknown option $1" ;;
    esac
  done
  [[ $kind =~ ^(release|nightly|pre-deploy)$ ]] || fail "--kind is release, nightly or pre-deploy"
  [[ -z $name || $name =~ ^[a-z0-9][a-z0-9.-]{0,60}$ ]] || fail "a name is lower-case letters, digits, dots and hyphens, like before-demo"
  [[ -z $keep || $keep =~ ^[1-9][0-9]*$ ]] || fail "--keep is a whole number above zero"
  [[ -z $keep || $kind != release ]] || fail "--keep is for nightly and pre-deploy cuts: a named release stays until you delete it"

  umask 077
  mkdir -p "$RELEASES_DIR"
  check_space "$database"
  local id dir work
  id="$(date -u +%Y%m%dT%H%M%SZ)${name:+-$name}"
  dir="$RELEASES_DIR/$id"
  work="$RELEASES_DIR/.cutting-$id"
  [ ! -e "$dir" ] || fail "$id exists already"
  mkdir "$work"
  WORK_DIR=$work
  # A cut that stops halfway leaves nothing behind that could be taken for a release.
  trap '[ -z "$WORK_DIR" ] || rm -rf -- "$WORK_DIR"' EXIT

  say "cutting $id from $database"
  # One session holds a snapshot while pg_dump (another process) and the manifest read the very same one, so the
  # manifest describes exactly what the dump holds, whatever the crawler writes meanwhile.
  SNAPSHOT_FILE="$work/.snapshot" DUMP_FILE="$work/carshenas.dump" DUMP_DATABASE="$database" \
    psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 --dbname "$database" \
    -v snapshot_file="$work/.snapshot" -v manifest_file="$work/manifest.json" \
    -v release_name="$id" -v release_kind="$kind" -v code_release="${CARSHENAS_RELEASE:-unknown}" <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT pg_export_snapshot() AS snapshot, now() AS cut_at \gset
\o :snapshot_file
\qecho :snapshot
\o
\! pg_dump --format=custom --compress=6 --no-owner --snapshot="$(cat "$SNAPSHOT_FILE")" --file="$DUMP_FILE" "$DUMP_DATABASE"
\if :SHELL_ERROR
  DO $$ BEGIN RAISE EXCEPTION 'pg_dump failed'; END $$;
\endif
\set dump_bytes `stat -c %s "$DUMP_FILE"`
\set dump_sha256 `sha256sum "$DUMP_FILE" | cut -d' ' -f1`
-- The manifest is the JSON alone: no header, no row count, no table borders.
\pset format unaligned
\pset tuples_only on
\pset footer off
\o :manifest_file
SELECT jsonb_pretty(jsonb_build_object(
  'format', 1,
  'name', :'release_name',
  'kind', :'release_kind',
  'cutAt', to_char(:'cut_at'::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'database', current_database(),
  'postgres', current_setting('server_version'),
  'migration', (SELECT max(version) FROM public.schema_migrations),
  'codeRelease', :'code_release',
  'dump', jsonb_build_object('file', 'carshenas.dump', 'bytes', :dump_bytes::bigint, 'sha256', :'dump_sha256'),
  'containsAccounts', true,
  'counts', jsonb_build_object(
    -- What a restore counts again to prove the dump came back whole.
    'tables', (
      SELECT jsonb_object_agg(t.name,
        (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', t.name), false, true, '')))[1]::text::bigint)
      FROM (VALUES ('source'), ('make'), ('model'), ('trim'), ('listing'), ('snapshot'), ('fetch_log'),
        ('listing_price_event'), ('listing_photo'), ('crawl_run'), ('valuation_run'), ('listing_valuation'),
        ('ai_answer'), ('extraction'), ('search_document'), ('account')) AS t(name)),
    'sources', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'source', s.id, 'crawlState', s.crawl_state,
        'listings', coalesce(l.total, 0), 'activeListings', coalesce(l.active, 0),
        'snapshots', coalesce(n.total, 0), 'fetches', coalesce(f.total, 0), 'lastSeenAt', l.last_seen) ORDER BY s.id), '[]')
      FROM public.source s
      LEFT JOIN (SELECT source_id, count(*) AS total, count(*) FILTER (WHERE status = 'active') AS active,
                        max(last_seen_at) AS last_seen FROM public.listing GROUP BY 1) l ON l.source_id = s.id
      LEFT JOIN (SELECT li.source_id, count(*) AS total FROM public.snapshot sn
                 JOIN public.listing li ON li.id = sn.listing_id GROUP BY 1) n ON n.source_id = s.id
      LEFT JOIN (SELECT source_id, count(*) AS total FROM public.fetch_log GROUP BY 1) f ON f.source_id = s.id),
    'models', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'make', ma.slug, 'model', mo.slug, 'listings', c.total, 'activeListings', c.active)
        ORDER BY c.total DESC, ma.slug, mo.slug), '[]')
      FROM (SELECT model_id, count(*) AS total, count(*) FILTER (WHERE status = 'active') AS active
            FROM public.listing WHERE model_id IS NOT NULL GROUP BY 1) c
      JOIN public.model mo ON mo.id = c.model_id
      JOIN public.make ma ON ma.id = mo.make_id),
    'listingsWithoutModel', (SELECT count(*) FROM public.listing WHERE model_id IS NULL)
  ),
  'versions', jsonb_build_object(
    -- What the stored rows were derived with: the parser per source, the snapshot format, the valuation method, the prompts.
    'parser', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('source', source_id, 'parserVersion', parser_version, 'listings', n)
        ORDER BY source_id, parser_version), '[]')
      FROM (SELECT source_id, parser_version, count(*) AS n FROM public.listing GROUP BY 1, 2) p),
    'snapshotFormat', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('canonicalVersion', canonical_version, 'snapshots', n)
        ORDER BY canonical_version), '[]')
      FROM (SELECT canonical_version, count(*) AS n FROM public.snapshot GROUP BY 1) c),
    'valuation', jsonb_build_object(
      'methodVersions', (SELECT coalesce(jsonb_agg(DISTINCT method_version ORDER BY method_version), '[]') FROM public.valuation_run),
      'latestSucceededRun', (
        SELECT to_jsonb(r) FROM (
          SELECT as_of_date, method_version, comparable_count, valued_count, rated_count, finished_at
          FROM public.valuation_run WHERE status = 'succeeded' ORDER BY as_of_date DESC, method_version DESC LIMIT 1) r)),
    'prompts', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('task', task, 'promptVersion', prompt_version, 'answers', n)
        ORDER BY task, prompt_version), '[]')
      FROM (SELECT task, prompt_version, count(*) AS n FROM public.ai_answer GROUP BY 1, 2) a),
    'evaluations', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('task', task, 'promptVersion', prompt_version, 'model', model,
        'evaluatedOn', evaluated_on) ORDER BY task, evaluated_on, model), '[]')
      FROM public.ai_evaluation)
  )
));
\o
COMMIT;
SQL

  # What a person or a restore reads first: the archive reads back, and a checksum to compare with later.
  pg_restore --list "$work/carshenas.dump" >/dev/null || fail "the dump cannot be read back"
  (cd "$work" && sha256sum carshenas.dump manifest.json >SHA256SUMS)
  rm -f "$work/.snapshot"
  mv "$work" "$dir"
  WORK_DIR=""
  chmod -R go-rwx "$dir"
  say "cut $id: $(du -h "$dir/carshenas.dump" | cut -f1) in $dir"
  printf '%s\n' "$id"
  [ -z "$keep" ] || cmd_prune --kind "$kind" --keep "$keep"
}

cmd_list() {
  local dir found=0
  printf '%-34s %-10s %-22s %-16s %8s\n' RELEASE KIND CUT-AT MIGRATION SIZE
  for dir in "$RELEASES_DIR"/[0-9]*Z*; do
    [ -f "$dir/manifest.json" ] || continue
    found=1
    printf '%-34s %-10s %-22s %-16s %8s\n' "$(basename "$dir")" "$(manifest_value "$dir" kind)" \
      "$(manifest_value "$dir" cutAt)" "$(manifest_value "$dir" migration)" "$(du -h "$dir/carshenas.dump" | cut -f1)"
  done
  [ "$found" -eq 1 ] || say "no release in $RELEASES_DIR yet: carshenas release cut"
}

cmd_verify() {
  local dir
  dir=$(find_release "${1:?release name}")
  (cd "$dir" && sha256sum --check --quiet SHA256SUMS) || fail "$(basename "$dir") does not match its checksum: it is damaged"
  pg_restore --list "$dir/carshenas.dump" >/dev/null || fail "the dump of $(basename "$dir") cannot be read"
  say "$(basename "$dir") is whole: checksum and archive read back"
}

cmd_restore() {
  local release="" into=carshenas_restore pause=1 dir
  while [ $# -gt 0 ]; do
    case $1 in
      --into) into=${2:?--into needs a database name}; shift 2 ;;
      --keep-sources) pause=0; shift ;;
      -*) fail "unknown option $1" ;;
      *) [ -z "$release" ] || fail "one release at a time"; release=$1; shift ;;
    esac
  done
  [ -n "$release" ] || fail "which release? (carshenas release list)"
  [[ $into =~ ^[a-z][a-z0-9_]{0,40}$ ]] || fail "--into is a database name: lower-case letters, digits and underscores"
  dir=$(find_release "$release")
  cmd_verify "$(basename "$dir")"
  if [ -n "$(psql_q --dbname postgres --command "SELECT 1 FROM pg_database WHERE datname = '$into'")" ]; then
    fail "database $into exists: a restore goes into an empty database that does not exist yet (docs/runbooks/deploy.md says how to replace the live one)"
  fi

  say "creating $into (the same way the server's own database is created) and restoring $(basename "$dir")"
  psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 --dbname postgres -v dbname="$into" --file "$OPS_DIR/create-database.psql"
  # Objects belong to carshenas_owner, as the migrations made them; the grants to the roles come back with the dump.
  pg_restore --dbname "$into" --role carshenas_owner --no-owner --single-transaction --exit-on-error "$dir/carshenas.dump"
  say "refreshing the planner's statistics (a dump does not carry them)"
  psql_q --dbname "$into" --command "ANALYZE" >/dev/null
  if [ "$pause" -eq 1 ]; then
    local paused
    paused=$(psql_q --dbname "$into" --command "WITH changed AS (UPDATE public.source SET crawl_state = 'paused', stopped_at = NULL, stop_reason = NULL WHERE crawl_state <> 'paused' RETURNING 1) SELECT count(*) FROM changed")
    say "paused $paused source(s) in the restored copy: it never crawls until a superadmin resumes a source"
  fi

  say "comparing what came back with the manifest"
  MANIFEST_FILE="$dir/manifest.json" psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 --dbname "$into" <<'SQL'
\set manifest `cat "$MANIFEST_FILE"`
CREATE TEMP TABLE restored_counts AS
  SELECT e.key AS name, e.value::bigint AS expected,
         (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', e.key), false, true, '')))[1]::text::bigint AS actual
  FROM jsonb_each_text((:'manifest'::jsonb) -> 'counts' -> 'tables') AS e;
\pset format aligned
\pset tuples_only on
SELECT format('  %-22s %10s  %s', name, actual, CASE WHEN actual = expected THEN 'as cut' ELSE 'DIFFERENT, cut with ' || expected END)
FROM restored_counts ORDER BY name;
SELECT count(*) > 0 AS different FROM restored_counts WHERE actual <> expected \gset
\if :different
  DO $$ BEGIN RAISE EXCEPTION 'the restored database does not match the manifest'; END $$;
\endif
SQL
  say "restored into $into: the numbers above are the cut's"
}

cmd_prune() {
  local kind="" keep="" dir pruned=0
  while [ $# -gt 0 ]; do
    case $1 in
      --kind) kind=${2:?}; shift 2 ;;
      --keep) keep=${2:?}; shift 2 ;;
      *) fail "unknown option $1" ;;
    esac
  done
  [[ $kind =~ ^(release|nightly|pre-deploy)$ ]] || fail "--kind is release, nightly or pre-deploy"
  [[ $keep =~ ^[1-9][0-9]*$ ]] || fail "--keep is a whole number above zero"
  [ "$kind" != release ] || fail "named releases are never pruned: delete one by hand when you are sure"
  local of_kind=()
  for dir in "$RELEASES_DIR"/[0-9]*Z*; do
    [ -f "$dir/manifest.json" ] && [ "$(manifest_value "$dir" kind)" = "$kind" ] && of_kind+=("$dir")
  done
  # The names sort by time; the newest `keep` stay.
  while [ "${#of_kind[@]}" -gt "$keep" ]; do
    dir=${of_kind[0]}
    [[ $dir == "$RELEASES_DIR"/* ]] || fail "refusing to remove $dir"
    rm -rf -- "$dir"
    say "removed $(basename "$dir") ($kind, beyond the newest $keep)"
    of_kind=("${of_kind[@]:1}")
    pruned=$((pruned + 1))
  done
  say "kept the newest ${#of_kind[@]} $kind release(s); removed $pruned"
}

command=${1:-}
[ $# -gt 0 ] && shift
case $command in
  cut) cmd_cut "$@" ;;
  list) cmd_list ;;
  verify) cmd_verify "$@" ;;
  restore) cmd_restore "$@" ;;
  prune) cmd_prune "$@" ;;
  *)
    awk 'NR == 1 { next } /^#/ { print; next } { exit }' "${BASH_SOURCE[0]}" >&2
    exit 2
    ;;
esac
