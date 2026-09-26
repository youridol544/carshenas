// Three small project rules for ADR-0004. They only look at syntax, so they are fast and have no settings.

const isDirective = (statement, value) =>
  statement?.type === 'ExpressionStatement' && statement.directive === value;

export const localRules = {
  rules: {
    /** Every module under a server/ folder starts with `import 'server-only'`. */
    'require-server-only': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          missing:
            "Files under server/ must `import 'server-only'` so the build rejects them in client bundles.",
        },
      },
      create(context) {
        return {
          Program(node) {
            const found = node.body.some(
              (s) => s.type === 'ImportDeclaration' && s.source.value === 'server-only',
            );
            if (!found) context.report({ node, messageId: 'missing' });
          },
        };
      },
    },

    /** A 'use client' module never imports runtime code from a server/ folder. Types are fine. */
    'no-server-import-in-client': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          bad: "A 'use client' module must not import from a server/ folder ({{source}}). Pass data down as props instead.",
        },
      },
      create(context) {
        let isClient = false;
        return {
          Program(node) {
            isClient = node.body.some((s) => isDirective(s, 'use client'));
          },
          ImportDeclaration(node) {
            if (!isClient || node.importKind === 'type') return;
            const source = String(node.source.value);
            if (/(^|\/)server(\/|$)/.test(source))
              context.report({ node, messageId: 'bad', data: { source } });
          },
        };
      },
    },

    /** <feature>-actions.ts: file-level 'use server', and only async functions named <verb><Noun>Action. */
    'server-action-conventions': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          directive: "An actions file must start with the 'use server' directive.",
          name: "Exported Server Action '{{name}}' must be an async function whose name ends with 'Action'.",
        },
      },
      create(context) {
        return {
          Program(node) {
            if (!isDirective(node.body[0], 'use server')) context.report({ node, messageId: 'directive' });
          },
          ExportNamedDeclaration(node) {
            const declaration = node.declaration;
            if (!declaration || node.exportKind === 'type') return;
            if (declaration.type === 'FunctionDeclaration') {
              if (!declaration.async || !declaration.id.name.endsWith('Action')) {
                context.report({
                  node: declaration.id,
                  messageId: 'name',
                  data: { name: declaration.id.name },
                });
              }
            } else if (declaration.type === 'VariableDeclaration') {
              for (const d of declaration.declarations)
                context.report({ node: d.id, messageId: 'name', data: { name: d.id.name ?? '?' } });
            }
          },
        };
      },
    },
  },
};
