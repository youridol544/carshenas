// The AI layer (ADR-0021): the rules of the other shared packages (packages/db, packages/observability), plus the
// lines that keep the AI SDK to what ADR-0021 chose. From `ai`, only call.ts may import the functions that call a
// model; the rest of the package takes types only. Agents, UI, the gateway and MCP are never imported, and a model
// is never a string, which the SDK would send to Vercel's AI Gateway. The package never reads the environment:
// the web app's and the worker's env.ts read METIS_API_KEY and pass it in.
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const FRAMEWORKS = {
  group: ['next', 'next/*', 'react', 'react/*', 'react-dom', 'react-dom/*', 'server-only'],
  message: 'The package runs without Next.js or React: the worker is a plain Node.js process.',
};
const NOT_USED = {
  group: [
    '@ai-sdk/gateway',
    '@ai-sdk/mcp',
    '@ai-sdk/react',
    '@ai-sdk/rsc',
    '@ai-sdk/vue',
    '@ai-sdk/svelte',
    '@ai-sdk/angular',
    '@vercel/oidc',
    'ai/internal',
  ],
  message: 'ADR-0021 point 1: the gateway, MCP, UI packages and the SDK internals are not used.',
};
const TYPES_FROM_AI = ['LanguageModelUsage', 'ModelMessage', 'SystemModelMessage', 'TelemetryOptions'];
const CALLS_FROM_AI = [
  'APICallError',
  'generateText',
  'NoObjectGeneratedError',
  'NoOutputGeneratedError',
  'Output',
];
const aiImports = (allowImportNames, where) => ({
  name: 'ai',
  allowImportNames,
  message: `ADR-0021 point 1: ${where}; never agents, UI helpers or the gateway.`,
});
const TEST_DOUBLES = { name: 'ai/test', message: "The SDK's mock models belong in tests." };

const STRING_MODEL_MESSAGE =
  "A model is a ModelChoice (openai(…), anthropic(…), google(…), deepseek(…)), never a string: the SDK sends a string model id to Vercel's AI Gateway (ADR-0021).";
const PROCESS_ENV = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message:
    "The package takes its settings as arguments; the web app's or the worker's env.ts reads the environment.",
};
const SYNTAX = [
  { selector: "Property[key.name='model'] > Literal", message: STRING_MODEL_MESSAGE },
  { selector: "Property[key.name='model'] > TemplateLiteral", message: STRING_MODEL_MESSAGE },
  { selector: 'TSEnumDeclaration', message: 'No enums: an `as const` object and a derived union.' },
  { selector: 'ExportAllDeclaration', message: 'No `export *`: export from the defining file.' },
];

export default defineConfig([
  globalIgnores(['node_modules/**', 'results/**']),
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
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
      'no-restricted-imports': [
        'error',
        {
          paths: [aiImports(TYPES_FROM_AI, 'outside call.ts, types only'), TEST_DOUBLES],
          patterns: [FRAMEWORKS, NOT_USED],
        },
      ],
    },
  },
  {
    // The one module that calls a model.
    files: ['src/call.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            aiImports([...TYPES_FROM_AI, ...CALLS_FROM_AI], 'generateText with Output.object and its errors'),
            TEST_DOUBLES,
          ],
          patterns: [FRAMEWORKS, NOT_USED],
        },
      ],
    },
  },
  {
    // Tests play the model with the SDK's mocks, and may write a model id where a mock needs one.
    files: ['src/**/*.test.ts', 'src/test-support/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', PROCESS_ENV, ...SYNTAX.slice(2)],
      'no-restricted-imports': [
        'error',
        { paths: [aiImports(TYPES_FROM_AI, 'types only')], patterns: [FRAMEWORKS, NOT_USED] },
      ],
    },
  },
  {
    // The live run and the pass-through checks: programs that read the key from their environment and print results.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-syntax': ['error', ...SYNTAX],
    },
  },
]);
