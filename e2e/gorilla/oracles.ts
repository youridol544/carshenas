import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * How a gorilla run decides that something broke. Ranked by signal in the 2026-09-18 research: uncaught
 * errors, failed requests, sideways overflow, error screens and garbage text first; accessibility after chaos
 * and lost focus next; main-thread stalls last, with a generous limit so a busy CI machine does not produce
 * findings of its own. Slow paints after an interaction are only warnings: on 2026-09-21 a clean page measured
 * 1288 ms once and never again, so they cannot fail a seeded, replayable run.
 */
export type OracleOptions = {
  /** Origin the gorilla stays on. Top-level navigations elsewhere are answered with 204 and go nowhere. */
  allowedOrigin: string;
  /** Findings matching any of these are dropped (a known, tracked issue; name its task in a comment). */
  ignore?: readonly RegExp[];
  /** A single task longer than this is a main-thread stall. */
  maxTaskMs?: number;
  /** An interaction whose next paint takes longer than this is reported as a warning. */
  maxInteractionMs?: number;
  /** Run axe on the final state of every run. */
  axe?: boolean;
  /**
   * Controls that must never be pressed, by accessible name. Besides the checks before each action, a click
   * on one is blocked inside the page, whatever caused it: a double tap whose second click lands on a control
   * that moved under the pointer, Enter on a focused link, a form's implicit submit.
   */
  deny?: RegExp;
};

type Probe = {
  worstTaskMs: number;
  worstInteractionMs: number;
  lastFocused: Element | null;
  /** The path at which lastFocused received focus: a navigation to another path since then replaced the page,
   * focus included. A change of query or hash keeps the page (a filter in the address), so focus must survive it. */
  lastPath: string;
  /** The path at the latest focusin. Reading the path only when an action starts races the router: the address
   * can change before the browser moves focus off the page it hid. */
  focusPath: string;
  blocked: string[];
};

declare global {
  interface Window {
    __gorilla?: Probe;
  }
}

/** Runs in the page before any application code on every load. Must stay self-contained. */
function installProbes(deny: { source: string; flags: string } | null) {
  const probe: Probe = {
    worstTaskMs: 0,
    worstInteractionMs: 0,
    lastFocused: null,
    lastPath: location.pathname,
    focusPath: location.pathname,
    blocked: [],
  };
  window.__gorilla = probe;
  document.addEventListener(
    'focusin',
    () => {
      probe.focusPath = location.pathname;
    },
    true,
  );
  if (deny) {
    const denied = new RegExp(deny.source, deny.flags);
    const nameOf = (control: Element) => {
      const labelledBy = control.getAttribute('aria-labelledby');
      const byIds = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ')
        : '';
      const labels =
        control instanceof HTMLInputElement
          ? [...(control.labels ?? [])].map((label) => label.textContent ?? '').join(' ')
          : '';
      const value = control instanceof HTMLInputElement ? control.value : '';
      return [
        control.getAttribute('aria-label'),
        byIds,
        labels,
        control.textContent,
        value,
        control.getAttribute('title'),
      ]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    // Capture phase on window, registered before any page script: it runs first and stops the click there.
    window.addEventListener(
      'click',
      (event) => {
        const control =
          event.target instanceof Element
            ? event.target.closest(
                'button, a[href], summary, input[type="submit"], input[type="button"], [role="button"], [role="link"], [role="menuitem"]',
              )
            : null;
        if (!control) return;
        const name = nameOf(control);
        if (!denied.test(name)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        probe.blocked.push(name.slice(0, 60));
      },
      true,
    );
  }
  const observe = (
    type: string,
    onEntry: (entry: PerformanceEntry) => void,
    extra: Record<string, unknown> = {},
  ) => {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) onEntry(entry);
      }).observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
    } catch {
      // This engine does not report the entry type (WebKit has no long tasks).
    }
  };
  observe('longtask', (entry) => {
    probe.worstTaskMs = Math.max(probe.worstTaskMs, entry.duration);
  });
  observe(
    'event',
    (entry) => {
      probe.worstInteractionMs = Math.max(probe.worstInteractionMs, entry.duration);
    },
    { durationThreshold: 104 },
  );
  document.addEventListener(
    'focusin',
    (event) => {
      probe.lastFocused = event.target instanceof Element ? event.target : null;
    },
    true,
  );
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const GARBAGE = /\bNaN\b|ناعدد|\bundefined\b|\[object Object\]|Invalid Date/;

