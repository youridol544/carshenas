import pg from 'pg';

// Constraints decide; code turns their rejection into a result (the database skill, "Where checks live"). A
// violation is identified by its SQLSTATE and the constraint's name, which migrations choose on purpose: the names
// are the contract between the schema and the Farsi messages. Our own triggers raise with SQLSTATE 23000 or 23514
// and a constraint name, so they map the same way. A NOT NULL violation is the exception: PostgreSQL 18 reports the
// column and no constraint name, so it maps by column.

export const SQLSTATE = {
  integrityConstraintViolation: '23000',
  restrictViolation: '23001', // PostgreSQL 18: a delete blocked by ON DELETE RESTRICT
  notNullViolation: '23502',
  foreignKeyViolation: '23503',
  uniqueViolation: '23505',
  checkViolation: '23514',
  exclusionViolation: '23P01',
} as const;

export type IntegrityCode = (typeof SQLSTATE)[keyof typeof SQLSTATE];

export type ConstraintViolation =
  | { code: typeof SQLSTATE.notNullViolation; column: string; table: string | undefined }
  | {
      code: Exclude<IntegrityCode, typeof SQLSTATE.notNullViolation>;
      constraint: string;
      table: string | undefined;
    };

const INTEGRITY_CODES: ReadonlySet<string> = new Set(Object.values(SQLSTATE));

function isIntegrityCode(code: string): code is IntegrityCode {
  return INTEGRITY_CODES.has(code);
}

/** The rule a statement broke, or undefined for every other error (connection, timeout, permission, syntax). */
export function constraintViolation(error: unknown): ConstraintViolation | undefined {
  if (!(error instanceof pg.DatabaseError)) return undefined;
  const { code, constraint, column, table } = error;
  if (code === undefined || !isIntegrityCode(code)) return undefined;
  if (code === SQLSTATE.notNullViolation) return column === undefined ? undefined : { code, column, table };
  return constraint === undefined ? undefined : { code, constraint, table };
}

/**
 * A data exception (SQLSTATE class 22): a value the statement's type refuses, such as text that is no number or date
 * (22P02, 22007, 22008) or a number out of its type's range (22003). A statement that took a client's value (a cursor
 * edited by hand) answers it as invalid input, never as a server error.
 */
export function isDataException(error: unknown): boolean {
  return error instanceof pg.DatabaseError && error.code?.startsWith('22') === true;
}
