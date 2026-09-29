// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createMigratedDatabase, repositoryRoot } from '@/server/db/schema-test-database';
import { MAX_TOMAN as MAX_TOMAN_NUMBER } from '@carshenas/locale/toman';

// The schema conventions a linter cannot see in SQL text, checked in the catalog of a database migrated from
// db/migrations (the database skill, "Conventions the tests enforce"). Each check lists what breaks its rule, so a
// failure names the table, column or constraint to fix. schema_migrations belongs to dbmate and is exempt. The last
// test plants objects that break every rule, clause by clause, and proves each check reports each of them.

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDatabase();
  // The tables the conventions apply to: ours, in public, without dbmate's schema_migrations.
  await db.exec(`
    CREATE TEMP VIEW our_table AS
    SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> 'schema_migrations'`);
});

afterAll(async () => {
  await db.close();
});

async function names(statement: string): Promise<string[]> {
  const { rows } = await db.query<{ name: string }>(statement);
  return rows.map((row) => row.name);
}

const CHECKS = [
  {
    rule: 'every table has a primary key',
    planted: ['planted_no_key'],
    query: `SELECT t.relname AS name FROM our_table t
            WHERE NOT EXISTS (SELECT FROM pg_constraint k WHERE k.conrelid = t.oid AND k.contype = 'p')`,
  },
  {
    rule: 'every table has a comment that says what a row is',
    planted: ['planted_no_key'],
    query: `SELECT t.relname AS name FROM our_table t WHERE obj_description(t.oid, 'pg_class') IS NULL`,
  },
  {
    rule: 'no column is timestamp, timetz, char, varchar, money or json',
    planted: ['planted.seen timestamp without time zone', 'planted.code character varying(10)'],
    query: `SELECT t.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) AS name
            FROM our_table t JOIN pg_attribute a ON a.attrelid = t.oid
            WHERE a.attnum > 0 AND NOT a.attisdropped
              AND a.atttypid IN ('timestamp'::regtype, 'timetz'::regtype, 'bpchar'::regtype, 'varchar'::regtype,
                                 'money'::regtype, 'json'::regtype)`,
  },
  {
    rule: 'primary and foreign key columns are bigint, text or uuid',
    planted: ['planted_pkey id integer'],
    query: `SELECT k.conname || ' ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) AS name
            FROM pg_constraint k JOIN our_table t ON t.oid = k.conrelid
            JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
            WHERE k.contype IN ('p', 'f') AND a.atttypid NOT IN ('int8'::regtype, 'text'::regtype, 'uuid'::regtype)`,
  },
  {
    rule: 'a single bigint primary key is GENERATED ALWAYS AS IDENTITY',
    planted: ['planted_by_default.id'],
    query: `SELECT t.relname || '.' || a.attname AS name
            FROM pg_constraint k JOIN our_table t ON t.oid = k.conrelid
            JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
            WHERE k.contype = 'p' AND cardinality(k.conkey) = 1 AND a.atttypid = 'int8'::regtype
              AND a.attidentity <> 'a'`,
  },
  {
    rule: 'no column draws from a serial sequence',
    planted: ['planted.id'],
    query: `SELECT t.relname || '.' || a.attname AS name
            FROM our_table t JOIN pg_attrdef d ON d.adrelid = t.oid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.adnum
            WHERE pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval(%'`,
  },
  {
    rule: 'constraints are named <table>_<meaning>_<kind> (_pkey, _fk, _unique, _excl; never _check), under 63 bytes',
    planted: [
      'planted: planted_kind_check',
      'planted: planted_listing_id_fkey',
      'planted: planted_seen_key',
      'planted: planted_kind_exclusive',
      'planted: other_positive',
      'planted_bad_pk: planted_bad_pk_primary',
    ],
    query: `SELECT t.relname || ': ' || k.conname AS name
            FROM pg_constraint k JOIN our_table t ON t.oid = k.conrelid
            WHERE k.contype <> 'n' AND (
                  left(k.conname, length(t.relname) + 1) <> t.relname || '_'
               OR octet_length(k.conname) >= 63
               OR (k.contype = 'p' AND k.conname <> t.relname || '_pkey')
               OR (k.contype = 'f' AND k.conname NOT LIKE '%\\_fk')
               OR (k.contype = 'u' AND k.conname NOT LIKE '%\\_unique')
               OR (k.contype = 'x' AND k.conname NOT LIKE '%\\_excl')
               OR (k.contype = 'c' AND k.conname LIKE '%\\_check'))`,
  },
  {
    rule: 'indexes are named <table>_<meaning>_idx, or _unique for a unique one, under 63 bytes',
    planted: ['planted: planted_kind', 'planted: planted_code', 'planted: other_seen_idx'],
    query: `SELECT t.relname || ': ' || c.relname AS name
            FROM pg_index i JOIN our_table t ON t.oid = i.indrelid JOIN pg_class c ON c.oid = i.indexrelid
            WHERE NOT EXISTS (SELECT FROM pg_constraint k WHERE k.conindid = i.indexrelid)
              AND (left(c.relname, length(t.relname) + 1) <> t.relname || '_'
                   OR octet_length(c.relname) >= 63
                   OR (i.indisunique AND c.relname NOT LIKE '%\\_unique')
                   OR (NOT i.indisunique AND c.relname NOT LIKE '%\\_idx'))`,
  },
  {
    rule: 'every foreign key has an index on its columns, or a comment starting "unindexed:" that says why not',
    planted: ['planted_listing_id_fkey'],
    query: `SELECT k.conname AS name
            FROM pg_constraint k JOIN our_table t ON t.oid = k.conrelid
            WHERE k.contype = 'f'
              AND NOT EXISTS (
                SELECT FROM pg_index i
                WHERE i.indrelid = k.conrelid AND i.indpred IS NULL
                  AND (i.indkey::int2[])[0:cardinality(k.conkey) - 1] @> k.conkey
                  AND (i.indkey::int2[])[0:cardinality(k.conkey) - 1] <@ k.conkey)
              AND coalesce(obj_description(k.oid, 'pg_constraint'), '') NOT LIKE 'unindexed:%'`,
  },
  {
    rule: 'no index is left invalid',
    planted: ['planted_seen_idx'],
    query: `SELECT c.relname AS name FROM pg_index i JOIN our_table t ON t.oid = i.indrelid
            JOIN pg_class c ON c.oid = i.indexrelid WHERE NOT i.indisvalid`,
  },
  {
    rule: 'no constraint is left NOT VALID',
    planted: ['planted_id_positive'],
    query: `SELECT k.conname AS name FROM pg_constraint k JOIN our_table t ON t.oid = k.conrelid
            WHERE NOT k.convalidated`,
  },
  {
    rule: 'no two indexes are the same',
    planted: ['planted_kind_idx'],
    query: `SELECT string_agg(c.relname, ' = ' ORDER BY c.relname) AS name
            FROM pg_index i JOIN our_table t ON t.oid = i.indrelid JOIN pg_class c ON c.oid = i.indexrelid
            GROUP BY i.indrelid, i.indkey::text, i.indclass::text, coalesce(pg_get_expr(i.indexprs, i.indrelid), ''),
                     coalesce(pg_get_expr(i.indpred, i.indrelid), '')
            HAVING count(*) > 1`,
  },
  {
    rule: 'every SECURITY DEFINER function pins its search_path',
    planted: ['planted_definer'],
    query: `SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.prosecdef
              AND NOT EXISTS (SELECT FROM unnest(coalesce(p.proconfig, '{}')) setting
                              WHERE setting LIKE 'search\\_path=%')`,
  },
];

