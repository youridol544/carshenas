// @vitest-environment node
import { expect, test } from 'vitest';
import { CATALOGUES } from '@carshenas/search/catalogues';
import { explainCatalogue } from '@carshenas/search/explain';
import { FILTERS, lowMileageForAge, LOW_MILEAGE_KM_PER_YEAR, deal, age } from '@carshenas/search/filters';
import { formatCount } from '@carshenas/locale/format-number';
import { catalogueInfo, filterInfo } from '@/features/search/info-content';

// The words behind every info control are the definitions' own (CS-58): never a second copy.

test('a rule filter shows its description and its exact measure, with the number the query uses', () => {
  const info = filterInfo(lowMileageForAge);
  expect(info.title).toBe(lowMileageForAge.label);
  expect(info.sections[0]?.paragraphs).toEqual([lowMileageForAge.description]);
  expect(info.sections[1]?.paragraphs).toEqual([lowMileageForAge.rule]);
  expect(lowMileageForAge.rule).toContain(formatCount(LOW_MILEAGE_KM_PER_YEAR));
});

test('the deal filter explains each rating against market value', () => {
  const rows = filterInfo(deal).sections[1]?.rows ?? [];
  expect(rows.map((row) => row.label)).toEqual(deal.options.map((option) => option.label));
  expect(rows.map((row) => row.text)).toEqual(deal.options.map((option) => option.rule));
});

test('a limit filter explains each value it offers', () => {
  const rows = filterInfo(age).sections[1]?.rows ?? [];
  expect(rows.map((row) => row.text)).toEqual(age.choices.map((choice) => age.rule(choice)));
});

test('every filter has an explanation that says something', () => {
  for (const filter of FILTERS) {
    const info = filterInfo(filter);
    expect(info.title).toBe(filter.label);
    expect(info.sections.length).toBeGreaterThan(0);
    for (const section of info.sections) {
      expect(
        section.paragraphs?.length ?? section.rows?.length ?? 0,
        `${filter.id} ${section.id}`,
      ).toBeGreaterThan(0);
    }
  }
});

test('a catalogue shows its description, one line per condition and its order, as explain.ts words them', () => {
  for (const catalogue of CATALOGUES) {
    const explained = explainCatalogue(catalogue.id, () => 'برچسب');
    const info = catalogueInfo(catalogue.id, () => 'برچسب');
    expect(info.title).toBe(catalogue.title);
    expect(info.sections[0]?.paragraphs).toEqual([explained.description]);
    expect(info.sections[1]?.rows?.map((row) => row.text)).toEqual(
      explained.conditions.map((condition) => condition.text),
    );
    expect(info.sections[2]?.paragraphs).toEqual([explained.order]);
  }
});
