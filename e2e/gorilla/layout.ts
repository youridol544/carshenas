import type { Page } from '@playwright/test';
import { LONG_FARSI_PHRASE } from './strings';

export type LayoutReport = {
  overflowPx: number;
  clipped: string[];
  smallTargets: string[];
  misorderedSigns: string[];
  brokenWords: string[];
  brokenNumbers: string[];
};

/**
 * Layout facts a person would notice: the page scrolls sideways, text is cut off by its box, a control is too
 * small to tap. Intentional truncation (ellipsis, line clamp) and links inside sentences (WCAG 2.5.8) are exempt.
 * A control is too small when its box is and its hit area is too: WCAG 2.5.8 measures the region that responds,
 * so a 24 px icon whose hit area a pseudo-element grows to 44 px passes (ui-design craft.md, targets).
 * A sign read after its number («٪», «%», «‰», «°») must sit to the number's left in right-to-left text; the bidi
 * algorithm puts it on the right unless the text says otherwise (formatPercent in packages/locale/src/format-number.ts),
 * so the rendered glyphs are compared, whoever wrote the text.
 * A Persian word never breaks across lines; only a long number may, as a last resort, after a thousands mark
 * (NumericText in apps/web/src/components/ui/numeric-text.tsx). So a word whose glyphs sit on two lines is reported,
 * and so are two Persian digits of one group, or the two sides of a no-break space, on different lines.
 */
