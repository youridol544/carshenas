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

// The start of SQL text (not English prose such as "Update failed"), for the injection selectors below.
const SQL_TEXT = String.raw`^\s*(select\s|insert\s+into\s|update\s+(\S+\s+set\s|$)|delete\s+from\s|with\s+(recursive\s+)?\S+\s+as\s*\()`;

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
  // SQL injection (ADR-0012, database skill): values reach PostgreSQL only as parameters.
  {
    selector: `BinaryExpression[operator='+'] > Literal[value=/${SQL_TEXT}/i]`,
    message:
      'SQL built by string concatenation. Pass values as parameters: the Kysely builder, or the sql tag inside src/server/db (database skill).',
  },
  {
    selector: `:not(TaggedTemplateExpression) > TemplateLiteral[expressions.length>0]:has(TemplateElement[value.raw=/${SQL_TEXT}/i])`,
    message:
      'Values interpolated into SQL text. The Kysely builder and the sql tag send them as parameters instead (database skill).',
  },
  {
    selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
    message:
      'sql.raw sends text to PostgreSQL unescaped. Use a parameter, sql.lit for a fixed literal, or sql.ref/sql.table for an identifier from an allowlist.',
  },
];
// Logging (ADR-0016): a log message is a constant sentence and the values go in fields, so every occurrence of one
// event reads the same and can be counted and searched: logger.info('snapshot stored', { listingId }).
const HTTP_METHOD = '/^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/';
const ROUTE_HANDLER_MESSAGE =
  "Export a Route Handler's method through withErrorReference: export const GET = withErrorReference('/api/x', async (request) => …) (src/server/observability/route-errors.ts, ADR-0016).";
const LOG_CALL = `CallExpression[callee.property.name=/^(trace|debug|info|warn|error|fatal)$/][callee.object.name=/^(logger|log|[a-z]\\w*Log(ger)?)$/]`;
const LOG_MESSAGE =
  "A log message is a constant sentence; put the values in fields: logger.info('snapshot stored', { listingId }) (ADR-0016).";
RESTRICTED_SYNTAX.push(
  {
    selector: `${LOG_CALL} > TemplateLiteral.arguments:first-child[expressions.length>0]`,
    message: LOG_MESSAGE,
  },
  { selector: `${LOG_CALL} > BinaryExpression.arguments:first-child`, message: LOG_MESSAGE },
);
// Percentages (CS-3): a percent sign typed after a Persian digit joins the digits' left-to-right run and shows on
// the wrong side of the number in right-to-left text. formatPercent in @carshenas/locale/format-number writes it with a
// right-to-left mark. Tailwind's percentages (`w-[50%]`) never follow a Persian digit, and a CSS percentage built
// inside a `style` attribute (a gauge marker's `${share * 100}%`) is layout, not text, so both pass.
const PERCENT_MESSAGE =
  'A percent sign written by hand shows on the wrong side of its number in right-to-left text. Use formatPercent from @carshenas/locale/format-number, which keeps «٪» to the left of the number. A CSS percentage belongs inside the style attribute.';
const IN_STYLE = "JSXAttribute[name.name='style']";
const PERCENT_SYNTAX = [
  { selector: 'JSXText[value=/[%٪‰]/]', message: PERCENT_MESSAGE },
  { selector: 'Literal[value=/٪|‰|[۰-۹٠-٩]%/]', message: PERCENT_MESSAGE },
  {
    selector: `TemplateElement[value.raw=/^[%٪‰]|٪|‰|[۰-۹٠-٩]%/]:not(${IN_STYLE} TemplateElement)`,
    message: PERCENT_MESSAGE,
  },
  {
    selector: `BinaryExpression[operator='+'] > Literal[value=/^[%٪‰]/]:not(${IN_STYLE} Literal)`,
    message: PERCENT_MESSAGE,
  },
];
RESTRICTED_SYNTAX.push(...PERCENT_SYNTAX);
// Invisible characters written literally (CS-3): a no-break space, a zero-width space or a bidi mark or control in
// source cannot be seen in review, and bidi controls are the Trojan Source attack (CVE-2021-42574). Write them as
// \u escapes (or &nbsp; in JSX). The zero-width non-joiner is ordinary Persian spelling and stays allowed.
const INVISIBLE = String.raw`[\u00A0\u200B\u200E\u200F\u202A-\u202E\u2060-\u2069\u061C\uFEFF]`;
const INVISIBLE_MESSAGE =
  'An invisible character (no-break space, zero-width space, bidi mark or control) is written literally. Write it as a \\u escape so a reader can see it.';
RESTRICTED_SYNTAX.push(
  { selector: `Literal[raw=/${INVISIBLE}/]`, message: INVISIBLE_MESSAGE },
  { selector: `TemplateElement[value.raw=/${INVISIBLE}/]`, message: INVISIBLE_MESSAGE },
  { selector: `JSXText[raw=/${INVISIBLE}/]`, message: INVISIBLE_MESSAGE },
);
const ENV_EXEMPT_SYNTAX = RESTRICTED_SYNTAX.filter((entry) => !entry.selector.includes('process'));
// Tests spell out the exact text a formatter returns, percent signs included.
const TEST_SYNTAX = RESTRICTED_SYNTAX.filter((entry) => !PERCENT_SYNTAX.includes(entry));