test.each(CHECKS)('$rule', async ({ query }) => {
  expect(await names(query)).toEqual([]);
});

type CodegenConfig = { overrides: { columns: Record<string, string> } };

async function codegenOverrides(): Promise<Record<string, string>> {
  const file = path.join(repositoryRoot, 'packages', 'db', '.kysely-codegenrc.json');
  const config = JSON.parse(await readFile(file, 'utf8')) as CodegenConfig;
  return config.overrides.columns;
}

function quotedValues(text: string): string[] {
  return [...text.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? '').sort();
}

/** Columns limited to a list of values whose override is missing or disagrees with the CHECK. */
async function checkListMismatches(): Promise<string[]> {
  const { rows } = await db.query<{
    column_name: string;
    definition: string;
    not_null: boolean;
    has_default: boolean;
  }>(`
    SELECT t.relname || '.' || a.attname AS column_name, pg_get_constraintdef(k.oid) AS definition,
           a.attnotnull AS not_null, a.atthasdef AS has_default
    FROM pg_constraint k JOIN our_table t ON t.oid = k.conrelid
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.contype = 'c' AND cardinality(k.conkey) = 1
      AND pg_get_constraintdef(k.oid) ~ '^CHECK \\(\\(\\w+ = ANY \\(ARRAY\\[.*\\]\\)\\)\\)$'`);
  const overrides = await codegenOverrides();
  return rows.flatMap((row) => {
    const override = overrides[row.column_name];
    if (override === undefined) return [`${row.column_name}: no override for ${row.definition}`];
    const expected = quotedValues(row.definition.replaceAll('::text', ''));
    const problems = [];
    if (quotedValues(override).join('|') !== expected.join('|'))
      problems.push(`values differ from ${row.definition}`);
    if (override.includes('null') === row.not_null) problems.push(row.not_null ? 'not nullable' : 'nullable');
    if (override.startsWith('Generated<') !== row.has_default)
      problems.push(row.has_default ? 'has a default' : 'has no default');
    return problems.map((problem) => `${row.column_name}: ${problem}`);
  });
}

