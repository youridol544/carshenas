import 'server-only';
import type { ReadonlyKysely } from 'kysely/readonly';
import type { DB } from '@carshenas/db/db-types';
import { carNameOf } from '@/lib/crawl-requests-names';
import type { RequestScope } from '@/lib/crawl-requests-scope';
import type { ScopeStatus } from '@/lib/crawl-requests-types';

// The reads the buyer's page and the superadmin's screen share (CS-71, ADR-0036): a file's scopes found in the
// catalogue, and where each stands (a request, a decision, or read in depth already). The handle is the caller's, as
// the match counts' is (search-file-matches.ts): one role per side, the same SQL. Plans are in the task's notes.

export type ResolvedScope = {
  readonly key: string;
  readonly modelId: number;
  readonly trimId: number | null;
  readonly carName: string;
};

/** The catalogue rows the scopes name, in the scopes' order; a scope the catalogue no longer knows is left out. */
export async function resolveScopes(
  db: ReadonlyKysely<DB>,
  scopes: readonly RequestScope[],
): Promise<ResolvedScope[]> {
  if (scopes.length === 0) return [];
  const makeSlugs = [...new Set(scopes.map((scope) => scope.makeSlug))];
  const modelSlugs = [...new Set(scopes.map((scope) => scope.modelSlug))];
  const models = await db
    .selectFrom('model as m')
    .innerJoin('make as k', 'k.id', 'm.make_id')
    .select([
      'm.id',
      'm.slug',
      'm.name_fa',
      'm.name_en',
      'k.slug as make_slug',
      'k.name_fa as make_fa',
      'k.name_en as make_en',
    ])
    .where('k.slug', 'in', makeSlugs)
    .where('m.slug', 'in', modelSlugs)
    .execute();
  const trimSlugs = scopes.flatMap((scope) => (scope.trimSlug === null ? [] : [scope.trimSlug]));
  const trims =
    trimSlugs.length === 0
      ? []
      : await db
          .selectFrom('trim as t')
          .select(['t.id', 't.model_id', 't.slug', 't.name_fa', 't.name_en'])
          .where(
            't.model_id',
            'in',
            models.map((model) => model.id),
          )
          .where('t.slug', 'in', trimSlugs)
          .execute();
  const found: ResolvedScope[] = [];
  for (const scope of scopes) {
    const model = models.find((row) => row.make_slug === scope.makeSlug && row.slug === scope.modelSlug);
    if (model === undefined) continue;
    const trim =
      scope.trimSlug === null
        ? undefined
        : trims.find((row) => row.model_id === model.id && row.slug === scope.trimSlug);
    if (scope.trimSlug !== null && trim === undefined) continue;
    found.push({
      key: scope.key,
      modelId: model.id,
      trimId: trim?.id ?? null,
      carName: carNameOf({
        makeFa: model.make_fa,
        makeEn: model.make_en,
        modelFa: model.name_fa,
        modelEn: model.name_en,
        trimFa: trim?.name_fa,
        trimEn: trim?.name_en,
      }),
    });
  }
  return found;
}

export type ScopeState = {
  readonly status: ScopeStatus;
  readonly requestId: number | null;
  readonly reason: string | null;
  readonly decidedAt: Date | null;
  /** The file asked about is one of the request's files. */
  readonly linked: boolean;
};

/**
 * Where each scope stands: its request's state (and whether `fileId` depends on it), or read in depth already, or none.
 * A request wins over "read in depth": a model that was tracked after a request keeps the buyer's answer.
 */
export async function readScopeStates(
  db: ReadonlyKysely<DB>,
  scopes: readonly ResolvedScope[],
  fileId: number | null,
): Promise<Map<string, ScopeState>> {
  const states = new Map<string, ScopeState>();
  if (scopes.length === 0) return states;
  const modelIds = [...new Set(scopes.map((scope) => scope.modelId))];
  const [requests, tracked] = await Promise.all([
    db
      .selectFrom('crawl_request as r')
      .leftJoin('crawl_request_file as l', (join) =>
        join.onRef('l.crawl_request_id', '=', 'r.id').on('l.search_file_id', '=', fileId ?? -1),
      )
      .select([
        'r.id',
        'r.model_id',
        'r.trim_id',
        'r.state',
        'r.decline_reason',
        'r.decided_at',
        'l.search_file_id as linked_file',
      ])
      .where('r.model_id', 'in', modelIds)
      .execute(),
    db
      .selectFrom('tracked_model_scope')
      .select(['model_id', 'trim_id'])
      .where('model_id', 'in', modelIds)
      .execute(),
  ]);
  for (const scope of scopes) {
    const request = requests.find((row) => row.model_id === scope.modelId && row.trim_id === scope.trimId);
    const isTracked = tracked.some(
      (row) => row.model_id === scope.modelId && (row.trim_id === null || row.trim_id === scope.trimId),
    );
    if (request !== undefined) {
      const state = request.state;
      states.set(scope.key, {
        status: state,
        requestId: request.id,
        reason: request.decline_reason,
        decidedAt: request.decided_at,
        linked: request.linked_file !== null,
      });
    } else {
      states.set(scope.key, {
        status: isTracked ? 'tracked' : 'none',
        requestId: null,
        reason: null,
        decidedAt: null,
        linked: false,
      });
    }
  }
  return states;
}

/** True when no source is being read now: nothing is requested from any site, so an approved model waits. */
export async function readCrawlPaused(db: ReadonlyKysely<DB>): Promise<boolean> {
  const row = await db
    .selectFrom('source')
    .select((eb) => eb.fn.countAll<number>().as('enabled'))
    .where('crawl_state', '=', 'enabled')
    .where('access_method', '=', 'crawl')
    .executeTakeFirstOrThrow();
  return row.enabled === 0;
}