export type Oracles = {
  /** Forget findings from the previous run. */
  reset(): void;
  /** Remember what has focus before an action. */
  beforeAction(): Promise<void>;
  /** If the focused control vanished during the action and focus fell back to the page, describe it. */
  afterAction(): Promise<string | null>;
  /** Names of denied controls whose clicks the in-page fence blocked since the last call. */
  blockedPresses(): Promise<string[]>;
  /** Everything wrong with the page now, after a run, plus warnings that do not fail it. */
  check(scope: string): Promise<{ problems: string[]; warnings: string[] }>;
};

export async function installOracles(page: Page, options: OracleOptions): Promise<Oracles> {
  const maxTaskMs = options.maxTaskMs ?? 1_000;
  const maxInteractionMs = options.maxInteractionMs ?? 1_000;
  const events: string[] = [];
  const note = (line: string) => {
    if (!(options.ignore ?? []).some((pattern) => pattern.test(line))) events.push(line);
  };

  await page.addInitScript(
    installProbes,
    options.deny ? { source: options.deny.source, flags: options.deny.flags } : null,
  );
  page.on('pageerror', (error) => {
    note(`uncaught exception: ${error.message}`);
  });
  page.on('console', (message) => {
    const text = message.text();
    // A failed load is reported once, with its status, by the response listener below.
    if (message.type() === 'error' && !text.startsWith('Failed to load resource'))
      note(`console error: ${text.slice(0, 300)}`);
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? '';
    // Navigations and reloads cancel whatever was in flight; that is the gorilla's doing, not a finding.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(reason)) return;
    note(`failed request: ${request.method()} ${request.url()} (${reason})`);
  });
  page.on('response', (response) => {
    const status = response.status();
    const request = response.request();
    const sameOrigin = new URL(response.url()).origin === options.allowedOrigin;
    const ownResource = ['document', 'fetch', 'xhr', 'script', 'stylesheet', 'image', 'font'].includes(
      request.resourceType(),
    );
    if (status >= 500 || (status >= 400 && sameOrigin && ownResource)) {
      note(`failed request: HTTP ${status} ${request.method()} ${response.url()}`);
    }
  });
  page.on('dialog', (dialog) => {
    note(`native ${dialog.type()} dialog: "${dialog.message().slice(0, 80)}"`);
    void dialog.dismiss().catch(() => undefined);
  });
  page.context().on('page', (popup) => {
    void popup
      .opener()
      .then((opener) => (opener ? popup.close() : undefined))
      .catch(() => undefined);
  });
  // The fence. Aborting a top-level navigation would strand the tab on an error page, so it gets an empty 204
  // and the page stays where it is. Other origins' images, fonts and scripts still load.
  await page.route(
    (url) => url.origin !== options.allowedOrigin,
    async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        await route.fulfill({ status: 204 });
      else await route.fallback();
    },
  );

  return {
    reset() {
      events.length = 0;
    },

    async beforeAction() {
      await page
        .evaluate(() => {
          const probe = window.__gorilla;
          const active = document.activeElement;
          if (probe) {
            probe.lastFocused = active && active !== document.body ? active : null;
            probe.lastPath = probe.focusPath;
          }
        })
        .catch(() => undefined);
    },

    async afterAction() {
      return page
        .evaluate(async () => {
          // Give the page two frames to move focus somewhere sensible before judging.
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const probe = window.__gorilla;
          const last = probe?.lastFocused;
          if (!probe || !last) return null;
          // A link that navigated to another path replaced the page; focus starting over at the document is what a
          // fresh page load does, and the route announcer names the new page.
          if (location.pathname !== probe.lastPath) {
            probe.lastFocused = null;
            return null;
          }
          const active = document.activeElement;
          if (active && active !== document.body) return null;
          if (last.isConnected && last.getClientRects().length > 0) return null;
          probe.lastFocused = null;
          const name = (last.getAttribute('aria-label') ?? last.textContent ?? '').trim().slice(0, 40);
          return `${last.tagName.toLowerCase()} "${name}"`;
        })
        .catch(() => null); // the page is navigating
    },

    async blockedPresses() {
      return page
        .evaluate(() => {
          const probe = window.__gorilla;
          if (!probe) return [];
          return probe.blocked.splice(0);
        })
        .catch(() => []);
    },

    async check(scope) {
      const problems = [...events];
      const warnings: string[] = [];
      const state = await page
        .evaluate((garbageSource) => {
          const root = document.documentElement;
          const text = document.body.innerText;
          const devOverlay = document
            .querySelector('nextjs-portal')
            ?.shadowRoot?.querySelector('[data-nextjs-dialog-content], [data-nextjs-error-overlay-nav]');
          return {
            overflow: root.scrollWidth - root.clientWidth,
            width: root.clientWidth,
            garbage: new RegExp(garbageSource).exec(text)?.[0] ?? null,
            errorScreen:
              Boolean(document.querySelector('[data-error-screen], #__next_error__')) ||
              Boolean(devOverlay) ||
              /Application error: a (client|server)-side exception/i.test(text),
            empty: text.trim().length === 0,
            brokenImages: [...document.images]
              .filter((image) => image.complete && image.naturalWidth === 0 && image.currentSrc !== '')
              .map((image) => image.currentSrc)
              .slice(0, 3),
            worstTaskMs: window.__gorilla?.worstTaskMs ?? 0,
            worstInteractionMs: window.__gorilla?.worstInteractionMs ?? 0,
          };
        }, GARBAGE.source)
        .catch((error: unknown) => ({
          unresponsive: error instanceof Error ? error.message.split('\n')[0] : String(error),
        }));

      if ('unresponsive' in state) {
        return { problems: [...problems, `the page stopped responding: ${state.unresponsive}`], warnings };
      }
      if (state.overflow > 1)
        problems.push(
          `horizontal overflow: the page scrolls ${state.overflow}px sideways at ${state.width}px`,
        );
      if (state.garbage) problems.push(`garbage text on screen: "${state.garbage}"`);
      if (state.errorScreen) problems.push('the error screen is showing');
      if (state.empty) problems.push('the page is empty');
      for (const source of state.brokenImages) problems.push(`broken image: ${source}`);
      if (state.worstTaskMs > maxTaskMs) {
        problems.push(`main thread blocked for ${Math.round(state.worstTaskMs)}ms (limit ${maxTaskMs}ms)`);
      }
      if (state.worstInteractionMs > maxInteractionMs) {
        warnings.push(
          `an interaction took ${Math.round(state.worstInteractionMs)}ms to paint (limit ${maxInteractionMs}ms)`,
        );
      }
      if (options.axe !== false) {
        try {
          const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).include(scope).analyze();
          for (const violation of violations) {
            const targets = violation.nodes
              .map((node) => node.target.join(' '))
              .slice(0, 3)
              .join(', ');
            problems.push(`accessibility: ${violation.id} (${violation.impact ?? 'unknown'}) on ${targets}`);
          }
        } catch (error) {
          console.log(
            `[gorilla] accessibility scan skipped: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
          );
        }
      }
      return { problems: [...new Set(problems)], warnings };
    },
  };
}
