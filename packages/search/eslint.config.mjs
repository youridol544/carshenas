// The search definitions (CS-58, ADR-0027): the app's TypeScript rules (ADR-0004) for a shared runtime package. The
// definitions in src/ run in the browser, in Next.js and in the worker, so they never import Next.js or React, never
// read the environment and print nothing; the integration tests in test/ read the scratch database's address.
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const NO_ENUM_OR_BARREL = [
  { selector: 'TSEnumDeclaration', message: 'No enums: an `as const` object and a derived union.' },
  { selector: 'ExportAllDeclaration', message: 'No `export *`: export from the defining file.' },
];

export default defineConfig([
  globalIgnores(['node_modules/**']),
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
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
            { from: 'package', package: 'node:test', name: ['test', 'describe', 'it'] },
          ],
        },
      ],
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'react', 'react/*', 'react-dom', 'react-dom/*', 'server-only'],
              message: 'The package runs without Next.js or React: the worker is a plain Node.js process.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'The definitions take their settings as arguments; the app or the worker reads the environment.',
        },
        ...NO_ENUM_OR_BARREL,
      ],
    },
  },
  { files: ['test/**/*.ts'], rules: { 'no-restricted-syntax': ['error', ...NO_ENUM_OR_BARREL] } },
]);
