// A source's daily request budget, spent in ADR-0017's order (point 5): discovery; re-checks and pasted links a
// buyer triggers; details of new tracked listings; the tracked sweep and the checks it triggers; backfills; the
// untracked sweep. What comes last is dropped first. Lane jobs carry these kinds as pg-boss priorities, so each tier
// is a range of priorities, and each keeps a reserve: the share of the day's budget it leaves for the tiers above it.
// A job may take a lease only while the requests already spent today leave its tier's reserve untouched; the lane
// counts them in the database when it takes the lease (lane-store.ts), and the lane supervisor stops claiming the
// tiers that can no longer spend (pg-boss's minPriority), until the next Tehran day.

export type BudgetTier = {
  /** The lowest job priority in the tier. */
  readonly minPriority: number;
  /** The share of the day's budget kept for the tiers above: the tier stops once the rest is spent. */
  readonly reserve: number;
  readonly name: string;
};

/** Highest priority first. A job's tier is the first whose minPriority it reaches. */
export const BUDGET_TIERS: readonly BudgetTier[] = [
  { minPriority: 60, reserve: 0, name: 'discovery' },
  { minPriority: 50, reserve: 0.02, name: 'buyer re-checks' },
  { minPriority: 40, reserve: 0.05, name: 'new listings' },
  { minPriority: 30, reserve: 0.1, name: 'tracked sweep and its checks' },
  { minPriority: 20, reserve: 0.2, name: 'backfill' },
  { minPriority: Number.MIN_SAFE_INTEGER, reserve: 0.3, name: 'untracked sweep and measurements' },
];

export function tierOf(priority: number): BudgetTier {
  const tier = BUDGET_TIERS.find((candidate) => priority >= candidate.minPriority);
  if (!tier) throw new Error(`no budget tier for priority ${String(priority)}`);
  return tier;
}

/** How many of the day's requests a job of this priority must leave unspent. */
export function reserveFor(priority: number, dailyBudget: number): number {
  return Math.ceil(dailyBudget * tierOf(priority).reserve);
}

/** Whether one more request of this priority fits in what is left of the day's budget. */
export function fitsBudget(priority: number, spentToday: number, dailyBudget: number): boolean {
  return spentToday + 1 <= dailyBudget - reserveFor(priority, dailyBudget);
}

/**
 * The lowest priority a lane may still claim today: undefined when every tier can still spend, null when none can
 * (the day's budget is spent).
 */
export function lowestOpenPriority(spentToday: number, dailyBudget: number): number | null | undefined {
  const open = BUDGET_TIERS.filter((tier) => fitsBudget(tier.minPriority, spentToday, dailyBudget));
  if (open.length === BUDGET_TIERS.length) return undefined;
  const lowest = open.at(-1);
  return lowest ? lowest.minPriority : null;
}
