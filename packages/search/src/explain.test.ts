import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCount, formatPercent } from '@carshenas/locale/format-number';
import { formatTomanCompact, toToman } from '@carshenas/locale/toman';
import {
  CATALOGUES,
  FAMILY_MAX_AGE_YEARS,
  GREAT_DEALS_PRICE_MAX_TOMAN,
  NEWEST_WITHIN_DAYS,
  RIDE_HAILING_MAX_AGE_YEARS,
} from './catalogues.ts';
import { explainCatalogue, explainFilter } from './explain.ts';
import {
  DEAL_GAP_PCT,
  FILTERS,
  LOW_MILEAGE_KM_PER_YEAR,
  lowMileageForAge,
  NORMAL_KM_PER_YEAR,
  POPULAR_MODEL_RANK,
  popularModel,
  deal,
  postedWithin,
} from './filters.ts';

// The info control's text (owner, 2026-10-01): every rule filter and every catalogue explains exactly what it
// measures, in Farsi, with the numbers its SQL uses, printed from the same constants.

const PERSIAN_LETTER = /[\u0600-\u06FF]/;

function assertSentence(text: string, what: string) {
  assert.match(text, PERSIAN_LETTER, what);
  assert.match(text, /\.$/, `${what} ends a sentence: ${text}`);
}

test('every rule filter says what it measures, for every value the sheet offers', () => {
  for (const filter of FILTERS) {
    switch (filter.kind) {
      case 'flag':
        assertSentence(filter.rule, filter.id);
        // A popover shows the description and then the rule: they say two things, never one sentence twice.
        assert.notEqual(filter.description, filter.rule, `${filter.id}'s popover repeats itself`);
        break;
      case 'limit':
        for (const value of filter.choices) {
          const rule = filter.rule(value);
          assertSentence(rule, `${filter.id} ${String(value)}`);
          const shown = filter.id === 'posted_within' && value === 1 ? 24 : value;
          assert.ok(rule.includes(formatCount(shown)), `${filter.id}'s rule names its value: ${rule}`);
        }
        break;
      case 'ranked':
        for (const option of filter.options) {
          assertSentence(explainFilter(filter, option.value).text, `${filter.id} ${option.value}`);
        }
        break;
      case 'choice':
      case 'range':
        break;
    }
  }
});

test('the numbers in the rules are the constants the SQL uses', () => {
  assert.ok(lowMileageForAge.rule.includes(formatCount(LOW_MILEAGE_KM_PER_YEAR)), lowMileageForAge.rule);
  assert.deepEqual(lowMileageForAge.predicate, {
    kind: 'mileageForAgeAtMost',
    kmPerYear: LOW_MILEAGE_KM_PER_YEAR,
  });
  // The popover states one number, the rule's. The model's own norm is not a number a buyer can use (CS-110, the
  // voice guide section 5), and two different figures in one popover contradicted each other.
  assert.ok(!lowMileageForAge.description.includes(formatCount(NORMAL_KM_PER_YEAR)));
  assert.ok(popularModel.rule.includes(formatCount(POPULAR_MODEL_RANK)), popularModel.rule);
  assert.deepEqual(popularModel.predicate, {
    kind: 'atMost',
    column: 'model_rank',
    value: POPULAR_MODEL_RANK,
  });
  const rules = Object.fromEntries(deal.options.map((option) => [option.value, option.rule ?? '']));
  for (const rating of ['great', 'good', 'fair', 'high'] as const) {
    assert.ok(rules[rating]?.includes(formatPercent(Math.abs(DEAL_GAP_PCT[rating]) / 100)), rules[rating]);
  }
});

test('the catalogues print their numbers from their constants', () => {
  const byId = Object.fromEntries(CATALOGUES.map((catalogue) => [catalogue.id, catalogue]));
  const budget = formatTomanCompact(toToman(GREAT_DEALS_PRICE_MAX_TOMAN));
  assert.ok(byId['great-deals-under-1b']?.title.includes(budget));
  // «عالی» is the rating's own band: the description quotes the boundary the rating applies, never a second copy.
  assert.ok(
    byId['great-deals-under-1b']?.description.includes(formatPercent(Math.abs(DEAL_GAP_PCT.great) / 100)),
  );
  assert.deepEqual(byId['great-deals-under-1b']?.filters.price, { max: GREAT_DEALS_PRICE_MAX_TOMAN });
  assert.ok(byId.family?.description.includes(formatCount(FAMILY_MAX_AGE_YEARS)));
  assert.equal(byId.family?.filters.age, FAMILY_MAX_AGE_YEARS);
  assert.ok(byId['ride-hailing']?.description.includes(formatCount(RIDE_HAILING_MAX_AGE_YEARS)));
  assert.equal(byId['ride-hailing']?.filters.age, RIDE_HAILING_MAX_AGE_YEARS);
  assert.ok(byId.newest?.description.includes(postedWithin.chip(NEWEST_WITHIN_DAYS)));
});

test('every catalogue explains each condition it requires, one line per filter, and its order', () => {
  for (const catalogue of CATALOGUES) {
    const explanation = explainCatalogue(catalogue.id, (_, value) => `«${value}»`);
    assert.equal(explanation.conditions.length, Object.keys(catalogue.filters).length, catalogue.id);
    for (const condition of explanation.conditions) {
      assert.match(condition.label, PERSIAN_LETTER);
      assert.ok(condition.text.trim().length > 1, `${catalogue.id}.${condition.filterId}`);
    }
    assert.match(explanation.order, PERSIAN_LETTER);
  }
  const clean = explainCatalogue('clean-and-easy');
  const texts = clean.conditions.map((condition) => condition.text);
  assert.ok(texts.includes(lowMileageForAge.rule));
  assert.ok(texts.includes(popularModel.rule));
  assert.deepEqual(
    clean.conditions.map((condition) => condition.filterId),
    [
      'low_mileage_for_age',
      'popular_model',
      'paint_free',
      'engine_condition',
      'gearbox_condition',
      'chassis',
      'no_accident',
      'no_replaced_parts',
    ],
  );
});
