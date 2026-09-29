// What the web app and the superadmin command share about accounts (ADR-0020): the app's TypeScript rules (ADR-0004),
// plus what a shared runtime package needs. The library in src/ never imports Next.js or React, never reads the
// environment (keys arrive as arguments) and prints nothing; the command in cli/ is a program and may do both.
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const SHARED_RULES = {
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
  '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  // node:test's test() returns a promise the runner awaits itself.
  '@typescript-eslint/no-floating-promises': [
    'error',
    { allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['test', 'describe', 'it'] }] },
  ],
  'no-console': 'error',
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['next', 'next/*', 'react', 'react/*', 'react-dom', 'react-dom/*', 'server-only'],
          message: 'The package runs without Next.js or React: the command is a plain Node.js process.',
        },
      ],
    },
  ],
};
const NO_ENUM_OR_BARREL = [
  { selector: 'TSEnumDeclaration', message: 'No enums: an `as const` object and a derived union.' },
  { selector: 'ExportAllDeclaration', message: 'No `export *`: export from the defining file.' },
];

export default defineConfig([
  globalIgnores(['node_modules/**']),
  {
    files: ['src/**/*.ts', 'cli/**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: SHARED_RULES,
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'The library takes its settings as arguments; the app (src/server/env.ts) or the command (cli/) reads the environment.',
        },
        ...NO_ENUM_OR_BARREL,
      ],
    },
  },
  { files: ['cli/**/*.ts'], rules: { 'no-restricted-syntax': ['error', ...NO_ENUM_OR_BARREL] } },
]);