const IMPORT_RESTRICTIONS = [
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
  {
    // A regex, because a group pattern `ai` would also match any path segment named ai.
    regex: '^(ai|ai/.*|@ai-sdk/.*)$',
    message: 'Language models are called only through @carshenas/ai (ADR-0021): ai.call(task, input).',
  },
];
// ADR-0012: only src/server/db talks to the driver and builds Kysely values; everything else goes through
// database() and readDatabase(). Types from kysely stay importable everywhere on the server.
const DATABASE_IMPORT_RESTRICTIONS = [
  {
    group: [
      'pg',
      'pg-*',
      'postgres',
      '@electric-sql/*',
      '@prisma/*',
      'drizzle-orm',
      'drizzle-orm/*',
      '@carshenas/db/database',
    ],
    message:
      'Only src/server/db talks to the database driver (ADR-0012). Use database() or readDatabase() from @/server/db/database.',
  },
  {
    group: ['kysely', 'kysely/*'],
    allowTypeImports: true,
    message:
      'Kysely values (sql, Kysely, dialects) stay in src/server/db (ADR-0012): build on readDatabase() and database(), and add sql fragments as named helpers there.',
  },
];
// ADR-0023: the superadmin section's own pool, as carshenas_admin, serves src/features/admin alone.
const ADMIN_DATABASE_IMPORT_RESTRICTIONS = [
  {
    group: ['@/server/db/admin-database'],
    message:
      'Only the superadmin section (src/features/admin) uses its database role (ADR-0023). Use database() or readDatabase() from @/server/db/database.',
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts', 'eslint/samples/**']),
  { settings: { react: { version: '19.3' } } },
  // Every file names its TypeScript root, not only src/. Without one, typescript-eslint infers it from the configs
  // loaded in the process, and VS Code lints every package in one process: with packages/observability's config
  // loaded too, each file here outside src/ failed to parse (CS-31). The lint self-test lints that way.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },

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
            // The listing page (CS-64) reuses the result card's pieces and the search API's similar-listings read.
            {
              from: { element: { type: 'feature', captured: { feature: 'listing' } } },
              allow: { to: { element: { type: 'feature', captured: { feature: 'search' } } } },
            },
            // CS-65: pasting a link answers with the listing page's own pieces (the price, the gauge, the explanation, the
            // rating read) and the search's cards and similar-listings read; neither imports it.
            {
              from: { element: { type: 'feature', captured: { feature: 'check-link' } } },
              allow: { to: { element: { type: 'feature', captured: { feature: ['listing', 'search'] } } } },
            },
            // CS-69: the «نشان کردن» control is drawn on the result card and the listing page, and the marked-listings
            // page is made of the same card's pieces and of the control; the marks feature imports none of them.
            {
              from: { element: { type: 'feature', captured: { feature: ['search', 'listing'] } } },
              allow: { to: { element: { type: 'feature', captured: { feature: 'marks' } } } },
            },
            {
              from: { element: { type: 'feature', captured: { feature: 'marked-listings' } } },
              allow: { to: { element: { type: 'feature', captured: { feature: ['marks', 'search'] } } } },
            },
            // CS-63: the home page is made of the other features' parts (the catalogue rows' cards and reads, the
            // body-type tiles, the plain-Farsi search box, the data-status figures); none of them imports it.
            {
              from: { element: { type: 'feature', captured: { feature: 'home' } } },
              allow: {
                to: {
                  element: {
                    type: 'feature',
                    captured: {
                      feature: [
                        'search',
                        'search-files',
                        'body-types',
                        'search-understanding',
                        'data-status',
                        'model',
                      ],
                    },
                  },
                },
              },
            },
            // CS-111: the smart search settles a sentence against the search API's live counts (the words that would
            // empty the results are dropped before the buyer lands), and the search page takes the action and the reader
            // of the sentence through the route's slot props, so it imports nothing from there.
            {
              from: { element: { type: 'feature', captured: { feature: 'search-understanding' } } },
              allow: { to: { element: { type: 'feature', captured: { feature: 'search' } } } },
            },
            // CS-70: search files show the search page's cards, reads and labels, and keep a stored search; the
            // search page and the home page take the save button through the route's slots or this one line.
            {
              from: { element: { type: 'feature', captured: { feature: 'search-files' } } },
              allow: { to: { element: { type: 'feature', captured: { feature: ['search'] } } } },
            },
            // CS-67: the model page shows the search's result cards and reads the search API for a model's best deals, and
            // the body type's sample photograph; none of them imports it (the address they share is in src/lib).
            {
              from: { element: { type: 'feature', captured: { feature: 'model' } } },
              allow: {
                to: { element: { type: 'feature', captured: { feature: ['search', 'body-types'] } } },
              },
            },
            {
              from: { element: { type: 'components' } },
              allow: { to: { element: { type: ['components', 'lib'] } } },
            },
            {
              from: { element: { type: 'server' } },
              allow: { to: { element: { type: ['server', 'lib'] } } },
            },
            { from: { element: { type: 'lib' } }, allow: { to: { element: { type: 'lib' } } } },
            // Next.js entry files (instrumentation.ts, instrumentation-client.ts, proxy.ts) start the server and client
            // code; they reach cross-feature server code and helpers, never a feature.
            {
              from: { file: { categories: 'next-entry' } },
              allow: { to: { element: { type: ['server', 'lib'] } } },
            },
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
      // Server code writes through the logger (src/server/observability/logger.ts, ADR-0016): one JSON object per
      // line with the request's trace id. In the browser, console output is what the e2e harness treats as a
      // broken page, and errors reach the server log through the error reporter instead.
      'no-console': 'error',
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
            ...IMPORT_RESTRICTIONS,
            ...DATABASE_IMPORT_RESTRICTIONS,
            ...ADMIN_DATABASE_IMPORT_RESTRICTIONS,
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
              // Also closes a gap in every rule here: !leading-4 and duration-300! match none of their patterns.
              pattern: '^(.*:)?!.+$|^.+!$',
              message:
                'The important modifier (!) overrides the cascade and slips past the token rules. Fix the order or the specificity instead.',
            },
            {
              // Tailwind 4 still makes leading-none and leading-<n> (n × 4 px) after the line-height scale is
              // removed, so the role's line height would be overridden silently.
              pattern: '^(.*:)?leading-.+$',
              message:
                'Line height comes with the type role (text-body, text-control …), measured for Persian; leading-* overrides it, and below 1.3 it clips ink (docs/design/design-language.md, section 2). An icon-only box needs flex, not leading-none.',
            },
            {
              // Tailwind 4 turns any bare number into milliseconds (duration-300, delay-75).
              pattern: '^(.*:)?(duration|delay)-[0-9]+$',
              message:
                'A duration by number. Use a motion token: duration-press, duration-popover, duration-sheet … or delay-pending, delay-stale (docs/design/design-language.md, section 5).',
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
            {
              pattern:
                '^(.*:)?-?(p|px|py|ps|pe|pt|pb|pbs|pbe|m|mx|my|ms|me|mt|mb|mbs|mbe|gap|gap-x|gap-y|space-x|space-y)-(?!(0|px|0\\.5|1|2|3|4|6|8|12|16)$)[0-9.]+$',
              message:
                'Spacing off the rhythm. Space with 1, 2, 3, 4, 6, 8, 12 or 16 (4 to 64 px), and 0.5 or px only for optical nudges (docs/design/design-language.md).',
            },
          ],
        },
      ],
      // The token lint (CS-3): globals.css removes Tailwind's palette, sizes, radii, shadows and easings, so any
      // class that is not a role of docs/design/design-language.md is unknown.
      'better-tailwindcss/no-unknown-classes': 'error',
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
      'no-restricted-syntax': ['error', ...TEST_SYNTAX],
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
  {
    // ADR-0016: a Route Handler's methods go through withErrorReference, so an error answers 500 with a reference
    // code that is also on its log line; Next.js alone answers an empty 500 with nothing to connect them.
    files: ['src/app/**/route.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...RESTRICTED_SYNTAX,
        {
          selector: `ExportNamedDeclaration > FunctionDeclaration[id.name=${HTTP_METHOD}]`,
          message: ROUTE_HANDLER_MESSAGE,
        },
        {
          selector: `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=${HTTP_METHOD}]:not([init.callee.name='withErrorReference'])`,
          message: ROUTE_HANDLER_MESSAGE,
        },
        // export { handler as GET } and export const { POST } = handlers would slip past the two above.
        {
          selector: `ExportNamedDeclaration > ExportSpecifier[exported.name=${HTTP_METHOD}]`,
          message: ROUTE_HANDLER_MESSAGE,
        },
        {
          selector: 'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.type=/Pattern$/]',
          message: ROUTE_HANDLER_MESSAGE,
        },
      ],
    },
  },
  {
    // instrumentation.ts reads process.env.NEXT_RUNTIME itself: Next.js replaces that expression when it builds the
    // file for each runtime, which drops the Node-only imports from the Edge build (ADR-0016). Nothing else.
    files: ['src/instrumentation.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...ENV_EXEMPT_SYNTAX,
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']:not(MemberExpression[property.name='NEXT_RUNTIME'] > MemberExpression.object)",
          message:
            'instrumentation.ts reads only process.env.NEXT_RUNTIME; everything else comes from src/server/env.ts.',
        },
      ],
    },
  },
  {
    // The superadmin section (ADR-0023): the one feature that uses its database role, still never the driver.
    files: ['src/features/admin/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...IMPORT_RESTRICTIONS, ...DATABASE_IMPORT_RESTRICTIONS] },
      ],
    },
  },
  {
    // The data layer itself (ADR-0012): the one place that imports the driver and Kysely values.
    files: ['src/server/db/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: IMPORT_RESTRICTIONS }] },
  },
]);
