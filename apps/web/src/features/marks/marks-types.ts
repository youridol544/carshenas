// What the mark control reads and its action answers (CS-69). Plain data: the listing ids a signed-in buyer has marked,
// or the fact that nobody is signed in; the control never sees another buyer's marks.

export type MarkSnapshot =
  { readonly signedIn: false } | { readonly signedIn: true; readonly marked: readonly number[] };

/** What setListingMarkedAction answers; a failure's message is Farsi and says what to do. */
export type MarkActionResult =
  | { readonly status: 'done' }
  | {
      readonly status: 'failed';
      readonly reason: 'signed_out' | 'full' | 'missing' | 'unavailable';
      readonly message: string;
    };
