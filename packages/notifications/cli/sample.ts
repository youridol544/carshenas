import { parseArgs } from 'node:util';
import { createDatabase } from '@carshenas/db/database';
import { sampleNotifications } from './sample-notifications.ts';

// `pnpm notifications:sample <username> [--count 5] [--skip 0]`: for development and browser tests only, never on
// main. Notifies an existing account of the most recent real price drops, as CS-69's marked listings will, through
// create_notification(), so a muted kind gets nothing and a repeated run adds nothing. Runs as the migration role from
// the repository's .env and prints what it did as one JSON line.

const USAGE = `Usage: pnpm notifications:sample <username> [--count <n>] [--skip <n>]

Notifies <username> of the <n> most recent real price drops (default 5), after passing over --skip of them.
Prints {"created": …, "skipped": …}; skipped ones were muted or already sent. Development and tests only.
`;

function fail(message: string): number {
  process.stderr.write(`notifications:sample: ${message}\n`);
  return 1;
}

function wholeNumber(value: string | undefined, fallback: number): number | undefined {
  if (value === undefined) return fallback;
  return /^\d{1,4}$/.test(value) ? Number(value) : undefined;
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      count: { type: 'string' },
      skip: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [username] = positionals;
  if (values.help || username === undefined || positionals.length > 1) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 1;
  }
  const count = wholeNumber(values.count, 5);
  const skip = wholeNumber(values.skip, 0);
  if (count === undefined || skip === undefined) return fail('--count and --skip take a whole number.');

  const connectionString = process.env.DATABASE_MIGRATE_URL;
  if (connectionString === undefined || connectionString === '') {
    return fail(
      'DATABASE_MIGRATE_URL is not set: run it from the repository, whose .env names the database.',
    );
  }
  const db = createDatabase({
    connectionString,
    applicationName: 'carshenas-notifications-sample',
    max: 1,
    onIdleError: (error) => {
      process.stderr.write(`notifications:sample: the database connection failed: ${error.message}\n`);
    },
  });
  try {
    const account = await db
      .selectFrom('account')
      .select('id')
      .where('username', '=', username.toLowerCase())
      .executeTakeFirst();
    if (account === undefined) return fail(`no account is named ${username}.`);
    const outcome = await sampleNotifications(db, { accountId: account.id, count, skip });
    process.stdout.write(`${JSON.stringify(outcome)}\n`);
    return 0;
  } finally {
    await db.destroy();
  }
}

process.exitCode = await main();
