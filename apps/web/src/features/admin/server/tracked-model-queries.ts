import 'server-only';
import type { ReadonlyKysely } from 'kysely/readonly';
import type { DB } from '@carshenas/db/db-types';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';
import { readCrawlPaused } from '@/server/db/crawl-request-reads';
import { equalsLiteral, isoDateText, laterOf, medianMinutesSince, secondsAgo } from '@/server/db/sql-helpers';
import { carNameOf } from '@/lib/crawl-requests-names';
import {
  MAX_UNTRACKED_QUERY_LENGTH,
  UNTRACKED_LIMIT,
  type TrackedPriority,
  type TrackedState,
} from '@/lib/tracked-models-rules';

// The superadmin's tracked-models screen (CS-53, ADR-0037), through the section's own role (ADR-0023): each model read
// in depth with its sync (active listings, new and gone in the last day, the median age of the last read, the last
// sweep, the date of its market value, the share of listings with details and with a rating), how it came to be and
// who changed it last; the models not tracked, by their active listings; and the latest changes. It asks for the
// superadmin itself: a page is never the guard (ADR-0020 point 10). Plans are in the task's notes.

const HISTORY_PER_MODEL = 4;
const RECENT_LIMIT = 8;
const HISTORY_FETCH = 400;
const ONE_DAY_SECONDS = 86_400;

export type ChangeAction =
  | 'seeded'
  | 'tracked'
  | 'from_request'
  | 'paused'
  | 'resumed'
  | 'priority_changed'
  | 'untracked'
  | 'request_withdrawn';

export type TrackedChange = {
  action: ChangeAction;
  fromValue: string | null;
  toValue: string | null;
  /** The superadmin's username; null for the seed. */
  by: string | null;
  at: string;
};

export type RecentChange = TrackedChange & { carName: string };

export type SyncFigures = {
  active: number;
  withDetails: number;
  /** Active listings with a deal rating in the latest valuation. */
  rated: number;
  newInDay: number;
  goneInDay: number;
  /** The median minutes since an active listing was last seen or read; null with no active listing. */
  medianAgeMinutes: number | null;
  /** The last complete sweep of the model's keys, by its own clock; null when none was read. */
  lastSweepAt: string | null;
};

export type TrackedCard = {
  /** model:trim, the card's key on the page and in the forms. */
  key: string;
  modelId: number;
  trimId: number | null;
  carName: string;
  state: TrackedState;
  priority: TrackedPriority;
  origin: 'seed' | 'superadmin' | 'request';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  /** An approved crawl request that is not read yet is answered by this scope: it is neither paused nor removed by hand. */
  heldByRequest: boolean;
  /** The approved request that made it, with who approved it and when; and whether that request is still waiting. */
  request: { id: number; state: string; decidedBy: string | null; decidedAt: string | null } | null;
  figures: SyncFigures;
  history: TrackedChange[];
};

export type TrimChoice = { id: number; name: string };

export type UntrackedRow = {
  modelId: number;
  carName: string;
  active: number;
  trims: TrimChoice[];
};

export type AdminTrackedModels = {
  tracked: TrackedCard[];
  untracked: UntrackedRow[];
  query: string;
  recent: RecentChange[];
  crawlPaused: boolean;
  /** The Tehran day of the latest succeeded valuation, ISO date; null before the first one. */
  valuedOn: string | null;
};

type Reader = ReadonlyKysely<DB>;

/** The search text from the address: one line, bounded, never trusted. */
export function readUntrackedQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_UNTRACKED_QUERY_LENGTH);
}

/** LIKE's wildcard for any run of characters, built here so no percent sign is written by hand beside a number. */
const ANY_TEXT = String.fromCharCode(0x25);

