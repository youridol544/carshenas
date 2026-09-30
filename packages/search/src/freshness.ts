// How recent a listing's last sighting must be for search to show it (CS-59 criterion 5; ADR-0017 point 6: a results
// page shows only listings seen within the last 48 hours). Runs in the browser, so a page can say so.

/** A listing a crawl has not seen for this many hours is left out of search until it is seen again. */
export const SEARCH_FRESHNESS_HOURS = 48;