export async function inspectLayout(
  page: Page,
  { minTarget = 24 }: { minTarget?: number } = {},
): Promise<LayoutReport> {
  return page.evaluate((min) => {
    const describe = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} "${(element.textContent ?? '').trim().slice(0, 30)}"`;
    const shown = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const clipped: string[] = [];
    for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
      const ownText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (!ownText || !shown(element)) continue;
      const style = getComputedStyle(element);
      const hides =
        ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY);
      const intentional = style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none';
      const cut =
        element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
      if (hides && !intentional && cut) clipped.push(describe(element));
    }
    // A target of `min` px still answers one pixel inside its edge, in all four directions from its centre.
    const answersAtEdges = (element: Element) => {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const box = element.getBoundingClientRect();
      const [x, y, reach] = [box.left + box.width / 2, box.top + box.height / 2, min / 2 - 1];
      const probes = [
        [x + reach, y],
        [x - reach, y],
        [x, y + reach],
        [x, y - reach],
      ] as const;
      return probes.every(([px, py]) => {
        const hit = document.elementFromPoint(px, py);
        return hit !== null && element.contains(hit);
      });
    };
    const { scrollX, scrollY } = window;
    const smallTargets: string[] = [];
    const controls =
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"]';
    for (const element of document.querySelectorAll(controls)) {
      if (!shown(element) || getComputedStyle(element).display === 'inline') continue;
      const box = element.getBoundingClientRect();
      if ((box.width < min || box.height < min) && !answersAtEdges(element))
        smallTargets.push(`${describe(element)} ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    const glyph = (node: Text, index: number) => {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      return range.getBoundingClientRect();
    };
    const sameLine = (a: DOMRect, b: DOMRect) => Math.abs(a.top - b.top) < Math.max(a.height, b.height) / 2;
    // Characters in reading order, one run per block, past invisible bidi marks and across text nodes: NumericText
    // splits a number into spans, so a digit's neighbour is often in another text node.
    const mark = /[\u200E\u200F\u061C]/;
    const digit = /[0-9۰-۹٠-٩]/;
    // Latin digits also sit in codes (a VIN, a URL), which may break anywhere.
    const persianDigit = /[۰-۹٠-٩]/;
    const noBreakSpace = /[\u00A0\u202F]/;
    type Char = { node: Text; index: number; char: string };
    const blocks = new Map<Element, Element>();
    const blockOf = (element: Element) => {
      let block = blocks.get(element);
      for (let current: Element | null = element; !block && current; current = current.parentElement) {
        const display = getComputedStyle(current).display;
        if (display !== 'inline' && display !== 'contents') block = current;
      }
      block ??= document.body;
      blocks.set(element, block);
      return block;
    };
    const runs: Char[][] = [];
    let run: Char[] = [];
    let runBlock: Element | null = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      const parent = text.parentElement;
      if (!parent || !shown(parent)) {
        runBlock = null;
        continue;
      }
      const block = blockOf(parent);
      if (block !== runBlock) {
        runBlock = block;
        run = [];
        runs.push(run);
      }
      for (let index = 0; index < text.data.length; index++) {
        const char = text.data.charAt(index);
        if (!mark.test(char)) run.push({ node: text, index, char });
      }
    }
    const misorderedSigns: string[] = [];
    const brokenNumbers: string[] = [];
    for (const chars of runs) {
      chars.forEach((current, i) => {
        const previous = chars[i - 1];
        const parent = current.node.parentElement;
        if (!previous || !parent) return;
        if (
          '٪%‰°'.includes(current.char) &&
          digit.test(previous.char) &&
          getComputedStyle(parent).direction === 'rtl'
        ) {
          const [sign, number] = [glyph(current.node, current.index), glyph(previous.node, previous.index)];
          if (sign.width > 0 && number.width > 0 && sameLine(sign, number) && sign.left > number.left)
            misorderedSigns.push(`${describe(parent)} «${previous.char}${current.char}»`);
        }
        const joined =
          persianDigit.test(previous.char) && persianDigit.test(current.char)
            ? previous
            : noBreakSpace.test(previous.char)
              ? chars[i - 2]
              : undefined;
        if (!joined) return;
        const [before, after] = [glyph(joined.node, joined.index), glyph(current.node, current.index)];
        if (before.width > 0 && after.width > 0 && !sameLine(before, after)) {
          const around = chars
            .slice(Math.max(0, i - 6), i + 5)
            .map((c) => c.char)
            .join('');
          brokenNumbers.push(`${describe(parent)} «${around}»`);
        }
      });
    }
    const brokenWords: string[] = [];
    const persianLetter = /(?=\p{Script=Arabic})\p{L}/u;
    const words = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = words.nextNode(); node; node = words.nextNode()) {
      const text = node as Text;
      const parent = text.parentElement;
      if (!parent || !shown(parent)) continue;
      for (const match of text.data.matchAll(/\S+/g)) {
        if (!persianLetter.test(match[0])) continue;
        const range = document.createRange();
        range.setStart(text, match.index);
        range.setEnd(text, match.index + match[0].length);
        const lines = [...range.getClientRects()].filter((rect) => rect.width > 0);
        const tops = lines.map((rect) => rect.top);
        const lineHeight = Math.max(0, ...lines.map((rect) => rect.height));
        if (lines.length > 1 && Math.max(...tops) - Math.min(...tops) > lineHeight / 2)
          brokenWords.push(`${describe(parent)} «${match[0]}»`);
      }
    }
    const root = document.documentElement;
    return {
      overflowPx: root.scrollWidth - root.clientWidth,
      clipped: clipped.slice(0, 10),
      smallTargets: smallTargets.slice(0, 10),
      misorderedSigns: misorderedSigns.slice(0, 10),
      brokenWords: brokenWords.slice(0, 10),
      brokenNumbers: brokenNumbers.slice(0, 10),
    };
  }, minTarget);
}

/** Every visible string twice over plus a long Farsi phrase: real copy and real data are longer than mock-ups. */
export async function inflateText(page: Page, extra: string = LONG_FARSI_PHRASE): Promise<void> {
  await page.evaluate((phrase) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const text = node.textContent ?? '';
      if (!text.trim() || node.parentElement?.closest('script, style, noscript, template')) continue;
      // A formatted number grows by digits, never by words; NumericText breaks it between groups of digits.
      if (node.parentElement?.closest('[data-slot="numeric-text"]')) continue;
      node.textContent = `${text} ${text} ${phrase}`;
    }
  }, extra);
}

