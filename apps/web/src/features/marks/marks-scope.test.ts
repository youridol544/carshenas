import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { setMarkSchema } from '@/features/marks/marks-schemas';

// The guard against reading or changing another buyer's marks (CS-69, ADR-0033). The web role has no identity of its own
// per session, so, as for search files and notifications, ownership is enforced here: every statement on listing_mark
// names the session's account, and the action takes the account from the session, never from its input. A new query that
// forgets the filter fails here, before a reviewer has to catch it.

const FEATURES = path.join(import.meta.dirname, '..');
const FILES = [
  'marks/server/mark-mutations.ts',
  'marks/server/mark-queries.ts',
  'marked-listings/server/marked-queries.ts',
];

const STATEMENT = /\.(updateTable|deleteFrom|selectFrom)\('listing_mark( as k)?'\)/g;
const SCOPE = /\.where\('(k\.)?account_id', '=', (accountId|account\.id)\)/g;

test('every statement on listing_mark names the session account', async () => {
  for (const file of FILES) {
    const text = await readFile(path.join(FEATURES, file), 'utf8');
    const statements = text.match(STATEMENT)?.length ?? 0;
    const scoped = text.match(SCOPE)?.length ?? 0;
    const unscoped = statements - Math.min(statements, scoped);
    expect({ file, statements: statements > 0, unscoped }).toEqual({ file, statements: true, unscoped: 0 });
  }
});

test('an insert sets account_id from the caller, which is the session account', async () => {
  const text = await readFile(path.join(FEATURES, 'marks/server/mark-mutations.ts'), 'utf8');
  expect(text).toContain("eb.val(accountId).as('account_id')");
});

test('the action takes the account from the session and the input has no account in it', async () => {
  const action = await readFile(path.join(FEATURES, 'marks/marks-actions.ts'), 'utf8');
  expect(action).toContain('await currentAccount()');
  expect(action).toContain('markListing(account.id, listingId)');
  expect(action).toContain('unmarkListing(account.id, listingId)');
  expect(Object.keys(setMarkSchema.shape)).toEqual(['listingId', 'marked']);
});
