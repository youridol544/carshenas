import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUDGET_TIERS, fitsBudget, lowestOpenPriority, reserveFor, tierOf } from './budget.ts';

test("the tiers follow ADR-0017's order, and what comes last keeps the largest reserve", () => {
  assert.deepEqual(
    BUDGET_TIERS.map((tier) => tier.name),
    [
      'discovery',
      'buyer re-checks',
      'new listings',
      'tracked sweep and its checks',
      'backfill',
      'untracked sweep and measurements',
    ],
  );
  for (const [higher, lower] of BUDGET_TIERS.slice(0, -1).map((tier, index) => [
    tier,
    BUDGET_TIERS[index + 1],
  ])) {
    assert.ok(higher && lower && higher.minPriority > lower.minPriority && higher.reserve < lower.reserve);
  }
});

test("a job's priority names its tier: Divar's discovery 60, details 40, measurement 5", () => {
  assert.equal(tierOf(60).name, 'discovery');
  assert.equal(tierOf(99).name, 'discovery');
  assert.equal(tierOf(40).name, 'new listings');
  assert.equal(tierOf(5).name, 'untracked sweep and measurements');
  assert.equal(tierOf(-10).name, 'untracked sweep and measurements');
});

test('a tier spends until only its reserve of the day is left', () => {
  assert.equal(reserveFor(40, 12_000), 600);
  assert.equal(fitsBudget(40, 11_399, 12_000), true);
  assert.equal(fitsBudget(40, 11_400, 12_000), false);
  assert.equal(fitsBudget(60, 11_999, 12_000), true);
  assert.equal(fitsBudget(60, 12_000, 12_000), false);
  // A reserve rounds up: a small budget still keeps one request for the tiers above.
  assert.equal(reserveFor(50, 10), 1);
});

test('the lane claims from the lowest priority the budget still covers, and nothing once it is spent', () => {
  assert.equal(lowestOpenPriority(0, 12_000), undefined);
  assert.equal(lowestOpenPriority(8_399, 12_000), undefined);
  assert.equal(lowestOpenPriority(8_400, 12_000), 20);
  assert.equal(lowestOpenPriority(10_800, 12_000), 40);
  assert.equal(lowestOpenPriority(11_999, 12_000), 60);
  assert.equal(lowestOpenPriority(12_000, 12_000), null);
});
