// A shared runtime package (ADR-0014): the app's TypeScript rules (ADR-0004) for pure code that runs in the browser,
// in Next.js and in the worker. It never imports Next.js or React, never reads the environment, and writes no output.
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['node_modules/**']),
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
            { from: 'package', package: 'node:test', name: ['test', 'describe', 'it'] },
          ],
        },
      ],
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'The package takes its settings as arguments; the app or the worker reads the environment.',
        },
        { selector: 'TSEnumDeclaration', message: 'No enums: an `as const` object and a derived union.' },
        { selector: 'ExportAllDeclaration', message: 'No `export *`: export from the defining file.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'The package runs without Next.js or React: the worker is a plain Node.js process.',
            },
          ],
        },
      ],
    },
  },
]);
