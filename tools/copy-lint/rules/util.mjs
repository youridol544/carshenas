// Helpers for the rule modules. (Not a rule: rules/index.mjs skips this file.)

/** Every match of a global regular expression in `text`, as `{ index, length, text }`. */
export function matchesOf(pattern, text) {
  const found = [];
  const regex = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  for (const match of text.matchAll(regex)) {
    found.push({ index: match.index, length: match[0].length, text: match[0] });
  }
  return found;
}

/** `text` with every part matching `pattern` replaced by spaces of the same length, so indexes stay valid. */
export function blank(text, pattern) {
  return text.replace(pattern, (whole) => ' '.repeat(whole.length));
}
