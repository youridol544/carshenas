import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';

// The guard against reading or changing another buyer's file (CS-70): every statement in the file mutations names the
// session's account, so an id taken from an address can never reach another account's row. A new mutation that forgets
// the filter fails here, before a reviewer has to catch it.

const SOURCE = path.join(import.meta.dirname, 'server', 'file-mutations.ts');

const SCOPE = ".where('account_id', '=', accountId)";

/** What a function of the mutations file does to search_file and how many statements name the account. */
function problems(body: string): string[] {
  const name = body.slice(0, body.indexOf('('));
  const statements = body.match(/\.(updateTable|deleteFrom|selectFrom)\('search_file'\)/g) ?? [];
  const scoped = body.split(SCOPE).length - 1;
  const found: string[] = [];
  if (scoped < statements.length)
    found.push(`${name}: a statement on search_file does not filter by account_id`);
  if (body.includes(".insertInto('search_file')") && !body.includes('account_id: accountId')) {
    found.push(`${name}: an insert does not set account_id from the session's account`);
  }
  return found;
}

test('every statement on search_file in the file mutations names the session account', async () => {
  const text = await readFile(SOURCE, 'utf8');
  const functions = text.split(/^export async function /m).slice(1);
  expect(functions.length).toBeGreaterThanOrEqual(5);
  expect(functions.flatMap(problems)).toEqual([]);
});
