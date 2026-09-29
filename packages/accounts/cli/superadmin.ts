import { hostname, userInfo } from 'node:os';
import { text } from 'node:stream/consumers';
import { parseArgs } from 'node:util';
import { createDatabase } from '@carshenas/db/database';
import { generatePassword } from '../src/generated-password.ts';
import { parseAuthKey } from '../src/keyed-hash.ts';
import { passwordProblem } from '../src/password.ts';
import { normalizePassword, SUPERADMIN_PASSWORD_MIN_LENGTH } from '../src/password-rules.ts';
import { normalizeUsername, usernameProblem } from '../src/username.ts';
import { setSuperadmin, type SuperadminOutcome } from './set-superadmin.ts';

// `pnpm account:superadmin <username>`: the only way an account becomes a superadmin (ADR-0020 point 9). It runs as
// the migration role from the repository's .env (DATABASE_MIGRATE_URL), makes a password and prints it once, or reads
// one from standard input; never from an argument or the environment, where other processes and the shell's history
// could read it (CWE-214). docs/runbooks/accounts.md has the steps.

const USAGE = `Usage: pnpm account:superadmin <username> [--reset-password] [--password-stdin]

Creates <username> as a superadmin, or promotes an existing buyer, with a generated password that is printed once.
Running it again for a superadmin changes nothing.

  --reset-password   also give an existing superadmin a new password, ending their sessions
  --password-stdin   read the password from standard input (at least ${SUPERADMIN_PASSWORD_MIN_LENGTH} characters) instead of generating one
`;

const OUTCOME: Record<SuperadminOutcome, string> = {
  created: 'created as a superadmin',
  promoted: 'promoted from buyer to superadmin, with a new password; their sessions ended',
  password_reset: 'given a new password; their sessions ended',
  unchanged: 'already a superadmin; nothing changed (add --reset-password for a new password)',
};

function fail(message: string): number {
  process.stderr.write(`account:superadmin: ${message}\n`);
  return 1;
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'reset-password': { type: 'boolean', default: false },
      'password-stdin': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [typedUsername] = positionals;
  if (values.help || typedUsername === undefined || positionals.length > 1) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 1;
  }

  const username = normalizeUsername(typedUsername);
  const usernameIssue = usernameProblem(username);
  if (usernameIssue !== undefined) {
    return fail(
      `"${typedUsername}" cannot be a username (${usernameIssue}): 3 to 30 of a-z, 0-9 and _, starting with a letter, and not a reserved name.`,
    );
  }

  const fromStdin = values['password-stdin'];
  const password = fromStdin
    ? normalizePassword((await text(process.stdin)).replace(/\r?\n$/, ''))
    : generatePassword();
  const passwordIssue = passwordProblem(password, {
    username,
    minimumLength: SUPERADMIN_PASSWORD_MIN_LENGTH,
  });
  if (passwordIssue !== undefined) {
    return fail(
      `the password from standard input cannot be used (${passwordIssue}): at least ${SUPERADMIN_PASSWORD_MIN_LENGTH} characters, not a common password, not built from the username.`,
    );
  }

  const connectionString = process.env.DATABASE_MIGRATE_URL;
  if (connectionString === undefined || connectionString === '') {
    return fail(
      'DATABASE_MIGRATE_URL is not set: run it from the repository, whose .env names the database.',
    );
  }
  const authKeySetting = process.env.CARSHENAS_AUTH_KEY;
  const authKey = authKeySetting ? parseAuthKey(authKeySetting) : undefined;

  const db = createDatabase({
    connectionString,
    applicationName: 'carshenas-account-command',
    max: 1,
    onIdleError: (error) => {
      process.stderr.write(`account:superadmin: the database connection failed: ${error.message}\n`);
    },
  });
  try {
    const outcome = await setSuperadmin(db, {
      username,
      password,
      resetPassword: values['reset-password'],
      changedBy: `cli:${userInfo().username}@${hostname()}`,
      authKey,
    });
    process.stdout.write(`${username}: ${OUTCOME[outcome]}.\n`);
    if (outcome !== 'unchanged' && !fromStdin) {
      process.stdout.write(
        `\nPassword (shown once, stored only as a hash; keep it in a password manager):\n\n  ${password}\n\n`,
      );
    }
    return 0;
  } finally {
    await db.destroy();
  }
}

process.exitCode = await main();
