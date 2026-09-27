import 'server-only';
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// For the schema tests in `pnpm check`: PostgreSQL 18 compiled to WebAssembly (PGlite), migrated the way dbmate
// does it, in about two seconds and without Docker. It has one connection, so races, locks and SKIP LOCKED are
// tested against the real server in `*.db.test.ts` (`pnpm db:check`).

export const repositoryRoot = path.resolve(import.meta.dirname, '../../../../..');
const migrationsDir = path.join(repositoryRoot, 'db', 'migrations');

export async function migrationFiles(): Promise<string[]> {
  return (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
}

/** A fresh database with the server's roles (db/bootstrap/10-roles.sql) and every migration's up section applied. */
export async function createMigratedDatabase(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(await readFile(path.join(repositoryRoot, 'db', 'bootstrap', '10-roles.sql'), 'utf8'));
  // What dbmate creates before the first migration.
  await db.exec('CREATE TABLE schema_migrations (version varchar PRIMARY KEY)');
  for (const file of await migrationFiles()) {
    const text = await readFile(path.join(migrationsDir, file), 'utf8');
    const [up = ''] = text.split(/^-- migrate:down/m);
    const version = file.slice(0, 14);
    if (/^-- migrate:up transaction:false/m.test(up)) {
      await db.exec(up);
      await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    } else {
      await db.transaction(async (tx) => {
        await tx.exec(up);
        await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      });
    }
  }
  return db;
}