/**
 * The browser's own "font size" setting, as a person with low vision sets it (Chromium only). Text sized in rem
 * grows with it; text sized in px does not, which is what WCAG 1.4.4 (resize text) is about.
 */
export async function scaleDefaultFontSize(page: Page, factor: number): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send('Page.setFontSizes', {
    fontSizes: { standard: Math.round(16 * factor), fixed: Math.round(13 * factor) },
  });
}

/** Delays every request that matches, like a congested mobile network. */
export async function slowDown(
  page: Page,
  delayMs: number,
  matches: (url: URL) => boolean = () => true,
): Promise<void> {
  await page.route(matches, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fallback();
  });
}

export type FocusStop = { step: number; element: string; name: string };

/**
 * Presses Tab through the page. Each stop must be visible in the viewport, have an accessible name and look
 * different from its unfocused self (a focus indicator judged by change, not by guessing at outline styles);
 * focus must not cycle before every control was reached (a trap) or skip controls.
 */
export async function keyboardWalk(
  page: Page,
  maxStops = 80,
): Promise<{ stops: FocusStop[]; tabbable: number; problems: string[] }> {
  const tabbable = await page.evaluate(() => {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    const elements = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (element) =>
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== 'hidden' &&
        !element.closest('[inert]'),
    );
    elements.forEach((element, index) => {
      const style = getComputedStyle(element);
      element.dataset.walkStop = String(index);
      element.dataset.walkLook = [
        style.outlineStyle,
        style.outlineWidth,
        style.outlineColor,
        style.boxShadow,
        style.borderColor,
        style.backgroundColor,
        style.textDecorationLine,
      ].join('|');
    });
    return elements.length;
  });

  const stops: FocusStop[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (let step = 1; step <= Math.min(maxStops, tabbable + 1); step += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const look = [
        style.outlineStyle,
        style.outlineWidth,
        style.outlineColor,
        style.boxShadow,
        style.borderColor,
        style.backgroundColor,
        style.textDecorationLine,
      ].join('|');
      const labels =
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
          ? [...(element.labels ?? [])].map((label) => label.textContent ?? '')
          : [];
      const name = (
        element.getAttribute('aria-label') ??
        (labels.join(' ') || element.textContent || element.getAttribute('title') || '')
      )
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      return {
        id: element.dataset.walkStop ?? `unlisted:${element.tagName}`,
        element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`,
        name,
        inViewport:
          box.width > 0 &&
          box.height > 0 &&
          box.bottom > 0 &&
          box.top < innerHeight &&
          box.right > 0 &&
          box.left < innerWidth,
        changed: element.dataset.walkLook === undefined || element.dataset.walkLook !== look,
      };
    });
    if (stop === null) {
      if (seen.size < tabbable)
        problems.push(`after ${seen.size} of ${tabbable} controls, Tab left the page content`);
      break;
    }
    stops.push({ step, element: stop.element, name: stop.name });
    if (seen.has(stop.id)) {
      if (seen.size < tabbable)
        problems.push(
          `focus trap: Tab came back to ${stop.element} "${stop.name}" after ${seen.size} of ${tabbable} controls`,
        );
      break;
    }
    seen.add(stop.id);
    if (!stop.inViewport)
      problems.push(`${stop.element} "${stop.name}" has focus but is not visible in the viewport`);
    if (!stop.changed) problems.push(`${stop.element} "${stop.name}" shows no focus indicator`);
    if (!stop.name) problems.push(`${stop.element} has no accessible name`);
  }
  if (
    seen.size < tabbable &&
    !problems.some((line) => line.startsWith('focus trap') || line.startsWith('after '))
  ) {
    problems.push(`Tab reached ${seen.size} of ${tabbable} controls`);
  }
  return { stops, tabbable, problems };
}
