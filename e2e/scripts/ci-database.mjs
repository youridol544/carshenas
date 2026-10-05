// Makes and migrates the database the browser tests run against in CI (CS-119): the roles and the database exactly as
// `pnpm db:up` makes them locally (db/bootstrap), then every migration. Locally Docker does this (scripts/db.sh); a CI job
// that runs inside the Playwright container has the service container's PostgreSQL on the network and no Docker, so this
// speaks to it with node-postgres, reading the same SQL files, and applies the migrations with the repository's dbmate.
//
// Settings: CI_DB_HOST (default 127.0.0.1), CI_DB_PORT (5432), CI_DB_SUPERUSER_PASSWORD (the service's POSTGRES_PASSWORD) and
// CI_DB_PASSWORD, the password every application role gets: a throwaway, because the database lives as long as the job.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = fileURLToPath(new URL('../../', import.meta.url));
const database = 'carshenas';
const roles = [
  'carshenas_migrate',
  'carshenas_web',
  'carshenas_readonly',
  'carshenas_worker',
  'carshenas_admin',
];

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  return value;
}

const host = process.env.CI_DB_HOST ?? '127.0.0.1';
const port = Number(process.env.CI_DB_PORT ?? 5432);
const superuserPassword = required('CI_DB_SUPERUSER_PASSWORD');
const rolePassword = required('CI_DB_PASSWORD');

async function connect() {
  // The service container reports healthy before every first start has finished: try for a minute.
  for (let attempt = 1; ; attempt += 1) {
    const client = new pg.Client({
      host,
      port,
      user: 'postgres',
      password: superuserPassword,
      database: 'postgres',
    });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => undefined);
      if (attempt >= 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
}

/** The statements of a .psql file with its variable filled in: comments dropped, one statement per `;`. */
function statementsOf(file, variables) {
  let text = readFileSync(path.join(root, file), 'utf8');
  for (const [name, value] of Object.entries(variables)) text = text.replaceAll(`:"${name}"`, `"${value}"`);
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

const client = await connect();
try {
  // db/bootstrap/10-roles.sql: plain SQL that skips the roles that exist, so it also runs twice.
  await client.query(readFileSync(path.join(root, 'db/bootstrap/10-roles.sql'), 'utf8'));
  for (const role of roles) {
    await client.query(`ALTER ROLE ${role} PASSWORD ${client.escapeLiteral(rolePassword)}`);
  }
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (existing.rowCount === 0) {
    // CREATE DATABASE cannot run in a transaction block, so one statement at a time (never one multi-statement query).
    for (const statement of statementsOf('db/bootstrap/create-database.psql', { dbname: database })) {
      await client.query(statement);
    }
  }
} finally {
  await client.end();
}

const migrateUrl = `postgres://carshenas_migrate:${rolePassword}@${host}:${port}/${database}?sslmode=disable`;
execFileSync(
  path.join(root, 'node_modules/.bin/dbmate'),
  ['--url', migrateUrl, '--migrations-dir', 'db/migrations', '--no-dump-schema', 'up'],
  { cwd: root, stdio: 'inherit' },
);
console.log(`[ci-database] ${database} is migrated on ${host}:${port}`);
