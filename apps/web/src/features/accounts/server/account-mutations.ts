import 'server-only';
import { constraintViolation } from '@carshenas/db/database-errors';
import { database } from '@/server/db/database';

// Writes of accounts through the web role, which may insert only a username and a password hash and update only the
// hash (ADR-0020 point 9): the role column is out of its reach. Insert, and let the database decide whether the name
// is taken (ADR-0013 point 3); never read first.

export type InsertBuyerResult = { status: 'created'; id: number } | { status: 'taken' };

export async function insertBuyer(username: string, passwordHash: string): Promise<InsertBuyerResult> {
  try {
    const { id } = await database()
      .insertInto('account')
      .values({ username, password_hash: passwordHash })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { status: 'created', id };
  } catch (error) {
    const violation = constraintViolation(error);
    if (
      violation !== undefined &&
      'constraint' in violation &&
      violation.constraint === 'account_username_unique'
    ) {
      return { status: 'taken' };
    }
    throw error;
  }
}

/** Stores a new hash of the same password, after a sign-in found the old one made with older parameters. */
export async function replacePasswordHash(accountId: number, passwordHash: string): Promise<void> {
  await database()
    .updateTable('account')
    .set({ password_hash: passwordHash })
    .where('id', '=', accountId)
    .execute();
}