/** Identity and generated columns not typed as never inserted or updated. */
async function neverInsertedMismatches(): Promise<string[]> {
  const columns = await names(`
    SELECT t.relname || '.' || a.attname AS name FROM our_table t JOIN pg_attribute a ON a.attrelid = t.oid
    WHERE a.attnum > 0 AND NOT a.attisdropped AND (a.attidentity = 'a' OR a.attgenerated = 's')`);
  const overrides = await codegenOverrides();
  return columns.filter((column) => !/^ColumnType<[^,]+, never, never>$/.test(overrides[column] ?? ''));
}

/** The largest amount a column may hold (ADR-0014): below 10^15, so every amount and the sum of any nine is exact
 * in a JavaScript number, which parseInt8 requires. Stated once, in @carshenas/locale/toman. */
const MAX_TOMAN = BigInt(MAX_TOMAN_NUMBER);

/** The only low ends ADR-0014 allows: a price, an amount that may be zero, a signed difference. A higher floor
 * would be a plausibility rule, which belongs to extraction and valuation. */
const ALLOWED_LOW = new Set([1n, 0n, -MAX_TOMAN]);

type AmountColumn = {
  table_name: string;
  attname: string;
  type: string;
  checks: { name: string; definition: string }[];
};

/**
 * Amount columns that break ADR-0014. A column whose name holds a currency word (toman, rial, irr, irt, singular or
 * plural), or a numeric or floating-point column that names a price, amount, cost, fee or value (percentages ending in
 * `_pct` aside), must end in `_toman`, be bigint, and have a single-column CHECK named `<table>_<column>_range` and
 * written `<column> BETWEEN <low> AND 999999999999999`, low being 1, 0 or -999999999999999. An integer column with
 * no currency word in its name (`asking_price bigint`) cannot be seen here; ADR-0013's rule that units go in column
 * names covers it.
 */
