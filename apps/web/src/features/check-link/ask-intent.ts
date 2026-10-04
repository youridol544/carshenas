// The press of «درخواست افزودن» a visitor made before signing in (CS-115): the tab remembers which link and which model, and
// the answer they come back to places the request once. It lives in the tab's own sessionStorage, never in the address
// and never on the server: a link someone else crafted places nothing, because only this tab's own press leaves the note.
// Every access is guarded: storage may be blocked or full, and the answer then simply offers the button once more.

const KEY = 'carshenas:ask-model';
const LIFETIME_MS = 30 * 60 * 1000;

type Intent = { readonly link: string; readonly modelKey: string | null; readonly at: number };

export function rememberAsk(link: string, modelKey: string | null): void {
  try {
    const note: Intent = { link, modelKey, at: Date.now() };
    window.sessionStorage.setItem(KEY, JSON.stringify(note));
  } catch {
    // Storage is not available: the visitor presses once more after signing in.
  }
}

/** The remembered press for this link, taken (it is forgotten at once, so it places one request at most); null when none. */
export function takeAsk(link: string): { readonly modelKey: string | null } | null {
  try {
    const text = window.sessionStorage.getItem(KEY);
    if (text === null) return null;
    window.sessionStorage.removeItem(KEY);
    const note = JSON.parse(text) as Partial<Intent>;
    if (note.link !== link || typeof note.at !== 'number' || Date.now() - note.at > LIFETIME_MS) return null;
    return { modelKey: typeof note.modelKey === 'string' ? note.modelKey : null };
  } catch {
    return null;
  }
}
