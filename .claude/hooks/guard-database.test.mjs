// The database guard must refuse destructive commands and leave everything else alone, including text that only
// mentions one. Run: `pnpm hooks:test` (part of `pnpm check`).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

const hook = path.join(import.meta.dirname, 'guard-database.mjs');

function decision(command) {
  const output = execFileSync('node', [hook], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
  }).toString();
  return output === '' ? 'allow' : JSON.parse(output).hookSpecificOutput.permissionDecision;
}

test('refuses commands that destroy database data or the volume', () => {
  for (const command of [
    'docker compose exec -T postgres psql -U postgres -c "DROP DATABASE carshenas"',
    "docker compose exec -T postgres psql -U postgres <<'SQL'\nDROP TABLE listing;\nSQL",
    'psql "$URL" -c "truncate listing"',
    'psql "$URL" -c "DROP OWNED BY carshenas_web CASCADE"',
    'pnpm db:psql -c "TRUNCATE listing"',
    'pnpm db:psql -c "drop extension vector cascade"',
    'dropdb -U postgres carshenas',
    'docker compose exec -T postgres dropdb -U postgres carshenas',
    'docker compose down -v',
    'cd /repo && docker compose down --volumes',
    'FOO=1 docker compose down -v',
    'timeout 60 docker compose down -v',
    'bash -c "docker compose down -v"',
    'docker-compose down -v',
    'docker volume rm carshenas_postgres-data',
    'docker system prune -a --volumes',
    'sudo rm -rf /var/lib/docker/volumes/carshenas_postgres-data',
    'node_modules/.bin/dbmate --env DATABASE_MIGRATE_URL drop',
    'pnpm dbmate -e DATABASE_MIGRATE_URL drop',
    "pnpm db:psql -c '\\! rm -rf /var/lib/postgresql/18/docker'",
    'psql "$URL" -c \'\\o | sh\'',
    'docker compose exec postgres rm -rf /var/lib/postgresql/18/docker',
  ]) {
    assert.equal(decision(command), 'deny', command);
  }
});

test('allows everyday commands and text that only mentions a destructive one', () => {
  for (const command of [
    'docker compose down',
    'pnpm db:rollback',
    'pnpm db:check',
    'bash -c "pnpm db:check"',
    'pnpm db:psql -c "select count(*) from listing"',
    'git commit -m "drop table docs"',
    'python3 - <<\'PY\'\ns = "hooks refuse `docker compose down -v` and `dbmate drop`"\nPY',
    'grep -n "docker volume rm" docs/runbooks/local-database.md',
    'grep -n dropdb docs/runbooks/local-database.md',
    'echo "docker-compose down -v deletes the volume"',
    "cat > db/migrations/x.sql <<'SQL'\nDROP TABLE listing;\nSQL",
    'rm -rf apps/web/.next',
  ]) {
    assert.equal(decision(command), 'allow', command);
  }
});
