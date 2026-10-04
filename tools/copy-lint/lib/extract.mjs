// Reads a TypeScript or TSX source file into the pieces of text a person could read, called units.
//
// A unit is one of:
//   string     a string literal or a template literal without holes
//   template   a template literal with holes: the static parts joined, each `${...}` written as PLACEHOLDER
//   jsx-text   the text between JSX tags, with JSX's own whitespace rules applied and entities decoded
//   jsx-attr   a string attribute: aria-label="...", title="...", placeholder="..."
//
// What is NOT a unit: comments, identifiers, import and export paths, object keys, type-position literals
// (`type T = 'a' | 'b'`), `case` labels, element-access keys, tagged templates (css, sql, String.raw), and strings that
// are the value of a vocabulary key (`words: [...]`, kinds.mjs). A string without a Persian word (kinds: two letters of
// the Arabic script in a row) is dropped too, unless it is a middle dot used as a separator, which the dot rules need;
// English prose that merely quotes a Persian word is dropped as well.
import { collapseJsxText, decodeEntities, hasPersianWord, isEnglishProse, PLACEHOLDER } from './persian.mjs';
import { isNonCopyKey, kindOf } from './kinds.mjs';
import { ts } from './typescript.mjs';

const MIDDLE_DOT = /[·•⋅∙]/;
const MAX_CLIMB = 24;

/** `file` is a repository-relative path (it only picks the TS or TSX grammar and names the unit's file). */
export function parseSource(file, text) {
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  return undefined;
}

function tagNameText(element) {
  const tag = ts.isJsxElement(element) ? element.openingElement.tagName : element.tagName;
  return tag.getText();
}

/** A string literal whose value is never text a buyer reads, by where it stands. */
function isCodePosition(node) {
  const parent = node.parent;
  if (parent === undefined) return false;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isExternalModuleReference(parent) || ts.isImportAttribute?.(parent)) return true;
  if (ts.isLiteralTypeNode(parent)) return true;
  if (ts.isCaseClause(parent) && parent.expression === node) return true;
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isEnumMember(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return true;
  if (isMatchingArgument(node)) return true;
  return false;
}

// Strings handed to a method that searches or edits other text are what the code matches against, not what it shows:
// `.replace('ي', 'ی')`, `.includes('تومان')`, `new RegExp('...')`. (`.join(' · ')` shows its separator and stays.)
const MATCHING_METHODS = new Set([
  'replace',
  'replaceAll',
  'split',
  'includes',
  'startsWith',
  'endsWith',
  'indexOf',
  'lastIndexOf',
  'match',
  'matchAll',
  'search',
  'test',
  'localeCompare',
  'normalize',
]);

function isMatchingArgument(node) {
  const call = node.parent;
  if (call === undefined) return false;
  if (ts.isNewExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === 'RegExp')
    return true;
  if (!ts.isCallExpression(call) || !call.arguments.includes(node)) return false;
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text === 'RegExp';
  return ts.isPropertyAccessExpression(callee) && MATCHING_METHODS.has(callee.name.text);
}

/**
 * Where a node stands: the nearest object property it is the value of (`key`), or the JSX attribute (`attribute`) or
 * element (`element`) around it, and whether it stands alone as a whole value (`standalone`: not an operand of `+`, a
 * call argument or a piece of a template).
 */
function ownerOf(node) {
  let current = node;
  let standalone = true;
  for (let step = 0; step < MAX_CLIMB; step += 1) {
    const parent = current.parent;
    if (parent === undefined) break;
    if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
      return { key: propertyNameText(parent.name), standalone };
    }
    if (ts.isVariableDeclaration(parent) && parent.initializer === current) {
      return { key: ts.isIdentifier(parent.name) ? parent.name.text : undefined, standalone };
    }
    if (ts.isJsxAttribute(parent)) return { attribute: parent.name.getText(), standalone };
    if (ts.isJsxExpression(parent)) {
      const holder = parent.parent;
      if (ts.isJsxAttribute(holder)) return { attribute: holder.name.getText(), standalone };
      if (ts.isJsxElement(holder)) return { element: tagNameText(holder), standalone: false };
      return { standalone: false };
    }
    if (ts.isJsxElement(parent)) return { element: tagNameText(parent), standalone: false };
    if (ts.isJsxSelfClosingElement(parent) || ts.isJsxFragment(parent)) return { standalone: false };
    if (
      ts.isBinaryExpression(parent) ||
      ts.isCallExpression(parent) ||
      ts.isNewExpression(parent) ||
      ts.isTemplateSpan(parent) ||
      ts.isSpreadElement(parent)
    ) {
      standalone = false;
    }
    if (ts.isSourceFile(parent) || ts.isClassLike(parent) || ts.isFunctionDeclaration(parent)) break;
    current = parent;
  }
  return { standalone: false };
}

function entityDecoded(raw) {
  return decodeEntities(raw);
}

/**
 * All units of one file. `directives` are not looked for here (directives.mjs). Each unit:
 * { file, line, column, endLine, text, form, kind, key, attribute, element, standalone, persian, dot, hasHoles, raw }
 */
export function extractUnits(file, sourceText, sourceFile = parseSource(file, sourceText)) {
  const units = [];

  const emit = (node, text, form, extra = {}) => {
    const persian = hasPersianWord(text) && !isEnglishProse(text);
    const dot = MIDDLE_DOT.test(text);
    if (!persian && !dot) return;
    const owner = ownerOf(node);
    if (isNonCopyKey(owner.key) && owner.attribute === undefined) return;
    let start = node.getStart(sourceFile);
    // JSX text begins right after the tag's «>», before its leading line break and indentation: report the first letter.
    if (form === 'jsx-text') start += sourceText.slice(start, node.end).search(/\S/);
    const from = sourceFile.getLineAndCharacterOfPosition(start);
    const to = sourceFile.getLineAndCharacterOfPosition(node.end);
    units.push({
      file,
      line: from.line + 1,
      column: from.character + 1,
      endLine: to.line + 1,
      text,
      form,
      kind: kindOf(owner, text),
      key: owner.key,
      attribute: owner.attribute,
      element: owner.element,
      standalone: owner.standalone && form !== 'jsx-text',
      persian,
      dot,
      hasHoles: text.includes(PLACEHOLDER),
      raw: sourceText.slice(start, node.end),
      ...extra,
    });
  };

  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isCodePosition(node)) {
        const form = ts.isJsxAttribute(node.parent) ? 'jsx-attr' : 'string';
        emit(node, node.text, form);
      }
      return;
    }
    if (ts.isTemplateExpression(node)) {
      let joined = node.head.text;
      for (const span of node.templateSpans) joined += PLACEHOLDER + span.literal.text;
      if (!isMatchingArgument(node)) emit(node, joined, 'template');
      for (const span of node.templateSpans) visit(span.expression);
      return;
    }
    if (ts.isTaggedTemplateExpression(node)) {
      visit(node.tag);
      if (ts.isTemplateExpression(node.template)) {
        for (const span of node.template.templateSpans) visit(span.expression);
      }
      return;
    }
    if (ts.isJsxText(node)) {
      if (node.containsOnlyTriviaWhiteSpaces) return;
      const text = entityDecoded(collapseJsxText(node.text));
      if (text.trim() === '') return;
      emit(node, text, 'jsx-text');
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return units;
}
