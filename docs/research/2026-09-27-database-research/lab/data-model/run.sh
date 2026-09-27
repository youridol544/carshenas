#!/usr/bin/env bash
# Needs the lab container: docker run -d --name carshenas-lab-model -e POSTGRES_PASSWORD=lab -p 55435:5432 pgvector/pgvector:pg17
# Recreate the scratch database and run every lab step, saving each step's output under outputs/.
set -u
cd "$(dirname "$0")"
PSQL=(docker exec -i carshenas-lab-model psql -U postgres -X --no-psqlrc)
"${PSQL[@]}" -q -c "DROP DATABASE IF EXISTS carshenas_lab WITH (FORCE);" -c "CREATE DATABASE carshenas_lab;"
run() {  # run <step-name> <file...>
  local name=$1; shift
  { echo "-- step: $name ($(date -u +%FT%TZ))"; cat "$@" | "${PSQL[@]}" -d carshenas_lab -v ON_ERROR_STOP=1 -e 2>&1; echo "-- exit: ${PIPESTATUS[1]}"; } > "outputs/$name.txt"
  tail -n 1 "outputs/$name.txt"
}
run 01-schema 00_extensions.sql 01_core.sql 03_indexes.sql
run 02-seed-crawled 10_seed_crawled.sql
run 03-queries-crawled 11_queries_crawled.sql
run 04-migrate-native 12_before_native.sql 02_native.sql 13_after_native.sql
run 05-seed-native 20_seed_native.sql
run 06-tests 30_tests.sql
run 07-purge 40_purge.sql
