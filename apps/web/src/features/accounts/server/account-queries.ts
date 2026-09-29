import 'server-only';
import type { AccountRole } from '@/server/auth/sessions';
import { readDatabase } from '@/server/db/database';

// Reads of accounts for signing in and for the availability check, by the normalised username
// (account_username_unique serves both).

export type AccountForSignIn = { id: number; passwordHash: string; role: AccountRole };

export async function findAccountForSignIn(username: string): Promise<AccountForSignIn | undefined> {
  const row = await readDatabase()
    .selectFrom('account')
    .select(['id', 'password_hash', 'role'])
    .where('username', '=', username)
    .executeTakeFirst();
  return row === undefined ? undefined : { id: row.id, passwordHash: row.password_hash, role: row.role };
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const row = await readDatabase()
    .selectFrom('account')
    .select('id')
    .where('username', '=', username)
    .executeTakeFirst();
  return row !== undefined;
}
