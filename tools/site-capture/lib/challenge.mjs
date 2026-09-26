// Signs that a site is challenging automation. A challenge can arrive after the page has loaded, as an overlay
// over an intact page (DataDome did that on CarGurus), so the capture looks again at every stage and stops at the
// first sign (ADR-0008). It never waits a challenge out, retries or works around one.

// Titles of challenge and block pages: Cloudflare, Akamai, Imperva, DataDome and the generic ones.
const CHALLENGE_TITLE =
  /just a moment|attention required|verify you are (a )?human|access denied|access is temporarily restricted|are you a robot|unusual (traffic|activity)|checking your browser|pardon our interruption|incapsula incident/i;
// What only a challenge or block page says. Looked for on short pages only, and without the title phrases an
// ordinary page may use ("Just a moment, loading…").
const CHALLENGE_TEXT =
  /access is temporarily restricted|verify you are (a )?human|are you a robot|unusual (traffic|activity) from your|checking your browser|pardon our interruption|incapsula incident/i;
// Hosts that serve nothing but a challenge: DataDome's captcha and device check, HUMAN's (PerimeterX) captcha.
// The everyday tags (js.datadome.co, client.px-cloud.net) load on unchallenged pages too and do not count.
const CHALLENGE_HOST = /(^|\.)captcha-delivery\.com$|^captcha\.px-(cdn|cloud)\.net$/;

/** The first sign of a challenge in the page's title, the hosts it requested or its text; undefined if none. */
export function challengeSign({ title = '', hosts = [], text = '' }) {
  if (CHALLENGE_TITLE.test(title)) return `the title "${title.slice(0, 60)}"`;
  const host = hosts.find((name) => CHALLENGE_HOST.test(name));
  if (host) return `a request to ${host}`;
  const phrase = text.length <= 3_000 && text.match(CHALLENGE_TEXT)?.[0];
  return phrase ? `the page saying "${phrase}"` : undefined;
}
