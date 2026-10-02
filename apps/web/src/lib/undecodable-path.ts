// An address with a malformed percent-escape («/listings/%E0%A4%A»): Next.js 16.3.5 fails inside its own decoding of
// route parameters, before any page runs, and answers a plain English «400: Bad Request» (or, measured on
// /diagnostics/[failure] in CS-30, a plain-text 500) with no Farsi and no way out. A path no page can read is a path to
// nothing, so src/proxy.ts answers it with the app's own not-found page, which says so in Farsi and offers the way back
// (CS-64). The check is the browser's own decoder: the same text that makes decodeURIComponent throw is what Next.js
// cannot decode.

/** True when the path holds a percent-escape that is not valid UTF-8. */
export function isUndecodablePath(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}
