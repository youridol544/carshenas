import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { keyedHash } from '../src/keyed-hash.ts';
import { hashPassword } from '../src/password-hash.ts';

// What `pnpm account:superadmin` does, apart from reading its arguments (ADR-0020 point 9). It runs as the migration
// role, the only one allowed to set account.role, and writes everything in one transaction: the account, the record of
// the grant, and the end of the account's sessions when its role or password changed. Insert first and let the unique
// constraint decide (ADR-0013 point 3): a buyer signing up with the same name at the same moment makes this a
// promotion, never a failure.

export type SuperadminRequest = {
  /** Normalised and valid (usernameProblem). */
  username: string;
  /** Normalised and valid for a superadmin (passwordProblem with SUPERADMIN_PASSWORD_MIN_LENGTH). */
  password: string;
  /** Also replace the password of an account that is already a superadmin. */
  resetPassword: boolean;
  /** Who ran the command: cli:<user>@<host>. */
  changedBy: string;
  /** CARSHENAS_AUTH_KEY, when set: the account's sign-in waits are cleared with it. */
  authKey: Uint8Array | undefined;
};

/** What happened; the password was stored in every case but `unchanged`. */
export type SuperadminOutcome = 'created' | 'promoted' | 'password_reset' | 'unchanged';

export async function setSuperadmin(db: Kysely<DB>, request: SuperadminRequest): Promise<SuperadminOutcome> {
  const { username, resetPassword, changedBy, authKey } = request;
  // Hashed before the transaction opens, so it never holds a row lock while the CPU works.
  const passwordHash = await hashPassword(request.password);
  return db.transaction().execute(async (trx) => {
    const created = await trx
      .insertInto('account')
      .values({ username, password_hash: passwordHash, role: 'superadmin' })
      .onConflict((conflict) => conflict.constraint('account_username_unique').doNothing())
      .returning('id')
      .executeTakeFirst();
    if (created !== undefined) {
      await trx
        .insertInto('account_role_change')
        .values({ account_id: created.id, from_role: null, to_role: 'superadmin', changed_by: changedBy })
        .execute();
      return 'created';
    }

    const existing = await trx
      .selectFrom('account')
      .select(['id', 'role'])
      .where('username', '=', username)
      .forNoKeyUpdate()
      .executeTakeFirstOrThrow();
    let outcome: SuperadminOutcome = 'unchanged';
    if (existing.role === 'buyer') {
      // A promotion always comes with a new password: a buyer's was chosen under the buyer's rules.
      await trx
        .updateTable('account')
        .set({ role: 'superadmin', password_hash: passwordHash })
        .where('id', '=', existing.id)
        .execute();
      await trx
        .insertInto('account_role_change')
        .values({ account_id: existing.id, from_role: 'buyer', to_role: 'superadmin', changed_by: changedBy })
        .execute();
      outcome = 'promoted';
    } else if (resetPassword) {
      await trx
        .updateTable('account')
        .set({ password_hash: passwordHash })
        .where('id', '=', existing.id)
        .execute();
      outcome = 'password_reset';
    }
    if (outcome !== 'unchanged') {
      await trx.deleteFrom('account_session').where('account_id', '=', existing.id).execute();
    }
    if (authKey !== undefined) {
      await trx
        .deleteFrom('auth_throttle')
        .where('scope', '=', 'sign_in_account')
        .where('subject_hmac', '=', keyedHash(authKey, 'sign_in_account', username))
        .execute();
    }
    return outcome;
  });
}
