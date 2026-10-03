// The numbers the model page measures with (CS-67), one named home for each, so the SQL, the view that draws and the
// Farsi sentence of an info control (model-info.ts) all read the same constant and cannot drift.

/** The price range shown is the middle share of the asking prices: from this fraction of them to that one. */
export const RANGE_LOW_FRACTION = 0.1;
export const RANGE_HIGH_FRACTION = 0.9;

/** The trend's band is the middle half of the day's asking prices. */
export const BAND_LOW_FRACTION = 0.25;
export const BAND_HIGH_FRACTION = 0.75;

/** A point of the trend needs this many rated listings of the model year that day, or it is not drawn. */
export const TREND_MIN_LISTINGS = 8;
/** The trend is drawn from this many points; fewer is «not enough history yet» (the table still lists them). */
export const TREND_MIN_POINTS = 3;
/**
 * While the history is this many days long or shorter every day with enough listings is a point; beyond it the
 * points are weeks (the last day of each week that has one), so a long history stays readable.
 */
export const TREND_DAILY_UNTIL_DAYS = 21;
/** A week starts on Saturday in Iran. */
export const WEEK_START_DAY = 'Saturday';
/** The windows a change is stated over, in days; a change is stated only when the history reaches back that far. */
export const CHANGE_WINDOWS_DAYS = [30, 90] as const;
/** The nearest point to «N days earlier» may be this many days off it, no more. */
export const CHANGE_TOLERANCE_DAYS = 4;

/** Best deals shown, and the model years the page offers. */
export const DEALS_COUNT = 6;

/** The valuation keeps its daily runs this long (S01), which bounds how far back a trend can ever reach. */
export const RUN_KEPT_DAYS = 90;
