import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  MAX_NAME_LENGTH,
  MAX_SEARCH_FILES,
  SEARCH_FILE_STATES,
} from '@/features/search-files/search-files-rules';
import { migrationFiles, repositoryRoot } from '@/server/db/schema-test-database';

// The numbers and states a search file has in code are the ones its migrations hold (CS-70): a limit changed in one
// place and not the other would show the buyer a message that is not what the database enforces.

async function migrationText(name: string): Promise<string> {
  const file = (await migrationFiles()).find((candidate) => candidate.endsWith(`_${name}.sql`));
  if (file === undefined) throw new Error(`no migration ${name}`);
  return readFile(path.join(repositoryRoot, 'db', 'migrations', file), 'utf8');
}

test('the limit of files an account keeps is the trigger’s', async () => {
  const text = await migrationText('limit_search_files_per_account');
  expect(text).toContain(`>= ${String(MAX_SEARCH_FILES)} THEN`);
  expect(text).toContain(`at most ${String(MAX_SEARCH_FILES)} search files`);
});

test('the name length and the states are the table’s', async () => {
  const text = await migrationText('create_search_file');
  expect(text).toContain(`char_length(name) BETWEEN 1 AND ${String(MAX_NAME_LENGTH)}`);
  const list = SEARCH_FILE_STATES.map((state) => `'${state}'`).join(', ');
  expect(text).toContain(`status IN (${list})`);
});
