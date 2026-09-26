// Lint is where this project's architecture lives (ADR-0004, ADR-0005). If a rule gets in the way,
// change the ADR and the rule together; do not disable it inline.
import eslintReact from '@eslint-react/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import betterTailwind from 'eslint-plugin-better-tailwindcss';
import boundaries from 'eslint-plugin-boundaries';
import checkFile from 'eslint-plugin-check-file';
import { importX } from 'eslint-plugin-import-x';
import jestDom from 'eslint-plugin-jest-dom';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import testingLibrary from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';
import { localRules } from './eslint/local-rules.mjs';

const NEXT_FILES =
  'page|layout|loading|error|global-error|not-found|forbidden|unauthorized|default|template|route|icon|apple-icon|opengraph-image|twitter-image|sitemap|robots|manifest';

// Syntax that no file under src/ may contain; src/server/env.ts is exempt from the process.env entry only.
const RESTRICTED_SYNTAX = [
  {
    selector: 'ExportAllDeclaration',
    message: 'No `export *` barrels. Import from the defining file.',
  },
  {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message: 'Read environment variables only in src/server/env.ts.',
  },
  {
    selector: 'TSEnumDeclaration',
    message:
      'No enums. Use an `as const` object plus a derived union type (see .claude/rules/typescript.md).',
  },
  {
    selector:
      "TSTypeReference > TSQualifiedName[left.name='React'][right.name=/^(FC|FunctionComponent|VFC)$/], TSTypeReference > Identifier[name=/^(FC|FunctionComponent|VFC)$/]",
    message:
      'Do not type components with React.FC. Annotate the props parameter and let the return type be inferred.',
  },
  {
    selector:
      "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat'] Property[key.name='style'] > Literal[value='currency']",
    message:
      'Intl currency style puts «ریال» before the number and the Toman has no ISO code. Format the number and append the unit.',
  },
  {
    selector:
      "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat'] Property[key.name='dateStyle'] > Literal[value='full']",
    message:
      "dateStyle 'full' prints «۱۴۰۵ شهریور ۲۷, جمعه» for fa-IR. Use 'long' and add the weekday yourself.",
  },
  {
    selector:
      "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'] > Literal[value='number']",
    message:
      'type="number" drops Persian digits and steals scroll-wheel events. Use type="text" with inputMode="numeric" and normalise digits.',
  },
];
const ENV_EXEMPT_SYNTAX = RESTRICTED_SYNTAX.filter((entry) => !entry.selector.includes('process'));

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts', 'eslint/samples/**']),
  { settings: { react: { version: '19.3' } } },

  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
      'check-file': checkFile,
      'import-x': importX,
      'better-tailwindcss': betterTailwind,
      local: localRules,
    },
    settings: {
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import-x/extensions': ['.ts', '.tsx'],
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
      'better-tailwindcss': { entryPoint: 'src/app/globals.css' },
      'boundaries/include': ['src/**/*'],
      'boundaries/files': [
        { pattern: 'src/{proxy,instrumentation,instrumentation-client}.ts', category: 'next-entry' },
      ],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app', partialMatch: false },
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'], partialMatch: false },
        { type: 'components', pattern: 'src/components', partialMatch: false },
        { type: 'server', pattern: 'src/server', partialMatch: false },
        { type: 'lib', pattern: 'src/lib', partialMatch: false },
      ],
    },
    rules: {
      // Rule 2 and 3: imports flow one way, features never import each other, unknown folders fail.
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { type: ['app', 'feature', 'components', 'server', 'lib'] } } },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: [
                  {
                    element: { type: 'feature', captured: { feature: '{{from.element.captured.feature}}' } },
                  },
                  { element: { type: ['components', 'server', 'lib'] } },
                ],
              },
            },
            // Reviewed one-way exceptions between features go here, one line each, never in both directions.
            {
              from: { element: { type: 'components' } },
              allow: { to: { element: { type: ['components', 'lib'] } } },
            },
            {
              from: { element: { type: 'server' } },
              allow: { to: { element: { type: ['server', 'lib'] } } },
            },
            { from: { element: { type: 'lib' } }, allow: { to: { element: { type: 'lib' } } } },
          ],
        },
      ],
      'import-x/no-cycle': 'error',

      // Rule 7: no barrels, defining-file imports through @/, kebab-case, named exports.
      'check-file/filename-blocklist': ['error', { 'src/**/index.{ts,tsx}': '*.named-module.ts' }],
      'check-file/filename-naming-convention': [
        'error',
        { 'src/**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': ['error', { 'src/!(app)/**/': 'KEBAB_CASE' }],
      'import-x/no-default-export': 'error',
      // no-restricted-imports and no-restricted-syntax: see the code-quality block below (one definition each).

      // Rule 4: the server boundary.
      'local/no-server-import-in-client': 'error',

      // Rule 9 (ADR-0005): direction-agnostic styling only.
      // Only the inline axis changes meaning in RTL. Height, width and the block axis stay physical on purpose:
      // that is what the Tailwind docs, every example and every agent write, and RTL never swaps them.
      'better-tailwindcss/enforce-logical-properties': [
        'error',
        {
          ignore: [
            '^(.*:)?-?(pt|pb|mt|mb|scroll-mt|scroll-mb|scroll-pt|scroll-pb|top|bottom)-.*$',
            '^(.*:)?border-(t|b)(-.*)?$',
            '^(.*:)?(h|w|min-h|min-w|max-h|max-w|size)-.*$',
          ],
        },
      ],
      'better-tailwindcss/no-deprecated-classes': 'error',
      // better-tailwindcss/no-restricted-classes: see the code-quality block below.
    },
  },

  {
    // Rule 1: src/app holds Next.js file-convention files only, and they stay thin.
    files: ['src/app/**/*.{ts,tsx}'],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { 'src/app/**/*.{ts,tsx}': `+(${NEXT_FILES})` },
        { ignoreMiddleExtensions: true },
      ],
      'max-lines': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Next.js requires default exports in its own files.
    files: [
      `src/app/**/{${NEXT_FILES.replaceAll('|', ',')}}.{ts,tsx}`,
      'src/proxy.ts',
      '*.config.{ts,mts,mjs}',
    ],
    rules: { 'import-x/no-default-export': 'off' },
  },
  { files: ['src/features/*/*-actions.ts'], rules: { 'local/server-action-conventions': 'error' } },
  {
    files: ['src/server/**/*.ts', 'src/features/*/server/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'local/require-server-only': 'error' },
  },

  {
    // Rules are fixed in this file, never silenced in code: an eslint-disable comment in src/ has no effect and
    // is itself reported, and `pnpm lint` fails on warnings. Change the rule and its ADR together instead.
    files: ['src/**/*.{ts,tsx}'],
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
  },

  // ---- Code quality: everything about React 19, TypeScript and accessibility that a machine can check. ----
  // The rule packs in .claude/rules/ deliberately omit all of this; a rule that fires here is the teacher.
  {
    // Typed lint: the TypeScript program is the source of truth (eslint-config-next only enables `recommended`).
    files: ['src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `<form action={asyncFn}>` and `onClick={async () => …}` are how React 19 mutations look.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
    },
  },
  {
    // React 19 modernisation and the mistakes agents make most: the rules eslint-config-next does not enable.
    files: ['src/**/*.{ts,tsx}'],
    plugins: { '@eslint-react': eslintReact },
    settings: { 'react-x': { version: '19.3' } },
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      '@eslint-react/no-forward-ref': 'error',
      '@eslint-react/no-context-provider': 'error',
      '@eslint-react/no-use-context': 'error',
      '@eslint-react/no-create-ref': 'error',
      '@eslint-react/no-leaked-conditional-rendering': 'error',
      '@eslint-react/no-nested-component-definitions': 'error',
      '@eslint-react/no-array-index-key': 'error',
      '@eslint-react/no-missing-key': 'error',
      '@eslint-react/no-duplicate-key': 'error',
      '@eslint-react/jsx-no-key-after-spread': 'error',
      // Off on purpose: with reactCompiler on, a context value object is memoised on its inputs (checked by
      // compiling a provider with babel-plugin-react-compiler 1.0.0, 2026-09-21), so the rule only pushes useMemo.
      '@eslint-react/no-unstable-context-value': 'off',
      '@eslint-react/no-unstable-default-props': 'error',
      '@eslint-react/no-unnecessary-use-prefix': 'error',
      '@eslint-react/jsx-no-children-prop': 'error',
      '@eslint-react/jsx-no-children-prop-with-children': 'error',
      '@eslint-react/dom-no-use-form-state': 'error',
      '@eslint-react/dom-no-render': 'error',
      '@eslint-react/dom-no-hydrate': 'error',
      '@eslint-react/dom-no-find-dom-node': 'error',
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
      '@eslint-react/dom-no-void-elements-with-children': 'error',
      '@eslint-react/web-api-no-leaked-event-listener': 'error',
      '@eslint-react/web-api-no-leaked-interval': 'error',
      '@eslint-react/web-api-no-leaked-timeout': 'error',
      '@eslint-react/web-api-no-leaked-resize-observer': 'error',
      '@eslint-react/web-api-no-leaked-intersection-observer': 'error',
      // Accessibility: the six rules eslint-config-next enables plus the rest of jsx-a11y `strict`, rules only,
      // so the plugin instance eslint-config-next registered is reused.
      ...jsxA11y.flatConfigs.strict.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Import through the @/ alias, from the file that defines the thing.',
            },
            {
              group: ['next/router'],
              message: 'Pages Router API. In the App Router import from next/navigation.',
            },
            {
              group: ['next/head'],
              message: 'Use the Metadata API (export const metadata / generateMetadata).',
            },
            {
              group: ['react-dom/test-utils', 'react-test-renderer'],
              message: 'Removed in React 19. Use Testing Library.',
            },
          ],
        },
      ],
      // Persian text and the token rule (ui.md), the parts a class scanner can see.
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern: '^(.*:)?origin-(left|right|top-left|top-right|bottom-left|bottom-right)$',
              message:
                'Physical transform origin. It will not mirror in RTL; use a logical layout or document why.',
            },
            {
              pattern: '^(.*:)?bg-(gradient|linear)-to-(l|r|tl|tr|bl|br)$',
              message:
                'Horizontal gradients do not mirror. Decide the direction for RTL on purpose and use an arbitrary value with a comment.',
            },
            {
              pattern: '^(.*:)?mask-((l|r)-.+|left|right|(top|bottom)-(left|right))$',
              message:
                'Physical mask edge or position: it will not mirror in RTL. Set the fade direction for RTL on purpose (ui-design craft.md, scroll fades).',
            },
            {
              pattern: '^(.*:)?leading-(none|tight)$',
              message:
                'Too tight for Persian: ink is clipped below 1.3 and paragraphs crowd. Use the role line height from the type tokens (ui-design craft.md, Persian type); an icon-only box needs flex, not leading-none.',
            },
            {
              pattern: '^(.*:)?text-[^/]+/.+$',
              message:
                'A slash on text-*: an alpha text colour leaves dark spots where Persian letters join, and a size/line-height pair overrides the role line height. Use a solid text colour token or the role type token (ui-design craft.md, Persian type).',
            },
            {
              pattern: '^(.*:)?cursor-.+$',
              message:
                'The cursor is one app-wide rule in globals.css (the hand on enabled buttons, the arrow on disabled ones); components never set their own.',
            },
            {
              pattern: '^(.*:)?transition-all$',
              message:
                'transition: all also animates layout properties and slows every change. Name what moves: transition-opacity, transition-transform, transition-colors (ui-design motion.md).',
            },
            {
              pattern: '^(.*:)?(start|end)-.+$',
              message: 'start-*/end-* are deprecated in Tailwind 4.3. Use inset-s-* / inset-e-*.',
            },
            {
              pattern: '^(rtl|ltr):.*$',
              message: 'This app has one direction. Use logical utilities instead of rtl:/ltr: variants.',
            },
            {
              pattern: '^(.*:)?tracking-.+$',
              message: 'No letter-spacing on Persian text: the letters must stay connected.',
            },
            {
              pattern: '^(.*:)?(uppercase|lowercase|capitalize|italic)$',
              message: 'Persian has no case and no italics.',
            },
            {
              pattern: '^dark:.*$',
              message: 'Themes live in tokens (light-dark() in globals.css), never in components.',
            },
            {
              pattern:
                '^(.*:)?(bg|text|border|ring|outline|fill|stroke|from|to|via|shadow|accent|caret|decoration)-\\[(#|rgb|hsl|oklch|oklab).*\\]$',
              message:
                'Raw colour. Add a token in globals.css (docs/design/design-language.md) and use its utility.',
            },
            {
              pattern:
                '^(.*:)?(text|leading|p|px|py|ps|pe|pt|pb|m|mx|my|ms|me|mt|mb|gap|gap-x|gap-y|space-x|space-y|rounded|rounded-[a-z]+|w|h|size|min-w|max-w|min-h|max-h|inset-s|inset-e|top|bottom|duration|delay)-\\[[0-9.]+(px|rem|em|ms|s)?\\]$',
              message:
                'Magic number. Use a spacing, size, radius or duration token; add one if the scale is missing it.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests: query like a user, assert with jest-dom, and let vitest lint the test structure.
    files: ['src/**/*.test.{ts,tsx}', 'vitest.setup.ts'],
    extends: [
      testingLibrary.configs['flat/react'],
      jestDom.configs['flat/recommended'],
      vitest.configs.recommended,
    ],
    rules: {
      'testing-library/prefer-user-event': 'error',
      'testing-library/no-node-access': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/expect-expect': 'error',
    },
  },
  {
    // The one place cleanup is registered by hand: without Vitest globals Testing Library cannot do it itself.
    files: ['vitest.setup.ts'],
    rules: { 'testing-library/no-manual-cleanup': 'off' },
  },
  {
    // The one file allowed to read process.env (ADR-0004).
    files: ['src/server/env.ts'],
    rules: { 'no-restricted-syntax': ['error', ...ENV_EXEMPT_SYNTAX] },
  },
]);
