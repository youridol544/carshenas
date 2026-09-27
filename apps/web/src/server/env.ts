import 'server-only';

// The only file that reads process.env (ADR-0004). Each value is read when first used, not at import, so a page
// that needs no database renders without DATABASE_URL and `next build` never needs one. Local values come from the
// repository's .env (example.env), which next.config.ts loads; production sets them in the environment.

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `${name} is not set: copy example.env to .env (scripts/init.sh does it) or set it in the environment.`,
    );
  }
  return value;
}

export const env = {
  /** Connection string for the web app's role, carshenas_web (db/bootstrap/10-roles.sql). */
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  get isDevelopment() {
    return process.env.NODE_ENV === 'development';
  },
  /** Development only: log every SQL statement with its parameters, to compare the code with what it sent. */
  get logSql() {
    return process.env.CARSHENAS_LOG_SQL === '1';
  },
};
