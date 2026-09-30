// The fixtures' names and the instant their ages are counted from, apart from the seeding code so the unit tests can
// read the cases without a database driver.
import { solarHijriYear } from '../src/year.ts';

export const FIXTURE_NAMES = ['A', 'B', 'C', 'D', 'E'] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

/** The instant the tests run at: the SQL is given the same one, so a car's age is counted from the same year. */
export const NOW = new Date();
export const YEAR = solarHijriYear(NOW);
