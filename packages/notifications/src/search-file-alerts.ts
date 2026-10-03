// How often Karshenas tells a buyer about a search file (CS-72, ADR-0033), in one place so the matching job that
// enforces it and the file page that explains it say the same numbers.

export const SEARCH_FILE_ALERT_RULES = {
  /** The matching job runs this often (a five-minute schedule). */
  runEveryMinutes: 5,
  /** The fewest minutes between two digests about one file; what arrives meanwhile is told in the next one. */
  minGapMinutes: 120,
  /** The most digests an account gets in a Tehran day, over all its files. */
  dailyCap: 8,
  /** Rows indexed less than this long ago wait for the next run, so a transaction that commits late is still seen. */
  marginSeconds: 60,
} as const;
