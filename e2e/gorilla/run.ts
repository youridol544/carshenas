import { writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';
import fc from 'fast-check';
import { actionArbitrary, DEFAULT_DENY, perform, type Action, type ActionWeights } from './actions';
import { installOracles, type OracleOptions } from './oracles';

export type GorillaOptions = {
  /** Page to hammer: a path on the project's baseURL, or a full URL. Every run starts from a fresh load. */
  url: string;
  /** CSS selector of the feature under test; the gorilla only touches controls inside it. */
  scope?: string;
  seed: number;
  /** Replay path printed by a failing run: replays exactly that counterexample, once. */
  path?: string;
  /** Upper bound on runs; the time budget usually ends the search first. */
  runs?: number;
  maxActions?: number;
  /** Time spent looking for a failure, in milliseconds. Shrinking a failure gets as long again at most. */
  budgetMs?: number;
  /** Shrink a failure to a minimal action sequence (default true). */
  shrink?: boolean;
  weights?: ActionWeights;
  deny?: RegExp;
  /** Wait until the page is usable, e.g. its heading is visible. */
  ready?: (page: Page) => Promise<void>;
  oracle?: Omit<OracleOptions, 'allowedOrigin'>;
};

export type GorillaResult = {
  failed: boolean;
  seed: number;
  path: string | null;
  runs: number;
  shrinks: number;
  /** The action log of the minimal failing run. */
  actions: readonly string[];
  problems: readonly string[];
  /** Did replaying the minimal failure from its seed and path fail again with the same problem (digits aside)?
   * null when nothing failed. */
  reproduced: boolean | null;
  /** What the replay reported, when it differs from `problems` this shows how. */
  replayProblems: readonly string[];
  warnings: readonly string[];
  replay: string;
  logFile: string;
  /** Trace of the replayed failure, when the project was not already tracing. */
  traceFile: string | null;
};

/** Knobs from the environment, set by `pnpm gorilla` (scripts/gorilla.mjs). */
export function gorillaSettings(env: NodeJS.ProcessEnv = process.env) {
  const number = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return value !== undefined && value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    seed: parseSeed(env.GORILLA_SEED),
    path: env.GORILLA_PATH || undefined,
    runs: number(env.GORILLA_RUNS, 1_000),
    maxActions: number(env.GORILLA_ACTIONS, 30),
    budgetMs: number(env.GORILLA_BUDGET_S, 60) * 1_000,
    url: env.GORILLA_URL || undefined,
    scope: env.GORILLA_SCOPE || undefined,
  };
}

export function parseSeed(value: string | undefined): number {
  if (value === undefined || value === '' || value === 'random') return Math.floor(Math.random() * 2 ** 31);
  const seed = Number(value);
  if (!Number.isSafeInteger(seed))
    throw new Error(`GORILLA_SEED must be an integer or "random", got "${value}"`);
  return seed;
}

class Finding extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
  }
}

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const firstLine = (error: unknown) =>
  error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);

