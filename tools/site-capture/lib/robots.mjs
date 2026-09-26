// robots.txt as RFC 9309 reads it, for the generic agent (`User-agent: *`) only: the tool never claims to be a
// crawler that a site might have named. Allow and Disallow both count; the longest matching rule wins.

// RFC 9309 2.2.2: rules and paths are compared percent-encoded. A rule may be written in Farsi and the path arrives
// encoded (/خودرو is /%D8%AE…), and escapes may differ in case, so both sides are brought to one form.
const encoded = (text) =>
  text
    .replace(/[^\x00-\x7F]+/g, (chars) => encodeURIComponent(chars))
    .replace(/%[0-9a-f]{2}/gi, (escape) => escape.toUpperCase());

const toRegex = (rule) =>
  new RegExp(
    '^' +
      rule
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\\\$$/, '$'),
  );

/** The Allow and Disallow rules that apply to every agent, in file order. */
export function genericRules(text) {
  const rules = [];
  let applies = false; // the current group names `*`
  let readingAgents = false; // consecutive User-agent lines share one group
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!readingAgents) applies = false;
      readingAgents = true;
      if (value === '*') applies = true;
      continue;
    }
    readingAgents = false;
    if (applies && (key === 'allow' || key === 'disallow') && value) {
      const path = encoded(value);
      rules.push({ allow: key === 'allow', rule: value, octets: path.length, pattern: toRegex(path) });
    }
  }
  return rules;
}

/** The rule that decides `path` (pathname plus search), or undefined when none matches and the path is allowed. */
export function decidingRule(rules, path) {
  const target = encoded(path);
  let winner;
  for (const candidate of rules)
    if (
      candidate.pattern.test(target) &&
      (!winner || candidate.octets > winner.octets || (candidate.octets === winner.octets && candidate.allow))
    )
      winner = candidate;
  return winner;
}
