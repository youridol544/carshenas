import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { formatDateTime } from '@carshenas/locale/format-date';
import { DataStatusReport } from '@/features/data-status/components/data-status-report';
import {
  INDEX_STATE_HEADLINE,
  SOURCE_STATE_LABEL,
  STATUS_COPY,
  TARGET_COPY,
  TARGET_STATUS_LABEL,
} from '@/features/data-status/data-status-copy';
import type { DataStatus, SourceStatus } from '@/features/data-status/data-status-types';

// The data-status page's figures on their own (CS-66): a live source, a paused one with the date of its latest data
// and no reason, the targets with their words, and the empty states when nothing has been measured yet.

const MEASURED_AT = '2026-10-01T08:00:00.000Z';
const LAST_READ = '2026-09-30T20:09:43.000Z';

function source(overrides: Partial<SourceStatus>): SourceStatus {
  return {
    id: 'divar',
    nameFa: 'دیوار',
    state: 'live',
    dailyRequestBudget: 12_000,
    postingToStoredMedianMinutes: 45,
    series: [],
    figures: {
      active: 23_364,
      postedLast24h: 2_596,
      goneLast24h: 77,
      lastReadAt: LAST_READ,
      firstStoredAt: '2026-09-30T08:01:13.000Z',
      trackedActive: 23_358,
      shown: 23_358,
      shownCheckMedianMinutes: 291,
    },
    ...overrides,
  };
}

function status(overrides: Partial<DataStatus>): DataStatus {
  const divar = source({});
  return {
    measuredAt: MEASURED_AT,
    tehranToday: '2026-10-01',
    index: { state: divar.state, figures: divar.figures },
    sources: [divar],
    valuation: {
      asOfDate: '2026-09-30',
      finishedAt: '2026-09-30T14:46:40.000Z',
      comparables: 707,
      valued: 919,
      rated: 663,
      models: [
        { modelId: 1, name: 'پژو ۲۰۶', comparables: 188, errorPct: 5.59 },
        { modelId: 2, name: 'سمند سورن', comparables: 21, errorPct: 11.03 },
      ],
    },
    extraction: {
      evaluatedOn: '2026-09-30',
      items: 66,
      itemsRight: 65,
      fieldsScored: 792,
      fieldsRight: 791,
      injectedItems: 11,
      injectedHeld: 11,
    },
    ...overrides,
  };
}

/** A target's row: the list item holding its heading. */
function target(title: string): HTMLElement {
  const targets = screen.getByRole('region', { name: STATUS_COPY.targetsTitle });
  const row = within(targets)
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('heading', { name: title }) !== null);
  if (row === undefined) throw new Error(`no target named ${title}`);
  return row;
}

test('a live source shows its figures and no note; the targets say whether each is kept', () => {
  render(<DataStatusReport data={status({})} />);
  expect(screen.getByText(INDEX_STATE_HEADLINE.live)).toBeInTheDocument();
  const card = screen.getByRole('article', { name: 'دیوار' });
  expect(within(card).getByText(SOURCE_STATE_LABEL.live)).toBeInTheDocument();
  expect(
    within(card).queryByText(STATUS_COPY.sourceNotUpdating.before, { exact: false }),
  ).not.toBeInTheDocument();
  expect(card).toHaveTextContent('۲۳٬۳۶۴');

  const newListing = target(TARGET_COPY.newListing.title);
  expect(newListing).toHaveTextContent(TARGET_STATUS_LABEL.met);
  expect(newListing).toHaveTextContent('۴۵ دقیقه');
});

test('a paused source is shown as not being updated, with the date of its latest data and no reason', () => {
  const paused = source({ state: 'not_updating' });
  render(
    <DataStatusReport
      data={status({ sources: [paused], index: { state: 'not_updating', figures: paused.figures } })}
    />,
  );
  expect(screen.getByText(INDEX_STATE_HEADLINE.not_updating)).toBeInTheDocument();
  const card = screen.getByRole('article', { name: 'دیوار' });
  expect(within(card).getByText(SOURCE_STATE_LABEL.not_updating)).toBeInTheDocument();
  const note = within(card).getByText(STATUS_COPY.sourceNotUpdating.before, { exact: false });
  expect(note).toHaveTextContent(formatDateTime(LAST_READ));
  // Why a source stopped is the superadmin's to read, never the visitor's.
  expect(card).not.toHaveTextContent(/درخواست را رد کرد|ضدربات|blocked|challenge/);
});

test('a missed target is shown as missed, with what was measured', () => {
  const slow = source({ postingToStoredMedianMinutes: 162 });
  render(<DataStatusReport data={status({ sources: [slow] })} />);
  const newListing = target(TARGET_COPY.newListing.title);
  expect(newListing).toHaveTextContent(TARGET_STATUS_LABEL.missed);
  expect(newListing).toHaveTextContent('۳ ساعت');
});

test('market values show their day, counts and each model’s error; text reading shows counts, never a rounded percentage', () => {
  render(<DataStatusReport data={status({})} />);
  const valuation = screen.getByRole('region', { name: STATUS_COPY.valuationTitle });
  expect(valuation).toHaveTextContent('۸ مهر ۱۴۰۵');
  expect(valuation).toHaveTextContent('۹۱۹');
  expect(within(valuation).getByText('سمند سورن')).toBeInTheDocument();
  const extraction = screen.getByRole('region', { name: STATUS_COPY.extractionTitle });
  expect(extraction).toHaveTextContent('۷۹۱');
  expect(extraction).toHaveTextContent('۷۹۲');
  expect(extraction).not.toHaveTextContent('۱۰۰');
});

test('before anything is measured, each part says so instead of showing zeros as facts', () => {
  render(
    <DataStatusReport
      data={status({
        sources: [],
        index: {
          state: 'not_updating',
          figures: { ...source({}).figures, lastReadAt: null, firstStoredAt: null },
        },
        valuation: null,
        extraction: null,
      })}
    />,
  );
  expect(screen.getByText(STATUS_COPY.noData)).toBeInTheDocument();
  expect(screen.getByText(STATUS_COPY.noSources)).toBeInTheDocument();
  expect(screen.getByText(STATUS_COPY.noValuation)).toBeInTheDocument();
  expect(screen.getByText(STATUS_COPY.noExtraction)).toBeInTheDocument();
  const targets = screen.getByRole('region', { name: STATUS_COPY.targetsTitle });
  expect(within(targets).getAllByText(TARGET_STATUS_LABEL.unmeasured).length).toBeGreaterThanOrEqual(2);
});