export async function runGorilla(
  page: Page,
  testInfo: TestInfo,
  options: GorillaOptions,
): Promise<GorillaResult> {
  const base = testInfo.project.use.baseURL ?? 'http://127.0.0.1';
  const target = new URL(options.url, base);
  const scope = options.scope ?? 'body';
  const maxActions = options.maxActions ?? 30;
  const budgetMs = options.budgetMs ?? 60_000;
  const deny = options.deny ?? DEFAULT_DENY;
  const replaying = options.path !== undefined;
  const oracles = await installOracles(page, { allowedOrigin: target.origin, deny, ...options.oracle });
  const viewport = page.viewportSize();
  const shown = target.origin === new URL(base).origin ? `${target.pathname}${target.search}` : target.href;
  const actionsArbitrary = fc.array(actionArbitrary(options.weights), {
    minLength: 1,
    maxLength: maxActions,
  });

  console.log(
    `[gorilla] ${shown} scope=${scope} seed=${options.seed}${replaying ? ` path=${options.path}` : ''} ` +
      `budget=${budgetMs / 1_000}s actions<=${maxActions}`,
  );

  let executed = 0;
  const failing = { actions: [] as string[], problems: [] as string[] };
  const warnings = new Set<string>();

  /** One run: a fresh page, the actions, then every oracle. Throws a Finding when something broke. */
  async function runOnce(actions: readonly Action[]) {
    executed += 1;
    const log: string[] = [];
    try {
      // Every run starts from the same state, or a seed would not replay: storage, cookies, viewport.
      if (new URL(page.url()).origin === target.origin) {
        await page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch {
            // storage is blocked on this page
          }
        });
      }
      await page.context().clearCookies();
      if (viewport) await page.setViewportSize(viewport);
      oracles.reset(); // before the load, so an error while the page loads counts too
      await page.goto(target.href);
      await options.ready?.(page);
      const root = page.locator(scope).first();
      for (const action of actions) {
        await oracles.beforeAction();
        const before = page.url();
        log.push(await perform(page, root, action, deny));
        const lost = await oracles.afterAction();
        for (const name of await oracles.blockedPresses())
          log.push(`  (a click on "${name}" was blocked by the deny-list)`);
        // A link that navigates replaces the page it was on; where focus goes then is the router's business.
        if (lost !== null && page.url() === before)
          log.push(`  focus lost: ${lost} disappeared or was hidden and focus fell back to the page`);
        if (new URL(page.url()).origin !== target.origin) {
          await page.goto(target.href);
          log.push('  (left the page; back to the start)');
        }
      }
      const health = await oracles.check(scope);
      for (const warning of health.warnings) warnings.add(warning);
      const focus = log.filter((line) => line.startsWith('  focus lost:')).map((line) => line.trim());
      const problems = [...health.problems, ...focus];
      if (problems.length > 0) throw new Finding(problems);
    } catch (error) {
      failing.actions = log;
      failing.problems = error instanceof Finding ? error.problems : [`the run crashed: ${firstLine(error)}`];
      throw error;
    }
  }

  // The time box lives here rather than in fast-check's interruptAfterTimeLimit, which returns while the run in
  // flight keeps driving the page (seen on 2026-09-21). Past a deadline every remaining run is waved through, so
  // fast-check ends normally: with no failure after the search budget, or with the smallest failure found once
  // shrinking has had as long again.
  /** Records a trace of `work` unless the project already traces this test (then its own trace covers it). */
  async function traced<T>(
    name: string,
    work: () => Promise<T>,
  ): Promise<{ value: T; traceFile: string | null }> {
    const tracing = await page
      .context()
      .tracing.start({ screenshots: true, snapshots: true, title: name })
      .then(() => true)
      .catch(() => false);
    try {
      return {
        value: await work(),
        traceFile: tracing ? testInfo.outputPath(`${name.replaceAll(' ', '-')}-trace.zip`) : null,
      };
    } finally {
      if (tracing)
        await page
          .context()
          .tracing.stop({ path: testInfo.outputPath(`${name.replaceAll(' ', '-')}-trace.zip`) });
    }
  }

  const searchDeadline = Date.now() + budgetMs;
  const shrinkDeadline = searchDeadline + budgetMs;
  const search = fc.asyncProperty(actionsArbitrary, async (actions) => {
    const found = failing.problems.length > 0;
    if (!replaying && Date.now() > (found ? shrinkDeadline : searchDeadline)) return;
    await runOnce(actions);
  });
  const check = () =>
    fc.check(search, {
      seed: options.seed,
      path: options.path,
      numRuns: replaying ? 1 : (options.runs ?? 1_000),
      endOnFailure: replaying || options.shrink === false,
    });
  const searched = replaying
    ? await traced(`gorilla seed ${options.seed} replay`, check)
    : { value: await check(), traceFile: null };
  const result = searched.value;

  const path = result.failed ? (result.counterexamplePath ?? null) : null;
  const found = { actions: [...failing.actions], problems: [...failing.problems] };

  // Replay the minimal failure once more from its seed and path, the way a person would, and record that run's
  // trace: it proves the finding is reproducible and gives a trace of a few actions instead of every run.
  let reproduced: boolean | null = null;
  let replayProblems: string[] = [];
  let traceFile = searched.traceFile;
  if (result.failed && !replaying && path !== null) {
    const again = await traced(`gorilla seed ${result.seed}`, () =>
      fc.check(fc.asyncProperty(actionsArbitrary, runOnce), {
        seed: result.seed,
        path,
        numRuns: 1,
        endOnFailure: true,
      }),
    );
    replayProblems = again.value.failed ? [...failing.problems] : [];
    const signature = (problem: string) => problem.replace(/\d+/g, '#');
    const seen = new Set(replayProblems.map(signature));
    reproduced = again.value.failed && found.problems.some((problem) => seen.has(signature(problem)));
    traceFile = again.traceFile;
  }

  const project = testInfo.project.name.startsWith('chaos-')
    ? testInfo.project.name.slice('chaos-'.length)
    : 'mobile';
  const url = testInfo.project.name.startsWith('chaos-') ? shown : target.href;
  const replay =
    `${process.env.E2E_BASE_URL ? `E2E_BASE_URL=${quote(process.env.E2E_BASE_URL)} ` : ''}pnpm gorilla ${quote(url)} --scope ${quote(scope)} --seed ${result.seed} --actions ${maxActions}` +
    `${path === null ? '' : ` --path ${quote(path)}`} --project ${project}`;
  const logFile = testInfo.outputPath(`gorilla-seed-${result.seed}${replaying ? '-replay' : ''}.json`);
  const summary = {
    failed: result.failed,
    seed: result.seed,
    path,
    runs: executed,
    shrinks: result.numShrinks,
    actions: result.failed ? found.actions : [],
    problems: result.failed ? found.problems : [],
    reproduced,
    replayProblems,
    warnings: [...warnings].slice(0, 10),
    replay,
    logFile,
    traceFile,
  } satisfies GorillaResult;

  await writeFile(
    logFile,
    `${JSON.stringify({ ...summary, url: target.href, scope, budgetMs, maxActions, project: testInfo.project.name }, null, 2)}\n`,
  );
  await testInfo.attach(`gorilla seed ${result.seed}${replaying ? ' replay' : ''}`, {
    path: logFile,
    contentType: 'application/json',
  });

  for (const warning of summary.warnings)
    console.log(`[gorilla] warning (does not fail the run): ${warning}`);
  if (result.failed) {
    const replayed =
      reproduced === null
        ? ''
        : reproduced
          ? 'the replay failed the same way'
          : replayProblems.length > 0 && replayProblems.join() !== found.problems.join()
            ? `the replay failed differently: ${replayProblems.join(' | ')}`
            : 'the replay did NOT fail again (flaky)';
    console.log(
      `[gorilla] FAILED after ${executed} runs (${result.numShrinks} shrinks)${replayed ? `; ${replayed}` : ''}\n` +
        `[gorilla] problems:\n${summary.problems.map((line) => `  - ${line}`).join('\n')}\n` +
        `[gorilla] minimal action sequence:\n${summary.actions.map((line) => `  ${line}`).join('\n')}\n` +
        `[gorilla] action log: ${logFile}\n` +
        `${traceFile ? `[gorilla] trace of the replay: npx playwright trace open ${traceFile}\n` : ''}` +
        `[gorilla] replay: ${replay}`,
    );
  } else {
    console.log(`[gorilla] ok: ${executed} runs, no findings (seed ${result.seed})`);
  }
  return summary;
}