async function amountColumnProblems(): Promise<string[]> {
  const { rows } = await db.query<AmountColumn>(`
    SELECT t.relname AS table_name, a.attname, format_type(a.atttypid, a.atttypmod) AS type,
           coalesce(json_agg(json_build_object('name', k.conname, 'definition', pg_get_constraintdef(k.oid)))
                      FILTER (WHERE k.oid IS NOT NULL), '[]') AS checks
    FROM our_table t JOIN pg_attribute a ON a.attrelid = t.oid
    LEFT JOIN pg_constraint k ON k.conrelid = t.oid AND k.contype = 'c' AND k.conkey = ARRAY[a.attnum]
    WHERE a.attnum > 0 AND NOT a.attisdropped
      AND (a.attname ~ '(^|_)(tomans?|rials?|irr|irt)(_|$)'
           OR (a.attname ~ '(^|_)(price|amount|cost|fee|value)(_|$)' AND a.attname !~ '_pct$'
               AND a.atttypid IN ('numeric'::regtype, 'float4'::regtype, 'float8'::regtype)))
    GROUP BY t.relname, a.attname, a.atttypid, a.atttypmod`);
  return rows.flatMap((row) => {
    const column = `${row.table_name}.${row.attname}`;
    if (!row.attname.endsWith('_toman'))
      return [`${column}: an amount is whole tomans in a column ending in _toman`];
    if (row.type !== 'bigint') return [`${column}: ${row.type}, not bigint`];
    const name = `${row.table_name}_${row.attname}_range`;
    // PostgreSQL prints the low end bare (1, 0), cast when the migration cast it ((1)::bigint), or quoted when it
    // does not fit an integer ('-999999999999999'::bigint).
    const range = new RegExp(
      `^CHECK \\(\\(\\(${row.attname} >= \\(?'?(-?\\d+)'?\\)?(?:::(?:bigint|integer))?\\) AND \\(${row.attname} <= '${MAX_TOMAN}'::bigint\\)\\)\\)$`,
    );
    const bounded = row.checks.some((check) => {
      const low = range.exec(check.definition)?.[1];
      return check.name === name && low !== undefined && ALLOWED_LOW.has(BigInt(low));
    });
    return bounded
      ? []
      : [`${column}: no CHECK ${name} (${row.attname} BETWEEN 1, 0 or -${MAX_TOMAN} AND ${MAX_TOMAN})`];
  });
}

test('every column limited to a list of values is typed as that union in .kysely-codegenrc.json', async () => {
  expect(await checkListMismatches()).toEqual([]);
});

test('every amount is a bigint of whole tomans that a CHECK keeps within a JavaScript number (ADR-0014)', async () => {
  expect(await amountColumnProblems()).toEqual([]);
});

test('identity and generated columns are typed as never inserted or updated in .kysely-codegenrc.json', async () => {
  expect(await neverInsertedMismatches()).toEqual([]);
});