function likeEscaped(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

const PRIORITY_ORDER: Record<TrackedPriority, number> = { high: 0, normal: 1, low: 2 };

export async function loadTrackedModels(query: string): Promise<AdminTrackedModels> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  const publicSchema = database as unknown as Reader;
  const pattern = query === '' ? null : `${ANY_TEXT}${likeEscaped(query)}${ANY_TEXT}`;

  const [rows, figureRows, ratedRows, sweepRows, untrackedRows, historyRows, recentRows, run, paused] =
    await Promise.all([
      database
        .selectFrom('tracked_model as t')
        .innerJoin('model as m', 'm.id', 't.model_id')
        .innerJoin('make as k', 'k.id', 'm.make_id')
        .leftJoin('trim as tr', 'tr.id', 't.trim_id')
        .leftJoin('account as creator', 'creator.id', 't.created_by_account_id')
        .leftJoin('account as updater', 'updater.id', 't.updated_by_account_id')
        .leftJoin('crawl_request as r', 'r.id', 't.crawl_request_id')
        .leftJoin('account as approver', 'approver.id', 'r.decided_by_account_id')
        .select((eb) => [
          't.id',
          't.model_id',
          't.trim_id',
          't.state',
          't.priority',
          't.origin',
          't.created_at',
          't.updated_at',
          'creator.username as created_by',
          'updater.username as updated_by',
          eb
            .exists(
              eb
                .selectFrom('crawl_request as hr')
                .select('hr.id')
                .whereRef('hr.model_id', '=', 't.model_id')
                .where('hr.state', '=', 'approved')
                .where((cover) =>
                  cover.or([
                    cover('t.trim_id', 'is', null),
                    cover('hr.trim_id', '=', cover.ref('t.trim_id')),
                  ]),
                ),
            )
            .as('held'),
          'r.id as request_id',
          'r.state as request_state',
          'r.decided_at as request_decided_at',
          'approver.username as request_decided_by',
          'm.name_fa as model_fa',
          'm.name_en as model_en',
          'k.name_fa as make_fa',
          'k.name_en as make_en',
          'tr.name_fa as trim_fa',
          'tr.name_en as trim_en',
        ])
        .execute(),
      // The model's listings (a trim's, for a trim), whatever their state: counts of what is active, of what its own
      // page was read for, of what arrived and left in the last day, and how long ago the active ones were read.
      database
        .selectFrom('tracked_model as t')
        .innerJoin('listing as l', (join) =>
          join
            .onRef('l.model_id', '=', 't.model_id')
            .on((eb) => eb.or([eb('t.trim_id', 'is', null), eb('l.trim_id', '=', eb.ref('t.trim_id'))])),
        )
        .select((eb) => [
          't.id',
          eb.fn.countAll<number>().filterWhere(equalsLiteral('l.status', 'active')).as('active'),
          eb.fn
            .countAll<number>()
            .filterWhere(equalsLiteral('l.status', 'active'))
            .filterWhere('l.last_checked_at', 'is not', null)
            .as('with_details'),
          eb.fn
            .countAll<number>()
            .filterWhere('l.created_at', '>', secondsAgo(ONE_DAY_SECONDS))
            .as('new_in_day'),
          eb.fn
            .countAll<number>()
            .filterWhere('l.delisted_at', '>', secondsAgo(ONE_DAY_SECONDS))
            .as('gone_in_day'),
          medianMinutesSince(
            laterOf('l.last_seen_at', 'l.last_checked_at'),
            equalsLiteral('l.status', 'active'),
          ).as('median_age'),
        ])
        .groupBy('t.id')
        .execute(),
      database
        .selectFrom('tracked_model as t')
        .innerJoin('listing as l', (join) =>
          join
            .onRef('l.model_id', '=', 't.model_id')
            .on((eb) => eb.or([eb('t.trim_id', 'is', null), eb('l.trim_id', '=', eb.ref('t.trim_id'))])),
        )
        .innerJoin('listing_valuation as v', 'v.listing_id', 'l.id')
        .select((eb) => ['t.id', eb.fn.countAll<number>().as('rated')])
        .where('l.status', '=', 'active')
        .where('v.deal_rating', 'is not', null)
        .where('v.valuation_run_id', '=', (eb) =>
          eb
            .selectFrom('valuation_run')
            .select('id')
            .where('status', '=', 'succeeded')
            .orderBy('as_of_date', 'desc')
            .limit(1),
        )
        .groupBy('t.id')
        .execute(),
      database
        .selectFrom('tracked_model as t')
        .innerJoin('catalogue_source_key as k', (join) =>
          join
            .onRef('k.model_id', '=', 't.model_id')
            .on((eb) => eb.or([eb('t.trim_id', 'is', null), eb('k.trim_id', '=', eb.ref('t.trim_id'))])),
        )
        .innerJoin('model_volume as v', (join) =>
          join
            .onRef('v.source_id', '=', 'k.source_id')
            .onRef('v.source_model_key', '=', 'k.source_model_key'),
        )
        .select((eb) => ['t.id', eb.fn.max('v.swept_at').as('last_sweep')])
        .where('v.complete', '=', true)
        .groupBy('t.id')
        .execute(),
      database
        .selectFrom('listing as l')
        .innerJoin('model as m', 'm.id', 'l.model_id')
        .innerJoin('make as k', 'k.id', 'm.make_id')
        .select((eb) => [
          'm.id as model_id',
          'm.name_fa as model_fa',
          'm.name_en as model_en',
          'k.name_fa as make_fa',
          'k.name_en as make_en',
          eb.fn.countAll<number>().as('active'),
        ])
        .where('l.status', '=', 'active')
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom('tracked_model as t')
                .select('t.id')
                .whereRef('t.model_id', '=', 'm.id')
                .where('t.trim_id', 'is', null),
            ),
          ),
        )
        .$if(pattern !== null, (builder) =>
          builder.where((eb) =>
            eb.or([
              eb('m.name_en', 'ilike', pattern ?? ''),
              eb('m.name_fa', 'ilike', pattern ?? ''),
              eb('m.slug', 'ilike', pattern ?? ''),
              eb('k.name_en', 'ilike', pattern ?? ''),
              eb('k.name_fa', 'ilike', pattern ?? ''),
            ]),
          ),
        )
        .groupBy(['m.id', 'm.name_fa', 'm.name_en', 'k.name_fa', 'k.name_en'])
        .orderBy('active', 'desc')
        .orderBy('m.id')
        .limit(UNTRACKED_LIMIT)
        .execute(),
      database
        .selectFrom('tracked_model_change as c')
        .leftJoin('account as who', 'who.id', 'c.by_account_id')
        .select([
          'c.model_id',
          'c.trim_id',
          'c.action',
          'c.from_value',
          'c.to_value',
          'c.changed_at',
          'who.username as by',
        ])
        .where('c.model_id', 'in', (eb) => eb.selectFrom('tracked_model').select('model_id'))
        .orderBy('c.changed_at', 'desc')
        .orderBy('c.id', 'desc')
        .limit(HISTORY_FETCH)
        .execute(),
      database
        .selectFrom('tracked_model_change as c')
        .innerJoin('model as m', 'm.id', 'c.model_id')
        .innerJoin('make as k', 'k.id', 'm.make_id')
        .leftJoin('trim as tr', 'tr.id', 'c.trim_id')
        .leftJoin('account as who', 'who.id', 'c.by_account_id')
        .select([
          'c.action',
          'c.from_value',
          'c.to_value',
          'c.changed_at',
          'who.username as by',
          'm.name_fa as model_fa',
          'm.name_en as model_en',
          'k.name_fa as make_fa',
          'k.name_en as make_en',
          'tr.name_fa as trim_fa',
          'tr.name_en as trim_en',
        ])
        .orderBy('c.changed_at', 'desc')
        .orderBy('c.id', 'desc')
        .limit(RECENT_LIMIT)
        .execute(),
      database
        .selectFrom('valuation_run')
        .select(isoDateText('as_of_date').as('as_of_date'))
        .where('status', '=', 'succeeded')
        .orderBy('as_of_date', 'desc')
        .limit(1)
        .executeTakeFirst(),
      readCrawlPaused(publicSchema),
    ]);

  const trimsByModel = new Map<number, TrimChoice[]>();
  if (untrackedRows.length > 0) {
    const trimRows = await database
      .selectFrom('trim as tr')
      .select(['tr.id', 'tr.model_id', 'tr.name_fa', 'tr.name_en'])
      .where(
        'tr.model_id',
        'in',
        untrackedRows.map((row) => row.model_id),
      )
      .orderBy('tr.name_en')
      .execute();
    for (const trim of trimRows) {
      const list = trimsByModel.get(trim.model_id) ?? [];
      list.push({
        id: trim.id,
        name: carNameOf({
          makeFa: null,
          makeEn: '',
          modelFa: null,
          modelEn: '',
          trimFa: trim.name_fa,
          trimEn: trim.name_en,
        }),
      });
      trimsByModel.set(trim.model_id, list);
    }
  }

  const figuresOf = new Map(figureRows.map((row) => [row.id, row]));
  const ratedOf = new Map(ratedRows.map((row) => [row.id, row.rated]));
  const sweepOf = new Map(sweepRows.map((row) => [row.id, row.last_sweep]));
  const historyOf = new Map<string, TrackedChange[]>();
  for (const row of historyRows) {
    const key = `${String(row.model_id)}:${String(row.trim_id ?? 0)}`;
    const list = historyOf.get(key) ?? [];
    if (list.length < HISTORY_PER_MODEL)
      list.push({
        action: row.action,
        fromValue: row.from_value,
        toValue: row.to_value,
        by: row.by,
        at: row.changed_at.toISOString(),
      });
    historyOf.set(key, list);
  }

  const tracked = rows
    .map((row): TrackedCard => {
      const key = `${String(row.model_id)}:${String(row.trim_id ?? 0)}`;
      const figures = figuresOf.get(row.id);
      return {
        key,
        modelId: row.model_id,
        trimId: row.trim_id,
        carName: carNameOf({
          makeFa: row.make_fa,
          makeEn: row.make_en,
          modelFa: row.model_fa,
          modelEn: row.model_en,
          trimFa: row.trim_fa,
          trimEn: row.trim_en,
        }),
        state: row.state,
        priority: row.priority,
        origin: row.origin,
        createdBy: row.created_by,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        updatedBy: row.updated_by,
        heldByRequest: Boolean(row.held),
        request:
          row.request_id === null
            ? null
            : {
                id: row.request_id,
                state: row.request_state ?? 'approved',
                decidedBy: row.request_decided_by,
                decidedAt: row.request_decided_at?.toISOString() ?? null,
              },
        figures: {
          active: figures?.active ?? 0,
          withDetails: figures?.with_details ?? 0,
          rated: ratedOf.get(row.id) ?? 0,
          newInDay: figures?.new_in_day ?? 0,
          goneInDay: figures?.gone_in_day ?? 0,
          medianAgeMinutes: figures?.median_age ?? null,
          lastSweepAt: sweepOf.get(row.id)?.toISOString() ?? null,
        },
        history: historyOf.get(key) ?? [],
      };
    })
    // Read now first, then the paused; inside each, the most important first, then the oldest.
    .sort(
      (a, b) =>
        Number(a.state === 'paused') - Number(b.state === 'paused') ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.key.localeCompare(b.key),
    );

  return {
    tracked,
    untracked: untrackedRows.map((row) => ({
      modelId: row.model_id,
      carName: carNameOf({
        makeFa: row.make_fa,
        makeEn: row.make_en,
        modelFa: row.model_fa,
        modelEn: row.model_en,
      }),
      active: row.active,
      trims: trimsByModel.get(row.model_id) ?? [],
    })),
    query,
    recent: recentRows.map((row) => ({
      action: row.action,
      fromValue: row.from_value,
      toValue: row.to_value,
      by: row.by,
      at: row.changed_at.toISOString(),
      carName: carNameOf({
        makeFa: row.make_fa,
        makeEn: row.make_en,
        modelFa: row.model_fa,
        modelEn: row.model_en,
        trimFa: row.trim_fa,
        trimEn: row.trim_en,
      }),
    })),
    crawlPaused: paused,
    valuedOn: run?.as_of_date ?? null,
  };
}
