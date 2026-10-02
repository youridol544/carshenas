import 'server-only';

// Keeps a typed query's digits out of the log when they could be a phone number: seven or more digits in a row, or nine
// or more across spaces, dots and dashes («0912 345 6789», «۰۹۱۲-۳۴۵-۶۷۸۹»). A model year and a price in one query
// («206 تیپ ۵ ۱۳۹۷») stay readable, since words sit between them.
export function loggableWords(words: string | undefined): string | undefined {
  return words?.replace(/[0-9۰-۹٠-٩](?:[ .\-\u200c]?[0-9۰-۹٠-٩]){8,}/g, '#').replace(/[0-9۰-۹٠-٩]{7,}/g, '#');
}
