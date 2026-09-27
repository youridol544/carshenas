// PreToolUse hook (Bash): refuses commands that destroy database data or the database volume, so an agent cannot
// wipe the local PostgreSQL by accident. It denies rather than asks: a hook's "deny" holds even in bypass-permissions
// mode (Claude Code hooks guide), and these commands are rare enough for the person to run them with the ! prefix.
// Scripts that manage their own scratch databases (`pnpm db:check`) are not affected: their SQL is not on the
// command line. Rules match where a command starts (after ;, &&, ||, |, ( or a new line, or inside bash -c '…',
// and after wrappers such as sudo, env, timeout or VAR=value), so text that merely mentions a command, such as a
// document being edited, is not refused. .claude/hooks/guard-database.test.mjs lists what each rule must catch.

const START = String.raw`(?:^|[\n;&|(]\s*|\b(?:ba|z|da)?sh\s+-c\s+['"]\s*)(?:(?:sudo|env|nohup|time|exec|command|xargs|timeout\s+\S+)\s+|\w+=\S*\s+)*`;
const COMPOSE = String.raw`docker(?:\s+|-)compose`;
const DESTRUCTIVE_SQL = /\b(?:drop\s+(?:database|schema|table|owned|extension)|truncate)\b/;

const DENIED = [
  {
    // psql fed a DROP, DROP OWNED or TRUNCATE on its command line or through a here-document.
    test: (c) =>
      new RegExp(
        String.raw`${START}(?:\S*/)?(?:psql|pg_restore|docker\s+exec|${COMPOSE}\s+exec|pnpm\s+(?:-s\s+)?db:psql)\b`,
      ).test(c) && DESTRUCTIVE_SQL.test(c),
    what: 'drops or truncates database objects through psql',
  },
  {
    // psql's shell escape and pipes run anything, out of this guard's sight. (`pnpm db:psql` also runs psql as the
    // unprivileged user nobody inside the container, so a shell there cannot touch the data directory.)
    test: (c) =>
      new RegExp(
        String.raw`${START}(?:\S*/)?(?:psql|docker\s+exec|${COMPOSE}\s+exec|pnpm\s+(?:-s\s+)?db:psql)\b`,
      ).test(c) && /\\!|\\[ogw]\s*\||\bprogram\s+'/.test(c),
    what: 'runs a shell from psql (\\!, a pipe or COPY … PROGRAM), which this guard cannot see into',
  },
  {
    test: (c) =>
      new RegExp(String.raw`${START}(?:\S*/)?dropdb\b`).test(c) ||
      new RegExp(String.raw`${START}(?:docker|${COMPOSE})\s+exec\b[^\n;&|]*\sdropdb\b`).test(c),
    what: 'drops a database with dropdb',
  },
  {
    test: (c) =>
      new RegExp(String.raw`${START}${COMPOSE}\b[^\n;&|]*\bdown\b[^\n;&|]*(?:\s-v\b|--volumes)`).test(c),
    what: 'deletes the PostgreSQL volume',
  },
  {
    test: (c) =>
      new RegExp(String.raw`${START}docker\s+volume\s+(?:rm|prune)\b`).test(c) ||
      new RegExp(String.raw`${START}docker\s+system\s+prune\b[^\n;&|]*--volumes`).test(c),
    what: 'deletes Docker volumes',
  },
  {
    test: (c) =>
      new RegExp(
        String.raw`${START}(?:(?:docker|${COMPOSE})\s+exec\b[^\n;&|]*\s)?rm\s[^\n;&|]*(?:postgres-data|/var/lib/postgresql|/var/lib/docker/volumes)`,
      ).test(c),
    what: "deletes PostgreSQL's data directory",
  },
  {
    test: (c) =>
      new RegExp(
        String.raw`${START}(?:(?:npx|pnpm(?:\s+-s)?(?:\s+exec)?)\s+)?(?:\S*/)?dbmate\b[^\n;&|]*\sdrop\b`,
      ).test(c),
    what: 'drops the database through dbmate',
  },
];

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = String(JSON.parse(input).tool_input?.command ?? '').toLowerCase();
  } catch {
    process.exit(0);
  }
  const match = DENIED.find((rule) => rule.test(command));
  if (!match) process.exit(0);
  const reason =
    `This command ${match.what}, which cannot be undone. Do not work around this guard. ` +
    'Ask the person to run it themselves (with the ! prefix) if they want it; a changed migration is undone with ' +
    'pnpm db:rollback, and pnpm db:check uses its own scratch database (docs/runbooks/local-database.md). ' +
    'The guard matches text, not shell syntax: if it refused an argument that only mentions such a command (a task ' +
    'note, a commit message), put that text in a file and pass it with "$(cat file)".';
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
});