test('each check finds a planted object that breaks its rule', async () => {
  await db.exec('BEGIN');
  try {
    await db.exec(`
      CREATE TABLE planted (
        id serial PRIMARY KEY,
        seen timestamp,
        code varchar(10),
        kind text CHECK (kind IN ('a', 'b')),
        listing_id bigint REFERENCES listing (id),
        -- Thirteen broken amount columns, each reported for the clause it was planted for (asking_price and fee_amount
        -- break three and report the first); the last four break none.
        price_toman integer CONSTRAINT planted_price_toman_range CHECK (price_toman BETWEEN 1 AND 999999999999999),
        total_rial bigint CONSTRAINT planted_total_rial_range CHECK (total_rial BETWEEN 1 AND 999999999999999),
        total_rials bigint CONSTRAINT planted_total_rials_range CHECK (total_rials BETWEEN 1 AND 999999999999999),
        total_irr bigint CONSTRAINT planted_total_irr_range CHECK (total_irr BETWEEN 1 AND 999999999999999),
        price_irt bigint CONSTRAINT planted_price_irt_range CHECK (price_irt BETWEEN 1 AND 999999999999999),
        fee_tomans bigint CONSTRAINT planted_fee_tomans_range CHECK (fee_tomans BETWEEN 1 AND 999999999999999),
        asking_price numeric(10, 2),
        fee_amount real,
        tax_toman bigint,
        gap_toman bigint CONSTRAINT planted_gap_toman_range CHECK (gap_toman BETWEEN 1 AND 9007199254740991),
        deposit_toman bigint CONSTRAINT planted_deposit_toman_range CHECK (
          deposit_toman BETWEEN -9007199254740991 AND 999999999999999),
        floor_toman bigint CONSTRAINT planted_floor_toman_range CHECK (floor_toman BETWEEN 50000000 AND 999999999999999),
        named_toman bigint CONSTRAINT planted_named_toman_limit CHECK (named_toman BETWEEN 1 AND 999999999999999),
        paid_toman bigint CONSTRAINT planted_paid_toman_range CHECK (paid_toman BETWEEN 1::bigint AND 999999999999999),
        refund_toman bigint CONSTRAINT planted_refund_toman_range CHECK (refund_toman BETWEEN 0 AND 999999999999999),
        balance_toman bigint CONSTRAINT planted_balance_toman_range CHECK (
          balance_toman BETWEEN -999999999999999 AND 999999999999999),
        price_gap_pct numeric(7, 2)
      );
      CREATE TABLE planted_no_key (note text);
      CREATE TABLE planted_by_default (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY);
      CREATE TABLE planted_generated (
        id bigint GENERATED ALWAYS AS IDENTITY CONSTRAINT planted_generated_pkey PRIMARY KEY,
        doubled bigint GENERATED ALWAYS AS (id * 2) STORED
      );
      CREATE TABLE planted_bad_pk (id bigint GENERATED ALWAYS AS IDENTITY CONSTRAINT planted_bad_pk_primary PRIMARY KEY);
      ALTER TABLE planted ADD CONSTRAINT planted_seen_key UNIQUE (seen);
      ALTER TABLE planted ADD CONSTRAINT planted_kind_exclusive EXCLUDE USING btree (kind WITH =);
      ALTER TABLE planted ADD CONSTRAINT other_positive CHECK (id > 0);
      CREATE INDEX planted_kind ON planted (kind);
      CREATE INDEX planted_kind_idx ON planted (kind);
      CREATE UNIQUE INDEX planted_code ON planted (code);
      CREATE INDEX other_seen_idx ON planted (seen, id);
      CREATE INDEX planted_seen_idx ON planted (seen);
      UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'planted_seen_idx'::regclass;
      ALTER TABLE planted ADD CONSTRAINT planted_id_positive CHECK (id > 0) NOT VALID;
      CREATE FUNCTION planted_definer() RETURNS integer LANGUAGE sql SECURITY DEFINER RETURN 1;
    `);
    const missed = [];
    for (const { rule, query, planted } of CHECKS) {
      const found = await names(query);
      for (const name of planted)
        if (!found.some((item) => item.includes(name))) missed.push(`${rule}: ${name}`);
    }
    if (!(await checkListMismatches()).some((problem) => problem.startsWith('planted.kind'))) {
      missed.push('check lists in .kysely-codegenrc.json');
    }
    if (!(await neverInsertedMismatches()).includes('planted_generated.doubled')) {
      missed.push('never-inserted columns in .kysely-codegenrc.json');
    }
    const amounts = await amountColumnProblems();
    const unit = 'an amount is whole tomans in a column ending in _toman';
    const range = (column: string) =>
      `no CHECK planted_${column}_range (${column} BETWEEN 1, 0 or -${MAX_TOMAN} AND ${MAX_TOMAN})`;
    for (const problem of [
      'planted.price_toman: integer, not bigint',
      ...[
        'total_rial',
        'total_rials',
        'total_irr',
        'price_irt',
        'fee_tomans',
        'asking_price',
        'fee_amount',
      ].map((column) => `planted.${column}: ${unit}`),
      ...['tax_toman', 'gap_toman', 'deposit_toman', 'floor_toman', 'named_toman'].map(
        (column) => `planted.${column}: ${range(column)}`,
      ),
    ])
      if (!amounts.includes(problem)) missed.push(`amount columns: ${problem}`);
    for (const column of ['paid_toman', 'refund_toman', 'balance_toman', 'price_gap_pct'])
      if (amounts.some((problem) => problem.startsWith(`planted.${column}:`)))
        missed.push(`amount columns: ${column} is valid`);
    expect(missed).toEqual([]);
  } finally {
    await db.exec('ROLLBACK');
  }
});
