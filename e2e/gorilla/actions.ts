import type { Locator, Page } from '@playwright/test';
import fc from 'fast-check';
import { HOSTILE_STRINGS } from './strings';

/** One thing an impatient, careless or unlucky person does. Every choice comes from the seed. */
export type Action =
  | { kind: 'tap'; pick: number; double: boolean }
  | { kind: 'type'; pick: number; text: number }
  | { kind: 'key'; key: string }
  | { kind: 'scroll'; dy: number }
  | { kind: 'resize'; width: number }
  | { kind: 'history'; move: 'back' | 'forward' | 'reload' }
  | { kind: 'pause'; ms: number };

export type ActionWeights = Partial<Record<Action['kind'], number>>;

/** Controls a person can operate, found by role-bearing markup rather than by position. */
export const INTERACTIVE = [
  'a[href]',
  'button',
  'summary',
  'select',
  'textarea',
  'input:not([type="hidden"])',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="option"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const EDITABLE = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="range"]):not([type="color"])',
  'textarea',
  '[contenteditable="true"]',
].join(', ');

const KEYS = [
  'Tab',
  'Tab',
  'Tab',
  'Shift+Tab',
  'Enter',
  'Space',
  'Escape',
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Backspace',
];
const WIDTHS = [320, 360, 412, 768, 1024, 1440];

/**
 * Controls the gorilla never presses, matched on their accessible name: deleting, signing out and paying are not
 * random acts, and a real backend would carry them out. Test those flows with scripts.
 */
export const DEFAULT_DENY = /حذف|خروج|پرداخت|delete|log ?out|sign ?out|\bpay\b/i;

export function actionArbitrary(weights: ActionWeights = {}): fc.Arbitrary<Action> {
  const w = { tap: 10, type: 4, key: 4, scroll: 2, resize: 1, history: 1, pause: 1, ...weights };
  return fc.oneof(
    {
      weight: w.tap,
      arbitrary: fc.record({ kind: fc.constant('tap' as const), pick: fc.nat(9_999), double: fc.boolean() }),
    },
    {
      weight: w.type,
      arbitrary: fc.record({
        kind: fc.constant('type' as const),
        pick: fc.nat(9_999),
        text: fc.nat(HOSTILE_STRINGS.length - 1),
      }),
    },
    {
      weight: w.key,
      arbitrary: fc.record({ kind: fc.constant('key' as const), key: fc.constantFrom(...KEYS) }),
    },
    {
      weight: w.scroll,
      arbitrary: fc.record({
        kind: fc.constant('scroll' as const),
        dy: fc.integer({ min: -1_200, max: 1_200 }),
      }),
    },
    {
      weight: w.resize,
      arbitrary: fc.record({ kind: fc.constant('resize' as const), width: fc.constantFrom(...WIDTHS) }),
    },
    {
      weight: w.history,
      arbitrary: fc.record({
        kind: fc.constant('history' as const),
        move: fc.constantFrom('back' as const, 'forward' as const, 'reload' as const),
      }),
    },
    {
      weight: w.pause,
      arbitrary: fc.record({ kind: fc.constant('pause' as const), ms: fc.integer({ min: 20, max: 300 }) }),
    },
  );
}

type Reachability = { state: 'ok' | 'covered' | 'disabled' | 'foreign' | 'gone' };

/**
 * The accessible name, as Playwright computes it for getByRole (labels, aria-labelledby, button values, alt
 * text...), read from the element's ARIA snapshot. Used for the action log and for the deny-list.
 */
async function accessibleName(target: Locator): Promise<string> {
  const snapshot = await target.ariaSnapshot({ timeout: 1_000 }).catch(() => '');
  const name = /^- [\w-]+ "((?:[^"\\]|\\.)*)"/.exec(snapshot)?.[1] ?? '';
  return name.replace(/\\"/g, '"').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/**
 * Is this control something a person could press right now? A modal backdrop still leaves the controls behind
 * it "visible" to Playwright, so the centre point is hit-tested (5 ms instead of a 1.5 s click timeout), and
 * shadow-DOM content (framework dev tools, third-party widgets) is left alone.
 */
async function reachability(target: Locator): Promise<Reachability> {
  return target
    .evaluate(
      (element) => {
        if (element.getRootNode() !== document) return { state: 'foreign' as const };
        if ((element as HTMLButtonElement).disabled) return { state: 'disabled' as const };
        const box = element.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { state: 'ok' as const };
        const hit = document.elementFromPoint(x, y);
        const reachable = hit !== null && (hit === element || element.contains(hit) || hit.contains(element));
        return { state: reachable ? ('ok' as const) : ('covered' as const) };
      },
      undefined,
      { timeout: 1_000 },
    )
    .catch(() => ({ state: 'gone' as const }));
}

async function pickOne(list: Locator, pick: number): Promise<Locator | null> {
  const count = await list.count();
  return count > 0 ? list.nth(pick % count) : null;
}

/** Performs one action inside `scope` and returns a line for the action log. Misses are not failures. */
export async function perform(page: Page, scope: Locator, action: Action, deny: RegExp): Promise<string> {
  const quick = { timeout: 1_500 };
  switch (action.kind) {
    case 'tap': {
      const target = await pickOne(scope.locator(INTERACTIVE).filter({ visible: true }), action.pick);
      if (target === null) return 'tap: nothing to tap';
      const name = await accessibleName(target);
      const { state } = await reachability(target);
      if (state !== 'ok') return `tap: skipped "${name}" (${state})`;
      if (deny.test(name)) return `tap: skipped "${name}" (deny-list)`;
      await (action.double ? target.dblclick(quick) : target.click(quick)).catch(() => undefined);
      return `${action.double ? 'double-tap' : 'tap'} "${name}"`;
    }
    case 'type': {
      const target = await pickOne(scope.locator(EDITABLE).filter({ visible: true }), action.pick);
      if (target === null) return 'type: nothing editable';
      const name = await accessibleName(target);
      const { state } = await reachability(target);
      if (state !== 'ok') return `type: skipped "${name}" (${state})`;
      await target.fill(HOSTILE_STRINGS[action.text] ?? '', quick).catch(() => undefined);
      return `type string #${action.text} into "${name}"`;
    }
    case 'key': {
      // Enter and Space activate whatever has focus, so the deny-list applies to the keyboard too.
      if (action.key === 'Enter' || action.key === 'Space') {
        const focused = page.locator(':focus');
        const name = (await focused.count()) === 1 ? await accessibleName(focused) : '';
        if (name && deny.test(name)) return `key ${action.key}: skipped on "${name}" (deny-list)`;
      }
      await page.keyboard.press(action.key);
      return `key ${action.key}`;
    }
    case 'scroll':
      await page.mouse.wheel(0, action.dy);
      return `scroll ${action.dy}px`;
    case 'resize':
      await page.setViewportSize({ width: action.width, height: page.viewportSize()?.height ?? 800 });
      return `resize to ${action.width}px`;
    case 'history':
      if (action.move === 'reload') await page.reload(quick).catch(() => undefined);
      else await (action.move === 'back' ? page.goBack(quick) : page.goForward(quick)).catch(() => undefined);
      return `history ${action.move}`;
    case 'pause':
      // Real people pause; timers, debounces and late responses land in these gaps.
      await page.waitForTimeout(action.ms);
      return `pause ${action.ms}ms`;
  }
}
