// What kind of text a string is, which decides its length budget (rules/length.mjs). The kind comes from where the
// string sits, never from what it says:
//
//   1. the key of the object property it is the value of (`retry: '...'`, `hint: '...'`), looking through arrays,
//      arrow functions and conditionals, so `chip: (n) => `...`` is a `chip`;
//   2. in JSX, the attribute it is the value of (`aria-label="..."`) or else the element it is the text of
//      (`<button>...</button>`);
//   3. nothing else: a string that is not the value of a known key or attribute has kind `unknown` and no budget;
//   4. one correction from the text itself: a button, label or title that ends with a full stop is a sentence, so it is a
//      notice (`retry: 'کار دوباره به صف رفت.'` is the message after a retry, not the retry button).
//
// To teach the lint about a new key, add its name to the right pattern below and a sample to the matching rule in
// rules/length.mjs. Patterns are tried in the order of KIND_ORDER and match the whole key, case-insensitively.

/** Budgets by kind, in words (a hole counts as one word) and, for a button, characters. The CS-105 numbers. */
export const BUDGETS = {
  button: { words: 3, chars: 22 },
  label: { words: 4 },
  name: { words: 10 },
  title: { words: 8 },
  hint: { words: 12 },
  notice: { words: 25 },
  popover: { words: 45 },
};

export const KIND_ORDER = ['button', 'title', 'name', 'label', 'hint', 'popover', 'notice'];

// A key that is a verb the buyer presses.
const BUTTON_KEYS = [
  'submit',
  'cancel',
  'retry',
  'close',
  'clear',
  'dismiss',
  'pause',
  'resume',
  'next',
  'previous',
  'back',
  'more',
  'apply',
  'save',
  'reset',
  'confirm',
  'cta',
  'button',
  'track',
  'untrack',
  'markRead',
  'seeAll',
  'showAll',
  'show',
  'hide',
  'open',
  'reopen',
  'signIn',
  'signUp',
  'signOut',
  'logout',
  'cancelConfirm',
  'cancelKeep',
  'backToDashboard',
  'backToSearch',
];

const KEY_PATTERNS = {
  button: new RegExp(`^(?:${BUTTON_KEYS.join('|')}|action|\\w*(?:Button|Cta|Action))$`, 'i'),
  title: /^(?:title|heading|headline|motto|\w+(?:Title|Heading))$/i,
  // An accessible name (infoLabel, listLabel, navLabel ...) is read aloud, not seen: it gets a looser budget than a label.
  name: /^(?:\w+Label)$/i,
  label: /^(?:label|name|caption|legend|tab|column|header|unit|short|chip|link|all|\w+Fa|\w+_fa)$/i,
  hint: /^(?:hint|help|helper|tip|placeholder|\w+(?:Hint|Help|Tip|Placeholder))$/i,
  popover: /^(?:paragraphs?|description|rule|rangeHelp|explanation|text)$/i,
  notice:
    /^(?:notice|lead|body|intro|summary|detail|message|advice|empty|error|warning|none|failed|invalid|busy|blocked|gone|stale|unavailable|missing|declined|approved|created|queued|\w+(?:Body|Lead|Notice|Message|Error|Advice|Empty|Note|Failed|Invalid|Busy))$/i,
};

// An attribute (JSX) names the kind directly.
const ATTRIBUTE_KIND = {
  'aria-label': 'name',
  arialabel: 'name',
  alt: 'name',
  label: 'label',
  legend: 'label',
  title: 'title',
  heading: 'title',
  placeholder: 'hint',
  hint: 'hint',
  help: 'hint',
  description: 'notice',
  body: 'notice',
  lead: 'notice',
  message: 'notice',
};

// The element a piece of JSX text is the child of.
const ELEMENT_KIND = [
  ['button', /^(?:button|\w*Button)$/],
  ['title', /^(?:h[1-6]|\w*Heading|\w*Title)$/],
  ['label', /^(?:label|legend|th|summary|option|a|Link|\w*Link|figcaption|dt)$/],
  ['notice', /^(?:p|\w*Notice|\w*Message)$/],
];

/**
 * Keys whose strings are vocabulary the code matches the buyer's own words against, never text a buyer reads: they are
 * not extracted at all, so they appear in no count and no report.
 */
export const NON_COPY_KEYS = /^(?:words|aliases|alias|synonyms|keywords|stopwords)$/i;

export function isNonCopyKey(key) {
  return key !== undefined && NON_COPY_KEYS.test(key);
}

export function kindOfKey(key) {
  if (key === undefined) return 'unknown';
  for (const kind of KIND_ORDER) if (KEY_PATTERNS[kind].test(key)) return kind;
  return 'unknown';
}

export function kindOfAttribute(attribute) {
  return ATTRIBUTE_KIND[attribute.toLowerCase()] ?? 'unknown';
}

export function kindOfElement(element) {
  for (const [kind, pattern] of ELEMENT_KIND) if (pattern.test(element)) return kind;
  return 'unknown';
}

/**
 * The kind of a string, given where it sits (`{ key }`, `{ attribute }` or `{ element }`, any may be absent) and its text.
 * A button, label or title that ends with a full stop is a sentence: a notice.
 */
export function kindOf({ key, attribute, element }, text = '') {
  let kind = 'unknown';
  if (attribute !== undefined) kind = kindOfAttribute(attribute);
  else if (key !== undefined) kind = kindOfKey(key);
  else if (element !== undefined) kind = kindOfElement(element);
  if ((kind === 'button' || kind === 'label' || kind === 'title') && /\.\s*$/.test(text)) return 'notice';
  return kind;
}
