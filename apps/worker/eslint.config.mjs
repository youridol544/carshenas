// The worker (ADR-0011, ADR-0018): the app's TypeScript rules (ADR-0004) for a plain Node.js process, plus the lines
// that keep jobs apart from the runtime. A job (src/jobs/) says what to do and gets everything else from its context:
// it never imports the queue library, the database driver or the pool, so how it is claimed, retried, paced and
// logged can change without touching it. Settings come only from src/env.ts, output only from the logger, and SQL
// strings only from the named helpers in src/db/.
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const FRAMEWORKS = {
  group: ['next', 'next/*', 'react', 'react/*', 'react-dom', 'react-dom/*', 'server-only'],
  message: 'The worker is a plain Node.js process: no Next.js or React.',
};
const KYSELY_VALUES = {
  group: ['kysely', 'kysely/*'],
  allowTypeImports: true,
  message:
    'Kysely values (sql, Kysely, dialects) stay in src/db/ (ADR-0012): build queries on the database the context gives you, and add sql fragments as named, tested helpers there.',
};
const DRIVER = {
  group: ['pg', 'pg-*', '!pg-boss', '@carshenas/db/database'],
  message: 'Only src/db/ opens the pool (createWorkerDatabase in src/db/database.ts).',
};
const QUEUE = {
  group: ['pg-boss', 'pg-boss/*'],
  message:
    'Jobs never touch the queue library (ADR-0018): define them with defineJob or defineLaneJob and enqueue through context.enqueue.',
};
// Of the runtime, a job sees only its contract: the job types, the errors it throws and the HTTP types. The pool, the
// runtime itself and its lanes stay out of reach, so a job cannot open a connection or claim work of its own.
const RUNTIME = {
  regex:
    '(^|/)(db/database|runtime/(boss|runtime|lanes|lane-client|run-job|queues|pacing|envelope))(\\.ts)?$',
  message:
    'A job gets the database, the lane and enqueue from its context (ADR-0018 point 1); import only runtime/job.ts, runtime/errors.ts and runtime/http.ts.',
};

const PROCESS_ENV = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: 'Only src/env.ts reads the environment.',
};
const SYNTAX = [
  { selector: 'TSEnumDeclaration', message: 'No enums: an `as const` object and a derived union.' },
  { selector: 'ExportAllDeclaration', message: 'No `export *`: export from the defining file.' },
];

export default defineConfig([
  globalIgnores(['node_modules/**', 'scripts/**']),
  {
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // node:test's test() returns a promise the runner awaits itself.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', package: 'node:test', name: ['test', 'describe', 'it', 'before', 'after'] },
          ],
        },
      ],
      'no-console': 'error',
      'no-restricted-syntax': ['error', PROCESS_ENV, ...SYNTAX],
      'no-restricted-imports': ['error', { patterns: [FRAMEWORKS, KYSELY_VALUES, DRIVER] }],
    },
  },
  {
    // The one file that reads the environment.
    files: ['src/env.ts'],
    rules: { 'no-restricted-syntax': ['error', ...SYNTAX] },
  },
  {
    // Tests set up and inspect rows with plain SQL, and look at the queue's own tables.
    files: ['src/**/*.test.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [FRAMEWORKS] }] },
  },
  {
    // The worker's own database code: the pool, and the SQL of the runtime's tables.
    files: ['src/db/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [FRAMEWORKS] }] },
  },
  {
    // What a job may import (ADR-0018 point 1).
    files: ['src/jobs/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [FRAMEWORKS, KYSELY_VALUES, DRIVER, QUEUE, RUNTIME] }],
    },
  },
]);
