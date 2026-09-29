import 'server-only';
import { ACCOUNT_PATH } from '@/lib/return-path';
import { requireAccount } from '@/server/auth/current-account';
import type { AccountRole } from '@/server/auth/sessions';
import { readDatabase } from '@/server/db/database';

// What the account page shows, for the signed-in account only: the session decides whose account it is, never an
// argument (the Next.js data-security guide's data access layer). A visitor is sent to sign in and back.

export type AccountPageData = { username: string; role: AccountRole; createdAt: Date };

export async function loadAccountPage(): Promise<AccountPageData> {
  const account = await requireAccount(ACCOUNT_PATH);
  const { created_at } = await readDatabase()
    .selectFrom('account')
    .select('created_at')
    .where('id', '=', account.id)
    .executeTakeFirstOrThrow();
  return { username: account.username, role: account.role, createdAt: created_at };
}
